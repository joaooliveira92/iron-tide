// AC-16 (DESIGN-40 §17): immediate flotation loss —
//   floor(baseWarheadFlotationDamage * protectionLeakMultiplierBp *
//     impactZoneMultiplierBp * existingDamageMultiplierBp / 10_000^3)
// with the exact shipped protection-leak (15_000/12_500/10_000/7_500/5_000)
// and impact-zone (7_500/12_500/12_500/10_000/15_000) tables. Final loss is a
// non-negative integer; the "never exceeds remaining reserve without a
// sinking/sunk transition" bound is enforced at APPLICATION time through the
// reused resolveStructureFlotation (floor-at-0) + evaluateTerminalSeam
// (SINKING) — the package proofs for that bound live in
// damage-package.test.ts (this file proves the pure formula + tables).
// Determinism: pure integer arithmetic (bigint product, one floor).
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  computeBaseWarheadFlotationDamage,
  computeTorpedoFlotationDamage,
  TORPEDO_FLOTATION_SCALE_EXPONENT,
  TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP,
  TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP,
} from "../../src/torpedoes/index.js";

// The shipped §17 base term: floor(eqMassKg × 16) (authored BALANCE TARGET
// rate; see damageConstants.ts). Type 93 Mod 1 = 490 kg eq.
describe("AC-16: §17 base warhead flotation damage", () => {
  it("computes floor(eqMass × shipped rate) for the model team", () => {
    expect(computeBaseWarheadFlotationDamage(490)).toBe(7_840); // Type 93
    expect(computeBaseWarheadFlotationDamage(280)).toBe(4_480); // G7a/G7e
    expect(computeBaseWarheadFlotationDamage(54)).toBe(864); // Whitehead 18-in
    expect(computeBaseWarheadFlotationDamage(234)).toBe(3_744); // RN 21-in Mk IV
  });

  it("rejects non-integer / zero / negative masses (fail closed)", () => {
    expect(() => computeBaseWarheadFlotationDamage(490.5)).toThrow(BluewaveError);
    expect(() => computeBaseWarheadFlotationDamage(0)).toThrow(BluewaveError);
    expect(() => computeBaseWarheadFlotationDamage(-5)).toThrow(BluewaveError);
  });
});

describe("AC-16: exact §17 formula + shipped tables", () => {
  // The full §17 product is base × leak × zone × existing (the existing term
  // defaults to the neutral 10_000). Neutral scene: base 10_000, WEAK leak
  // (12_500), EXTREMITY zone (7_500):
  //   floor(10_000 × 12_500 × 7_500 × 10_000 / 10_000^3) = floor(9_375) = 9_375
  it("applies the full formula with one FLOOR over the bigint product", () => {
    expect(
      computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: 10_000,
        protectionLevel: "WEAK",
        impactZone: "EXTREMITY",
      }),
    ).toBe(9_375);
    // a fractional quotient proves the single FLOOR:
    // floor(3 × 12_500 × 7_500 × 10_000 / 10_000^3) = floor(2.8125) = 2
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
    // base 10_000 with the neutral CENTRAL zone (10_000) maps the output
    // exactly onto the leak table: 10_000 × leak × 10_000 / 10_000^3 = leak.
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
    // TUBE_BAY: authored BALANCE TARGET at the ordnance-class interior value.
    expect(TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP.TUBE_BAY).toBe(12_500);
    // base 100_000_000 with STANDARD leak (10_000) maps the output exactly
    // onto 10_000 × zone (the neutral existing term carries the 10_000):
    // 10^8 × 10_000 × 10_000 × zone / 10_000^3 = 10_000 × zone.
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
    // base 1 · 1 · 1 / 10_000^3 floors to 0 (the smallest non-negative).
    expect(
      computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: 1,
        protectionLeakMultiplierBp: 1, // raw table bypass — caller-computed
        impactZoneMultiplierBp: 1,
        existingDamageMultiplierBp: 1,
      }),
    ).toBe(0);
    // base 7_999 · 10_000^3 / 10_000^3 = 7_999 (exact boundary).
    expect(
      computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: 7_999,
        protectionLevel: "STANDARD", // 10_000
        impactZone: "CENTRAL", // 10_000
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
    // A huge caller-supplied base beyond Number.MAX_SAFE_INTEGER still works
    // exactly: floor(9e15 × 15_000 × 10_000 × 10_000 / 10_000^3) = 13.5e15.
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
