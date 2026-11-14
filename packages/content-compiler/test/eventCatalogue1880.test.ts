import { DiagnosticCollector } from "@bluewave/diagnostics";
import { EventSchema, parseUiCatalogue } from "@bluewave/content-schema";
import { Schema } from "effect";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import type { ContentBundle } from "../src/index.js";
import { Compiler, eventResolutionFromRulesets } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const contentDir = resolve(here, "..", "..", "..", "content", "production", "1880");

function compileProduction(): { bundle: ContentBundle; errors: readonly string[] } {
  const collector = new DiagnosticCollector();
  const input = buildFullSurfaceInput(resolve(contentDir, "pack.json"), contentDir, collector);
  const output = new Compiler().compile(input!, new AbortController().signal, collector);
  if (output === undefined) throw new Error(collector.toHuman().slice(0, 1500));
  return {
    bundle: output.bundle,
    errors: collector.all.filter((d) => d.severity === "error").map((d) => String(d.code)),
  };
}

const MIN_EVENTS_PER_GOVERNMENT_TYPE = 2;
const MIN_CATALOGUE_EVENTS = 12;
const MAX_CATALOGUE_EVENTS = 20;

describe("1880 event catalogue", () => {
  const { bundle, errors } = compileProduction();
  const events = (bundle.campaign?.events ?? []).map((event) =>
    Schema.decodeUnknownSync(EventSchema)(event),
  );
  const presentTypes = [
    ...new Set(
      (bundle.nations as readonly { regime: { governmentType: string } }[]).map(
        (nation) => nation.regime.governmentType,
      ),
    ),
  ].sort();

  it("compiles with no error diagnostics", () => {
    expect(errors).toEqual([]);
  });

  it("gives every event a hawk and a dove answer", () => {
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      const stances = event.answers.map((answer) => answer.stance);
      expect(stances, event.id).toContain("hawk");
      expect(stances, event.id).toContain("dove");
    }
  });

  it("covers every government type present in the pack with at least two gated events", () => {
    expect(presentTypes.length).toBeGreaterThan(0);
    for (const type of presentTypes) {
      const gated = events.filter((event) => event.gates.governmentTypes?.includes(type as never));
      expect(gated.length, type).toBeGreaterThanOrEqual(MIN_EVENTS_PER_GOVERNMENT_TYPE);
    }
  });

  it("holds between 12 and 20 events", () => {
    expect(events.length).toBeGreaterThanOrEqual(MIN_CATALOGUE_EVENTS);
    expect(events.length).toBeLessThanOrEqual(MAX_CATALOGUE_EVENTS);
  });

  it("carries a sudden-tension event whose hawk answer jumps tension by the ruleset cap", () => {
    const resolution = eventResolutionFromRulesets(bundle.rulesets);
    expect(resolution?.ok).toBe(true);
    if (resolution === undefined || !resolution.ok) return;
    const cap = resolution.value.answerEffects.tensionJumpCap;
    const sudden = events.filter((event) => {
      const hawk = event.answers.find((answer) => answer.stance === "hawk");
      const dove = event.answers.find((answer) => answer.stance === "dove");
      return hawk?.effects.tension?.delta === cap && (dove?.effects.tension?.delta ?? 0) < 0;
    });
    expect(sudden.length).toBeGreaterThanOrEqual(1);
  });

  it("authors no flag gates while the engine does not apply setFlag", () => {
    for (const event of events) {
      expect(event.gates.requiredFlags ?? [], event.id).toEqual([]);
      for (const answer of event.answers) expect(answer.effects.setFlag, event.id).toBeUndefined();
    }
  });

  it("uses unique event ids and unique i18n keys", () => {
    const ids = events.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = events.flatMap((event) => [
      event.titleKey,
      event.bodyKey,
      ...event.answers.map((answer) => answer.labelKey),
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("defines every i18n key in every locale file", () => {
    const keys = events.flatMap((event) => [
      event.titleKey,
      event.bodyKey,
      ...event.answers.map((answer) => answer.labelKey),
    ]);
    const locales = readdirSync(resolve(contentDir, "ui")).filter((file) => /\.ya?ml$/u.test(file));
    expect(locales.length).toBeGreaterThan(0);
    for (const file of locales) {
      const path = resolve(contentDir, "ui", file);
      const parsed = parseUiCatalogue(readFileSync(path, "utf8"), path);
      expect(parsed.ok, file).toBe(true);
      if (!parsed.ok) continue;
      for (const key of keys) {
        expect(parsed.catalogue.strings[key], `${file}: ${key}`).toBeTypeOf("string");
      }
    }
  });
});
