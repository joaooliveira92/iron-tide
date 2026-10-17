import { describe, it, expect } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildContentBundleArtifact, buildFullSurfaceInput } from "@bluewave/content-compiler";
import {
  ContentBundleSchema,
  validateAgainstSchema,
  type CompiledContentBundle,
} from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";

import {
  IdleProgressionYearError,
  assertNoIdleYears,
  buildProgressionLedger,
  idleYears,
  progressionEventsForYear,
  type ProgressionEvent,
} from "../src/progression-ledger.js";

const thisDir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(thisDir, "..", "..", "..");
const PRODUCTION_PACK = resolve(REPO_ROOT, "content", "production", "1880");
const childScript = resolve(thisDir, "..", "dist", "run-child.js");
const LEDGER_YEARS = Array.from({ length: 10 }, (_, index) => 1880 + index);

function compileProductionBundle(): CompiledContentBundle {
  const collector = new DiagnosticCollector();
  const input = buildFullSurfaceInput(
    resolve(PRODUCTION_PACK, "pack.json"),
    PRODUCTION_PACK,
    collector,
  );
  const artifact = input
    ? buildContentBundleArtifact(input, new AbortController().signal, collector)
    : undefined;
  if (!artifact || collector.hasErrors) {
    throw new Error(
      `Production pack compilation failed: ${collector.all.map((d) => d.message).join("; ")}`,
    );
  }
  const decoded = validateAgainstSchema(
    artifact.bundle,
    ContentBundleSchema,
    "ContentBundle",
    "content-artifact.json",
    collector,
  );
  if (decoded === undefined) {
    throw new Error(
      `Production pack bundle is invalid: ${collector.all.map((d) => d.message).join("; ")}`,
    );
  }
  return decoded;
}

function withoutYear(events: readonly ProgressionEvent[], year: number): ProgressionEvent[] {
  return events.filter((event) => event.year !== year);
}

describe("N-3 ledger: availability events by year", () => {
  const bundle = compileProductionBundle();
  const ledger = buildProgressionLedger(bundle);

  it("lists every 1880–1889 event in canonical year/kind/id order", () => {
    expect(ledger.events.length).toBeGreaterThan(0);
    expect(ledger.events.every((event) => LEDGER_YEARS.includes(event.year))).toBe(true);

    const sorted = [...ledger.events].sort(
      (a, b) =>
        a.year - b.year ||
        (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    expect(ledger.events).toEqual(sorted);

    for (const event of ledger.events) {
      expect(event.month.startsWith(`${String(event.year)}-`)).toBe(true);
      expect(event.id.length).toBeGreaterThan(0);
      expect(["component", "part", "technology"]).toContain(event.kind);
    }
  });

  it("surfaces machine-readable provenance flags on every event", () => {
    for (const event of ledger.events) {
      if (event.provenance === null) continue;
      expect(event.provenance.sourceStatus.length).toBeGreaterThan(0);
      expect(event.provenance.confidence.length).toBeGreaterThan(0);
    }
    // The schema has no UNVERIFIED source status; ESTIMATE is the
    // machine-readable flag for a date the content itself marks estimated.
    expect(ledger.events.some((event) => event.provenance?.sourceStatus === "ESTIMATE")).toBe(true);
  });

  it("covers every year 1880–1889 with at least one event", () => {
    expect(idleYears(ledger, LEDGER_YEARS)).toEqual([]);
  });

  it("passes the quiet technology years only through part/component introductions", () => {
    for (const year of [1883, 1884, 1887]) {
      const events = progressionEventsForYear(ledger, year);
      expect(events.length, `year ${String(year)} has no availability event`).toBeGreaterThan(0);
      expect(
        events.every((event) => event.kind === "component" || event.kind === "part"),
        `year ${String(year)} must pass through a part/component introduction`,
      ).toBe(true);
    }
  });

  it("names the idle year when a year's events are removed", () => {
    const pruned = { ...ledger, events: withoutYear(ledger.events, 1885) };
    expect(idleYears(pruned, LEDGER_YEARS)).toEqual([1885]);

    let thrown: unknown;
    try {
      assertNoIdleYears(pruned, LEDGER_YEARS);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(IdleProgressionYearError);
    expect((thrown as IdleProgressionYearError).years).toEqual([1885]);
    expect((thrown as IdleProgressionYearError).message).toContain("1885");
  });

  it("is byte-identical across two fresh processes", () => {
    const run = () =>
      execFileSync(process.execPath, [childScript, "progression-ledger"], {
        encoding: "utf8",
        timeout: 120_000,
        env: { ...process.env, NODE_OPTIONS: "" },
      });
    const first = run();
    const second = run();
    expect(first).toBe(second);
    expect(first.trim().length).toBeGreaterThan(0);
  }, 300_000);
});
