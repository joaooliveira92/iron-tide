import { describe, expect, it } from "vite-plus/test";

import { decodeNavigationRules, navigationOrderingIssues } from "../src/navigation-rules.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [{ title: "Rule the Waves 3 manual", page: "86-88" }],
  note: "PROVISIONAL test fixture",
};

const klass = (grates: number, stokers: number, recovery: number) => ({
  gratesFouledOnsetMinutes: grates,
  stokersExhaustedOnsetMinutes: stokers,
  recoveryMinutes: recovery,
});

const section = {
  sectionVersion: 1,
  fouling: {
    cruiseSpeedPercent: 70,
    classes: {
      OIL: klass(90, 180, 200),
      COAL: klass(60, 120, 150),
      VTE: klass(40, 80, 100),
    },
  },
  breakdown: {
    baseChancePpm: 200,
    priorityChancePpm: 400,
    maxChancePpm: 2_000,
    repairMinutes: 20,
    repairSpeedCapPercent: 50,
  },
  vibration: { thresholdKnots: 25, gunneryMultiplierBp: 9_000 },
  provenance,
};

describe("navigation rules section (#937)", () => {
  it("decodes a complete section", () => {
    const decoded = decodeNavigationRules(section);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.fouling.classes.COAL.gratesFouledOnsetMinutes).toBe(60);
      expect(decoded.value.vibration.thresholdKnots).toBe(25);
    }
  });

  it("rejects excess keys, missing fields and non-integers", () => {
    expect(decodeNavigationRules({ ...section, extra: true }).ok).toBe(false);
    const { provenance: _omitted, ...withoutProvenance } = section;
    expect(decodeNavigationRules(withoutProvenance).ok).toBe(false);
    expect(
      decodeNavigationRules({
        ...section,
        breakdown: { ...section.breakdown, baseChancePpm: 1.5 },
      }).ok,
    ).toBe(false);
    expect(
      decodeNavigationRules({
        ...section,
        fouling: { ...section.fouling, cruiseSpeedPercent: 0 },
      }).ok,
    ).toBe(false);
    expect(
      decodeNavigationRules({
        ...section,
        vibration: { ...section.vibration, gunneryMultiplierBp: 10_001 },
      }).ok,
    ).toBe(false);
  });

  it("accepts the ordered section: oil less sensitive than coal less sensitive than VTE", () => {
    const decoded = decodeNavigationRules(section);
    expect(decoded.ok && navigationOrderingIssues(decoded.value)).toEqual([]);
  });

  it("flags coal fouling no later than oil, and VTE no later than coal", () => {
    const withClasses = (OIL: object, COAL: object, VTE: object) => {
      const decoded = decodeNavigationRules({
        ...section,
        fouling: { ...section.fouling, classes: { OIL, COAL, VTE } },
      });
      if (!decoded.ok) throw new Error(decoded.message);
      return navigationOrderingIssues(decoded.value).map((issue) => issue.field);
    };
    expect(withClasses(klass(60, 120, 150), klass(60, 120, 150), klass(40, 80, 100))).toContain(
      "fouling.classes.COAL.gratesFouledOnsetMinutes",
    );
    expect(withClasses(klass(90, 180, 200), klass(60, 120, 150), klass(60, 120, 150))).toContain(
      "fouling.classes.VTE.gratesFouledOnsetMinutes",
    );
    expect(withClasses(klass(90, 180, 200), klass(60, 120, 150), klass(40, 130, 150))).toContain(
      "fouling.classes.VTE.stokersExhaustedOnsetMinutes",
    );
  });

  it("flags stokers onset not after grates onset, and recovery not longer than onset", () => {
    const decoded = decodeNavigationRules({
      ...section,
      fouling: {
        ...section.fouling,
        classes: { ...section.fouling.classes, OIL: klass(90, 90, 80) },
      },
    });
    if (!decoded.ok) throw new Error(decoded.message);
    const fields = navigationOrderingIssues(decoded.value).map((issue) => issue.field);
    expect(fields).toContain("fouling.classes.OIL.stokersExhaustedOnsetMinutes");
    expect(fields).toContain("fouling.classes.OIL.recoveryMinutes");
  });

  it("flags a breakdown ceiling below the base chance", () => {
    const decoded = decodeNavigationRules({
      ...section,
      breakdown: { ...section.breakdown, maxChancePpm: 100 },
    });
    if (!decoded.ok) throw new Error(decoded.message);
    expect(navigationOrderingIssues(decoded.value).map((issue) => issue.field)).toContain(
      "breakdown.maxChancePpm",
    );
  });
});
