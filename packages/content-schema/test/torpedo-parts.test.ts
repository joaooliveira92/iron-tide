import { describe, expect, it } from "vite-plus/test";

import { FlattenedPartSchema, PartSchema } from "../src/index.js";
import { decodeIssue, decodeOk } from "./decode-helpers.js";

const provenance = {
  sourceStatus: "VERIFIED",
  confidence: "HIGH",
  kind: "historical_fact",
  sources: [{ title: "test source" }],
};

const TORPEDO_SPEC = {
  diameterUm: 356_000,
  massKg: 300,
  warheadType: "WET_GUNCOTTON",
  warheadExplosiveMassKg: 12,
  warheadExplosiveEquivalentMassKg: 12,
  propulsionType: "COMPRESSED_AIR",
  speedSettings: [{ settingId: "s1", speedMilliKnots: 25_000, rangeM: 550 }],
  minimumArmingDistanceM: 25,
  reliabilityBp: 88_000,
  guidanceCapability: "none",
  launchTypes: ["ABOVE_WATER_FIXED", "ABOVE_WATER_TRAINABLE", "UNDERWATER_FIXED"],
  technologyPrerequisiteIds: [],
  tubeHitHazardPolicy: "ORDINARY",
};

const AUTHORED = {
  id: "whitehead_14in_1886",
  family: "torpedo",
  provides: "torpedo",
  name: "Whitehead 14-inch",
  lifecycle: { availableFrom: "1880-01" },
  spec: TORPEDO_SPEC,
  quantities: [{ id: "torpedo_mass", kind: "massKg", value: 300, basis: "PER_PART_UNIT" }],
  revisions: [
    {
      from: "1884-01",
      spec: { warheadExplosiveMassKg: 27, warheadExplosiveEquivalentMassKg: 27 },
      provenance,
    },
  ],
  provenance,
};

const withSpec = (spec: Record<string, unknown>) => ({ ...AUTHORED, spec });
const withAuthored = (patch: Record<string, unknown>) => ({ ...AUTHORED, ...patch });

describe("the torpedo part schema (SPM-R17)", () => {
  it("strictly decodes a valid torpedo part", () => {
    expect(decodeOk(PartSchema, AUTHORED)).toBe(true);
  });

  it("rejects an unknown top-level field", () => {
    expect(decodeIssue(PartSchema, withAuthored({ torpedoModel: "whitehead_14in" }))).not.toBe("");
  });

  it("rejects an unknown spec field", () => {
    expect(decodeIssue(PartSchema, withSpec({ ...TORPEDO_SPEC, warheadLb: 60 }))).not.toBe("");
  });

  it.each([
    ["warhead type", { warheadType: "CORDITE" }],
    ["propulsion type", { propulsionType: "NUCLEAR" }],
    ["tube-hit hazard policy", { tubeHitHazardPolicy: "MAGNETIC" }],
    ["launch type", { launchTypes: ["TRAINABLE_SIDE"] }],
    ["empty launch types", { launchTypes: [] }],
    ["an empty speed-settings list", { speedSettings: [] }],
    [
      "a negative range",
      { speedSettings: [{ settingId: "s2", speedMilliKnots: 25_000, rangeM: -1 }] },
    ],
    ["a zero speed", { speedSettings: [{ settingId: "s3", speedMilliKnots: 0, rangeM: 550 }] }],
    [
      "an invalid setting id",
      { speedSettings: [{ settingId: "26-5kn", speedMilliKnots: 25_000, rangeM: 550 }] },
    ],
    ["reliability above the per-100,000 scale", { reliabilityBp: 100_001 }],
    ["a missing required field", { guidanceCapability: undefined }],
  ])("rejects %s", (_case, patch) => {
    expect(decodeIssue(PartSchema, withSpec({ ...TORPEDO_SPEC, ...patch }))).not.toBe("");
  });

  it("rejects a quantity component with an unknown kind", () => {
    expect(
      decodeIssue(
        PartSchema,
        withAuthored({
          quantities: [{ id: "x", kind: "torpedoMass", value: 1, basis: "PER_PART_UNIT" }],
        }),
      ),
    ).not.toBe("");
  });

  it("rejects a quantity component with an unknown basis", () => {
    expect(
      decodeIssue(
        PartSchema,
        withAuthored({ quantities: [{ id: "x", kind: "massKg", value: 1, basis: "PER_TORPEDO" }] }),
      ),
    ).not.toBe("");
  });

  it("carries the oxygen wake modifier only as an optional field", () => {
    expect(
      decodeOk(PartSchema, withSpec({ ...TORPEDO_SPEC, oxygenWakeVisibilityModifierBp: 2_500 })),
    ).toBe(true);
  });

  it("decodes as a flattened part with the full spec and sorted revisions", () => {
    expect(
      decodeOk(FlattenedPartSchema, {
        ...AUTHORED,
        origin: { sourceFile: "ship-building/parts/torpedo.yaml" },
      }),
    ).toBe(true);
  });
});
