import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import {
  CANONICAL_TECH_PROFILES,
  STREAM_FAMILY,
  validateTechnologyVariationProfile,
} from "../src/technologyVariation.js";
import { materializeTechnologyVariation } from "../src/technologyMaterialization.js";

function collector() {
  return new DiagnosticCollector();
}
function hasCode(c: DiagnosticCollector, code: string) {
  return c.errors.some((d) => d.code === code);
}
function tech(
  id: string,
  canon = 100,
  prereqs: string[] = [],
  earliest = 0,
  latest = 50000,
  delay: any = 0,
): any {
  return {
    technologyId: id,
    canonicalAvailabilityMonth: canon,
    canonicalEffectValues: { firepower: 100 },
    variationEligible: true,
    dateVariationEligible: true,
    effectivenessVariationEligible: true,
    earliestPermittedAvailabilityMonth: earliest,
    latestPermittedAvailabilityMonth: latest,
    variableEffectIds: ["firepower"],
    prerequisiteTechnologyIds: prereqs,
    prerequisiteDelayMonths: delay,
  };
}
describe("technologyVariation: strict profile", () => {
  it("fails bad streamFamily", () => {
    const c = collector();
    expect(
      validateTechnologyVariationProfile(
        { ...CANONICAL_TECH_PROFILES[1]!, streamFamily: "bad" },
        c,
      ),
    ).toBe(false);
    expect(hasCode(c, "INVALID_TECHNOLOGY_VARIATION_PROFILE")).toBe(true);
  });
  it("fails non-integer shift", () => {
    const c = collector();
    expect(
      validateTechnologyVariationProfile(
        { ...CANONICAL_TECH_PROFILES[1]!, earliestDateShiftMonths: -24.5 as any },
        c,
      ),
    ).toBe(false);
    expect(hasCode(c, "INVALID_TECHNOLOGY_VARIATION_PROFILE")).toBe(true);
  });
  it("fails invalid distribution", () => {
    const c = collector();
    expect(
      validateTechnologyVariationProfile(
        { ...CANONICAL_TECH_PROFILES[0]!, dateDistributionId: "unknown" },
        c,
      ),
    ).toBe(false);
    expect(hasCode(c, "INVALID_TECHNOLOGY_VARIATION_PROFILE")).toBe(true);
  });
  it("none must use constant distributions", () => {
    const c = collector();
    expect(
      validateTechnologyVariationProfile(
        { ...CANONICAL_TECH_PROFILES[0]!, dateDistributionId: "symmetric_triangular_integer_v1" },
        c,
      ),
    ).toBe(false);
    expect(hasCode(c, "INVALID_TECHNOLOGY_VARIATION_PROFILE")).toBe(true);
  });
  it("clones not mutates caller", () => {
    const c = collector();
    const t: any = {
      technologyId: "a",
      canonicalAvailabilityMonth: 100,
      canonicalEffectValues: {},
      variableEffectIds: [],
      prerequisiteTechnologyIds: [],
    };
    const orig = { ...t };
    materializeTechnologyVariation([t], CANONICAL_TECH_PROFILES[0]!, "a".repeat(32), "ch", "rh", c);
    expect(t.variationEligible).toBeUndefined();
    expect(orig.variationEligible).toBeUndefined();
  });
  it("fails invalid delay", () => {
    const c = collector();
    const t = tech("a", 100, [], 0, 50000, -1);
    expect(
      materializeTechnologyVariation(
        [t],
        CANONICAL_TECH_PROFILES[0]!,
        "a".repeat(32),
        "ch",
        "rh",
        c,
      ),
    ).toBeUndefined();
    expect(hasCode(c, "INVALID_TECHNOLOGY_VARIATION_PROFILE")).toBe(true);
  });
  it("deterministic key contains stream family", () => {
    const c = collector();
    const m = materializeTechnologyVariation(
      [tech("a")],
      CANONICAL_TECH_PROFILES[1]!,
      "a".repeat(32),
      "ch",
      "rh",
      c,
    )!;
    expect(m.entries["a"]!.variationDecisionRecordIds[0]).toContain(STREAM_FAMILY);
  });
});
