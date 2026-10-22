import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  computeBaseWarheadFlotationDamage,
  computeTorpedoFlotationDamage,
  TORPEDO_FLOTATION_SCALE_EXPONENT,
  TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP,
  TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP,
} from "../../src/torpedoes/index.js";

describe("AC-16: §17 base warhead flotation damage", () => {
  it("computes floor(eqMass × shipped rate) for the model team", () => {
    expect(computeBaseWarheadFlotationDamage(490)).toBe(7_840);
    expect(computeBaseWarheadFlotationDamage(280)).toBe(4_480);
    expect(computeBaseWarheadFlotationDamage(54)).toBe(864);
    expect(computeBaseWarheadFlotationDamage(234)).toBe(3_744);
  });

  it("rejects non-integer / zero / negative masses (fail closed)", () => {
    expect(() => computeBaseWarheadFlotationDamage(490.5)).toThrow(BluewaveError);
    expect(() => computeBaseWarheadFlotationDamage(0)).toThrow(BluewaveError);
    expect(() => computeBaseWarheadFlotationDamage(-5)).toThrow(BluewaveError);
  });
});

describe("AC-16: exact §17 formula + shipped tables", () => {
  it("applies the full formula with one FLOOR over the bigint product", () => {
    expect(
      computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: 10_000,
        protectionLevel: "WEAK",
        impactZone: "EXTREMITY",
      }),
    ).toBe(9_375);
    expect(
      computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: 3,
        protectionLevel: "WEAK",
        impactZone: "EXTREMITY",
      }),
    ).toBe(2);
  });

  it("ships the exact protection-leak table", () => {
    expect(TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP.NONE).toBe(15_000);
    expect(TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP.WEAK).toBe(12_500);
    expect(TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP.STANDARD).toBe(10_000);
    expect(TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP.STRONG).toBe(7_500);
    expect(TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP.ADVANCED).toBe(5_000);
    for (const level of ["NONE", "WEAK", "STANDARD", "STRONG", "ADVANCED"] as const) {
      const damage = computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: 10_000,
        protectionLevel: level,
        impactZone: "CENTRAL",
      });
      expect(damage).toBe(TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP[level]);
    }
  });

  it("ships the exact impact-zone table", () => {
    expect(TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP.EXTREMITY).toBe(7_500);
    expect(TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP.MACHINERY).toBe(12_500);
    expect(TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP.MAGAZINE).toBe(12_500);
    expect(TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP.CENTRAL).toBe(10_000);
    expect(TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP.BREACHED).toBe(15_000);
    expect(TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP.TUBE_BAY).toBe(12_500);
    for (const zone of [
      "EXTREMITY",
      "MACHINERY",
      "MAGAZINE",
      "TUBE_BAY",
      "CENTRAL",
      "BREACHED",
    ] as const) {
      const damage = computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: 100_000_000,
        protectionLevel: "STANDARD",
        impactZone: zone,
      });
      expect(damage).toBe(TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP[zone] * 10_000);
    }
  });

  it("matches the exact §17 denominator (10_000^3) and floors the quotient", () => {
    expect(TORPEDO_FLOTATION_SCALE_EXPONENT).toBe(3);
    expect(
      computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: 1,
        protectionLeakMultiplierBp: 1,
        impactZoneMultiplierBp: 1,
        existingDamageMultiplierBp: 1,
      }),
    ).toBe(0);
    expect(
      computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: 7_999,
        protectionLevel: "STANDARD",
        impactZone: "CENTRAL",
      }),
    ).toBe(7_999);
  });

  it("existingDamageMultiplierBp scales the final value (neutral 10_000 default)", () => {
    const neutral = computeTorpedoFlotationDamage({
      baseWarheadFlotationDamage: 5_000,
      protectionLevel: "STANDARD",
      impactZone: "CENTRAL",
    });
    expect(neutral).toBe(5_000);
    const damaged = computeTorpedoFlotationDamage({
      baseWarheadFlotationDamage: 5_000,
      protectionLevel: "STANDARD",
      impactZone: "CENTRAL",
      existingDamageMultiplierBp: 15_000,
    });
    expect(damaged).toBe(7_500);
  });

  it("the final loss is always a non-negative integer (floor; bigint product)", () => {
    expect(
      computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: 9_000_000_000_000_000,
        protectionLevel: "NONE",
        impactZone: "CENTRAL",
      }),
    ).toBe(13_500_000_000_000_000);
    const small = computeTorpedoFlotationDamage({
      baseWarheadFlotationDamage: 1,
      protectionLevel: "ADVANCED",
      impactZone: "EXTREMITY",
    });
    expect(Number.isInteger(small)).toBe(true);
    expect(small).toBeGreaterThanOrEqual(0);
  });

  it("rejects malformed inputs (fail closed — TORPEDO_STATE_INVARIANT_FAILED)", () => {
    expect(() =>
      computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: -1,
        protectionLevel: "NONE",
        impactZone: "CENTRAL",
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: 1_000,
        protectionLevel: "NONE",
        impactZone: "CENTRAL",
        protectionLeakMultiplierBp: 1.5,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: 1_000,
        protectionLevel: "NONE",
        impactZone: "CENTRAL",
        impactZoneMultiplierBp: 100_001,
      }),
    ).toThrow(BluewaveError);
  });

  it("determinism: identical inputs produce identical losses", () => {
    const a = computeTorpedoFlotationDamage({
      baseWarheadFlotationDamage: 123_456,
      protectionLevel: "STRONG",
      impactZone: "MAGAZINE",
    });
    const b = computeTorpedoFlotationDamage({
      baseWarheadFlotationDamage: 123_456,
      protectionLevel: "STRONG",
      impactZone: "MAGAZINE",
    });
    expect(a).toBe(b);
  });
});
