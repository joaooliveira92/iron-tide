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

const constructionEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "steel_plate_shortage",
  kind: "DELAY",
  probabilityBp: 150,
  minMonths: 1,
  maxMonths: 3,
  pressureMultiplierBp: 20000,
  reasonCode: "STEEL_PLATE_SHORTAGE",
  causeKey: "construction.event.steel_plate_shortage",
  provenance,
  ...overrides,
});

const uiDocument = (keys: readonly string[]): string =>
  jsonDocument({
    locale: "en-US",
    strings: Object.fromEntries(keys.map((key) => [key, key])),
  });

const ALL_KEYS = ["construction.event.steel_plate_shortage"];

function compile(constructionEvents: readonly unknown[], uiKeys: readonly string[] = ALL_KEYS) {
  const dir = mkdtempSync(resolve(tmpdir(), "bw-construction-events-"));
  try {
    mkdirSync(resolve(dir, "ui"), { recursive: true });
    writeFileSync(
      resolve(dir, "pack.json"),
      JSON.stringify({ name: "test-pack", version: "0.4.0", type: "fixture", files: {} }),
    );
    writeFileSync(resolve(dir, "construction-events.json"), jsonDocument(constructionEvents));
    writeFileSync(resolve(dir, "rulesets.json"), jsonDocument([]));
    writeFileSync(resolve(dir, "ui", "en-US.json"), uiDocument(uiKeys));
    const collector = new DiagnosticCollector();
    const output = new Compiler().compile(
      {
        manifestPath: "pack.json",
        contentDir: dir,
        rulesetFiles: [resolve(dir, "rulesets.json")],
        countryFiles: [],
        areaFiles: [],
        routeFiles: [],
        possessionFiles: [],
        portFiles: [],
        technologyFiles: [],
        constructionEventFiles: [resolve(dir, "construction-events.json")],
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

describe("construction event collection through the compiler", () => {
  it("compiles an authored construction event into the campaign bundle", () => {
    const { output, collector } = compile([constructionEvent()]);
    expect(collector.errors).toEqual([]);
    expect(output?.bundle.campaign?.constructionEvents).toHaveLength(1);
  });

  it("orders construction events by id so the bundle does not depend on authoring order", () => {
    const keyed = (id: string) =>
      constructionEvent({ id, causeKey: `construction.event.${id}`, reasonCode: id.toUpperCase() });
    const { output } = compile(
      [keyed("b_event"), keyed("a_event")],
      ["construction.event.b_event", "construction.event.a_event"],
    );
    const ids = (output?.bundle.campaign?.constructionEvents ?? []).map(
      (event) => (event as { id: string }).id,
    );
    expect(ids).toEqual(["a_event", "b_event"]);
  });

  it("omits the section when no construction event is authored", () => {
    const { output } = compile([]);
    expect(output?.bundle.campaign?.constructionEvents).toBeUndefined();
  });

  it("rejects an unknown kind with a schema diagnostic", () => {
    const { output, collector } = compile([constructionEvent({ kind: "STRIKE" })]);
    expect(output).toBeUndefined();
    expect(collector.errors.some((d) => d.code === "SCHEMA")).toBe(true);
  });

  it("rejects a negative probability with a schema diagnostic", () => {
    const { output, collector } = compile([constructionEvent({ probabilityBp: -5 })]);
    expect(output).toBeUndefined();
    expect(collector.errors.some((d) => d.code === "SCHEMA")).toBe(true);
  });

  it("rejects duplicate construction event ids", () => {
    const { output, collector } = compile([constructionEvent(), constructionEvent()]);
    expect(output).toBeUndefined();
    expect(collector.errors.some((d) => d.message.includes("steel_plate_shortage"))).toBe(true);
  });

  it("rejects a cause key that the ui catalogue does not define", () => {
    const { output, collector } = compile([constructionEvent()], []);
    expect(output).toBeUndefined();
    const error = collector.errors.find((d) => d.code === "CONSTRUCTION_EVENT_I18N_MISSING");
    expect(error?.message).toContain("construction.event.steel_plate_shortage");
  });

  describe("delay rows", () => {
    it("rejects an unknown trigger kind with a schema diagnostic", () => {
      const { output, collector } = compile([constructionEvent({ kind: "SABOTAGE" })]);
      expect(output).toBeUndefined();
      expect(collector.errors.some((d) => d.code === "SCHEMA")).toBe(true);
    });

    it("names a schema diagnostic for a negative hold length", () => {
      const { output, collector } = compile([constructionEvent({ minMonths: -1 })]);
      expect(output).toBeUndefined();
      expect(collector.errors.some((d) => d.code === "SCHEMA")).toBe(true);
    });

    it("names a schema diagnostic for a pressure multiplier below one", () => {
      const { output, collector } = compile([constructionEvent({ pressureMultiplierBp: -20000 })]);
      expect(output).toBeUndefined();
      expect(collector.errors.some((d) => d.code === "SCHEMA")).toBe(true);
    });

    it("names a schema diagnostic when minMonths is above maxMonths", () => {
      const { output, collector } = compile([constructionEvent({ minMonths: 4, maxMonths: 2 })]);
      expect(output).toBeUndefined();
      const error = collector.errors.find((d) => d.code === "SCHEMA");
      expect(error?.message).toContain("minMonths must not be above maxMonths");
    });

    it("names a schema diagnostic for a missing hold length", () => {
      const { maxMonths: _max, ...open } = constructionEvent();
      const { output, collector } = compile([open]);
      expect(output).toBeUndefined();
      expect(collector.errors.some((d) => d.code === "SCHEMA")).toBe(true);
    });

    it("names a missing cause text key", () => {
      const { output, collector } = compile([constructionEvent()], []);
      expect(output).toBeUndefined();
      expect(
        collector.errors.some(
          (d) =>
            d.code === "CONSTRUCTION_EVENT_I18N_MISSING" &&
            d.message.includes("construction.event.steel_plate_shortage"),
        ),
      ).toBe(true);
    });
  });

  describe("overrun rows", () => {
    const overrun = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
      id: "design_change_rework",
      kind: "OVERRUN",
      probabilityBp: 120,
      minBp: 200,
      maxBp: 1000,
      capBp: 3000,
      reasonCode: "DESIGN_CHANGE_REWORK",
      causeKey: "construction.event.design_change_rework",
      provenance,
      ...overrides,
    });
    const keys = ["construction.event.design_change_rework"];

    it("compiles a well-formed overrun row", () => {
      const { output, collector } = compile([overrun()], keys);
      expect(collector.errors).toEqual([]);
      expect(output?.bundle.campaign?.constructionEvents).toHaveLength(1);
    });

    it("names a schema diagnostic for a negative magnitude", () => {
      const { output, collector } = compile([overrun({ minBp: -200 })], keys);
      expect(output).toBeUndefined();
      expect(collector.errors.some((d) => d.code === "SCHEMA")).toBe(true);
    });

    it("names a schema diagnostic for an inverted range", () => {
      const { output, collector } = compile([overrun({ minBp: 900, maxBp: 100 })], keys);
      expect(output).toBeUndefined();
      expect(collector.errors.some((d) => d.code === "SCHEMA")).toBe(true);
    });

    it("names a schema diagnostic for a missing cap", () => {
      const { capBp: _cap, ...open } = overrun();
      const { output, collector } = compile([open], keys);
      expect(output).toBeUndefined();
      expect(collector.errors.some((d) => d.code === "SCHEMA")).toBe(true);
    });

    it("names a missing cause text key", () => {
      const { output, collector } = compile([overrun()], []);
      expect(output).toBeUndefined();
      expect(
        collector.errors.some(
          (d) =>
            d.code === "CONSTRUCTION_EVENT_I18N_MISSING" &&
            d.message.includes("construction.event.design_change_rework"),
        ),
      ).toBe(true);
    });
  });
});
