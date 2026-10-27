import { describe, expect, it } from "vite-plus/test";

import { decodeMissilesRules } from "../src/missiles-rules.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [{ title: "Rule the Waves 3 manual", page: "121-123" }],
  note: "test",
};

const classRules = {
  rangeM: 30_000,
  flightTimeSeconds: 90,
  salvoSize: 2,
  baseHitBp: 3_500,
  structuralDamage: 1_800,
  flotationDamage: 900,
  defenceInterceptBp: 2_500,
  maxSalvosPerBattle: 4,
};

const section = {
  sectionVersion: 1,
  classes: {
    light_ssm: classRules,
    medium_ssm: classRules,
    heavy_ssm: classRules,
  },
  provenance,
};

describe("missiles rules section (#293)", () => {
  it("decodes the three SSM class blocks", () => {
    const decoded = decodeMissilesRules(section);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.classes.light_ssm.rangeM).toBe(30_000);
      expect(decoded.value.classes.medium_ssm.salvoSize).toBe(2);
      expect(decoded.value.classes.heavy_ssm.maxSalvosPerBattle).toBe(4);
    }
  });

  it("rejects an unknown class or excess key at the boundary", () => {
    expect(decodeMissilesRules({ ...section, extra: true }).ok).toBe(false);
    expect(
      decodeMissilesRules({
        ...section,
        classes: { ...section.classes, orbital: classRules },
      }).ok,
    ).toBe(false);
  });

  it("rejects a hit probability outside basis points and a non-positive range", () => {
    expect(
      decodeMissilesRules({
        ...section,
        classes: {
          ...section.classes,
          heavy_ssm: { ...classRules, baseHitBp: 10_001 },
        },
      }).ok,
    ).toBe(false);
    expect(
      decodeMissilesRules({
        ...section,
        classes: {
          ...section.classes,
          heavy_ssm: { ...classRules, rangeM: 0 },
        },
      }).ok,
    ).toBe(false);
  });
});
