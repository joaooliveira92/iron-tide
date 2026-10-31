import { DiagnosticCollector } from "@bluewave/diagnostics";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { Compiler } from "../src/index.js";

const jsonDocument = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "PROVISIONAL authoring fixture",
};

const answer = (
  id: string,
  stance: string,
  effects: Record<string, unknown>,
): Record<string, unknown> => ({
  id,
  stance,
  labelKey: `event.scare.${id}`,
  effects: { budgetBp: 0, unrest: 0, ...effects },
});

const eventRecord = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "scare",
  titleKey: "event.scare.title",
  bodyKey: "event.scare.body",
  gates: {},
  weightBp: 100,
  cooldownMonths: 24,
  once: false,
  defaultAnswerId: "hold",
  answers: [
    answer("arm", "hawk", { budgetBp: 100, setFlag: "armed" }),
    answer("hold", "dove", { budgetBp: -100 }),
  ],
  provenance,
  ...overrides,
});

const uiDocument = (keys: readonly string[]): string =>
  jsonDocument({
    locale: "en-US",
    strings: Object.fromEntries(keys.map((key) => [key, key])),
  });

const ALL_KEYS = ["event.scare.title", "event.scare.body", "event.scare.arm", "event.scare.hold"];

function compile(events: readonly unknown[], uiKeys: readonly string[] = ALL_KEYS) {
  const dir = mkdtempSync(resolve(tmpdir(), "bw-events-"));
  try {
    mkdirSync(resolve(dir, "ui"), { recursive: true });
    writeFileSync(
      resolve(dir, "pack.json"),
      JSON.stringify({ name: "test-pack", version: "0.4.0", type: "fixture", files: {} }),
    );
    writeFileSync(resolve(dir, "events.json"), jsonDocument(events));
    writeFileSync(resolve(dir, "ui", "en-US.json"), uiDocument(uiKeys));
    const collector = new DiagnosticCollector();
    const output = new Compiler().compile(
      {
        manifestPath: "pack.json",
        contentDir: dir,
        rulesetFiles: [],
        countryFiles: [],
        areaFiles: [],
        routeFiles: [],
        possessionFiles: [],
        portFiles: [],
        technologyFiles: [],
        eventFiles: [resolve(dir, "events.json")],
        uiFiles: [resolve(dir, "ui", "en-US.json")],
      },
      new AbortController().signal,
      collector,
    );
    return { output, collector };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("event collection through the compiler", () => {
  it("compiles an authored event into the campaign bundle", () => {
    const { output, collector } = compile([eventRecord()]);
    expect(collector.errors).toEqual([]);
    expect(output?.bundle.campaign?.events).toHaveLength(1);
  });

  it("orders events by id so the bundle does not depend on authoring order", () => {
    const labelled = (id: string) =>
      eventRecord({
        id,
        titleKey: `event.${id}.title`,
        bodyKey: `event.${id}.body`,
        answers: [
          { ...answer("arm", "hawk", {}), labelKey: `event.${id}.arm` },
          { ...answer("hold", "dove", {}), labelKey: `event.${id}.hold` },
        ],
      });
    const keys = ["b", "a"].flatMap((id) => [
      `event.${id}.title`,
      `event.${id}.body`,
      `event.${id}.arm`,
      `event.${id}.hold`,
    ]);
    const { output } = compile([labelled("b"), labelled("a")], keys);
    const ids = (output?.bundle.campaign?.events ?? []).map(
      (event) => (event as { id: string }).id,
    );
    expect(ids).toEqual(["a", "b"]);
  });

  it("rejects an event that breaks the answer rules with a schema diagnostic", () => {
    const { output, collector } = compile([eventRecord({ answers: [answer("arm", "hawk", {})] })]);
    expect(output).toBeUndefined();
    expect(collector.errors.some((d) => d.code === "SCHEMA")).toBe(true);
  });

  it("rejects duplicate event ids", () => {
    const { output, collector } = compile([eventRecord(), eventRecord()]);
    expect(output).toBeUndefined();
    expect(collector.errors.some((d) => d.message.includes("scare"))).toBe(true);
  });

  it.each(["event.scare.title", "event.scare.body", "event.scare.arm", "event.scare.hold"])(
    "rejects an event whose i18n key %s is missing from the ui catalogue",
    (missing) => {
      const { output, collector } = compile(
        [eventRecord()],
        ALL_KEYS.filter((key) => key !== missing),
      );
      expect(output).toBeUndefined();
      const error = collector.errors.find((d) => d.code === "EVENT_I18N_MISSING");
      expect(error?.message).toContain(missing);
    },
  );

  it("rejects a gate on a flag that no answer sets", () => {
    const { output, collector } = compile([
      eventRecord({ gates: { requiredFlags: ["never_set"] } }),
    ]);
    expect(output).toBeUndefined();
    const error = collector.errors.find((d) => d.code === "EVENT_FLAG_UNKNOWN");
    expect(error?.message).toContain("never_set");
  });

  it("accepts a gate on a flag that an answer of another event sets", () => {
    const follow = eventRecord({
      id: "follow_up",
      titleKey: "event.scare.title",
      gates: { requiredFlags: ["armed"] },
    });
    const { collector } = compile([eventRecord(), follow]);
    expect(collector.errors.filter((d) => d.code === "EVENT_FLAG_UNKNOWN")).toEqual([]);
  });
});
