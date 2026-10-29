import {
  FlattenedPartSchema,
  LoadoutSchema,
  PlatformSchema,
  SlotTemplateSchema,
  decodeStrict,
  decodeStrictResult,
  type FlattenedPart,
  type NestedLoadoutEntry,
} from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import { validateLoadoutFit, type FitInput } from "../src/partFit.js";

const PROVENANCE = {
  sourceStatus: "PLACEHOLDER",
  confidence: "LOW",
  kind: "game_conversion",
  sources: [],
  note: "ticket 11a fixture",
} as const;

const part = (): FlattenedPart =>
  decodeStrict(FlattenedPartSchema, {
    id: "funnel_a",
    name: "Funnel",
    family: "fitting",
    provides: "funnel",
    lifecycle: { availableFrom: "1880-01", availableUntil: null },
    spec: {},
    quantities: [],
    revisions: [],
    origin: { sourceFile: "fixture.json" },
    provenance: PROVENANCE,
  });

const template = decodeStrict(SlotTemplateSchema, {
  id: "t",
  slots: [{ id: "deck.funnel", accepts: ["funnel"], mountCount: { min: 0, max: 4 } }],
});

const platform = (extra: Record<string, unknown> = {}) =>
  decodeStrict(PlatformSchema, { id: "p", hullForm: "h", slotTemplates: ["t"], ...extra });

const input = (
  entries: unknown[],
  platformExtra: Record<string, unknown> = {},
  month = "1885-06",
): FitInput => ({
  catalogue: { parts: [part()], slotTemplates: [template], platforms: [platform(platformExtra)] },
  loadout: decodeStrict(LoadoutSchema, { platform: "p", entries }),
  month,
});

const entry = (extra: Record<string, unknown> = {}) => ({
  slot: "deck.funnel",
  part: "funnel_a",
  ...extra,
});

describe("platform availability windows", () => {
  const window = { lifecycle: { availableFrom: "1890-01", availableUntil: "1900-01" } };

  it("a platform not yet available is a finding", () => {
    const r = validateLoadoutFit(input([entry()], window, "1885-06"));
    expect(r.status).toBe("REJECTED");
    expect(r.findings.map((f) => f.code)).toEqual(["FIT_PLATFORM_NOT_YET_AVAILABLE"]);
    expect(r.findings[0]?.detail).toMatchObject({ availableFrom: "1890-01" });
  });

  it("availableUntil is exclusive", () => {
    expect(validateLoadoutFit(input([entry()], window, "1899-12")).status).toBe("ACCEPTED");
    const r = validateLoadoutFit(input([entry()], window, "1900-01"));
    expect(r.findings.map((f) => f.code)).toEqual(["FIT_PLATFORM_UNAVAILABLE"]);
  });

  it("a platform with no window is always available", () => {
    expect(validateLoadoutFit(input([entry()], {}, "1880-01")).status).toBe("ACCEPTED");
  });
});

describe("loadout-entry identity", () => {
  it("accepts distinct ids", () => {
    const r = validateLoadoutFit(input([entry({ id: "f1" }), entry({ id: "f2" })]));
    expect(r.status).toBe("ACCEPTED");
  });

  it("a duplicate id is a data issue naming both paths", () => {
    const r = validateLoadoutFit(input([entry({ id: "f1" }), entry({ id: "f1" })]));
    expect(r.status).toBe("NOT_EVALUABLE");
    expect(r.dataIssues.map((d) => d.code)).toEqual(["FIT_DATA_DUPLICATE_ENTRY_ID"]);
  });

  it("an id must be lower snake_case at decode", () => {
    const decoded = decodeStrictResult(LoadoutSchema, {
      platform: "p",
      entries: [entry({ id: "Not Ok" })],
    });
    expect(decoded._tag).toBe("Failure");
  });

  it("an in-memory containment cycle is a data issue, not a stack overflow", () => {
    const loop: { part: string; entries?: Record<string, NestedLoadoutEntry[]> } = {
      part: "funnel_a",
    };
    loop.entries = { "deck.funnel": [loop] };
    const base = input([]);
    const r = validateLoadoutFit({
      ...base,
      loadout: { platform: "p", entries: [{ slot: "deck.funnel", ...loop }] },
    });
    expect(r.dataIssues.map((d) => d.code)).toEqual(["FIT_DATA_ENTRY_CYCLE"]);
  });
});

describe("unlocked-technology requirements", () => {
  it("is evaluated when the caller supplies the unlocked set", () => {
    const gated = decodeStrict(FlattenedPartSchema, {
      ...part(),
      lifecycle: { availableFrom: "1880-01", requires: ["tech_x"] },
    });
    const base = input([entry()]);
    const locked = validateLoadoutFit({
      ...base,
      catalogue: { ...base.catalogue, parts: [gated] },
      conditions: { unlockedTechnologies: [] },
    });
    expect(locked.findings.map((f) => f.code)).toEqual(["FIT_TECHNOLOGY_LOCKED"]);
    const open = validateLoadoutFit({
      ...base,
      catalogue: { ...base.catalogue, parts: [gated] },
      conditions: { unlockedTechnologies: ["tech_x"] },
    });
    expect(open.status).toBe("ACCEPTED");
  });
});
