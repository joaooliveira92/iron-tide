//packages/combat/src/torpedoes/flotation.ts
// DESIGN-40 §17 flotation damage (INC-6, AC-16). The exact shipped formula:
//   immediateFlotationLoss = floor(baseWarheadFlotationDamage *
//     protectionLeakMultiplierBp * impactZoneMultiplierBp *
//     existingDamageMultiplierBp / 10_000^3)
// with the shipped protection-leak (15_000/12_500/10_000/7_500/5_000) and
// impact-zone (7_500/12_500/12_500/10_000/15_000) multiplier tables. The final
// loss is non-negative by construction (all terms are non-negative integers);
// the §31 "must not exceed the remaining reserve without a sinking/sunk
// transition" bound is enforced at APPLICATION time by the reused
// resolveStructureFlotation (floor-at-0) + evaluateTerminalSeam (SINKING
// detection when the reserve reaches 0) — damagePackage.ts assembles that
// atomic path. A caller can never end up with a negative reserve.
//
// Bound analysis (ENGINEERING-CONTRACT bigint rule): the raw numerator
// reaches ~10^15 for the largest shipped warhead (490 kg × 16 × 10_000³ ≈
// 7.84e13 < Number.MAX_SAFE_INTEGER), but a caller-supplied base term could
// exceed 9.0e15, so the product is accumulated in bigint and divided ONCE
// (bigint division floors). The floored result is always a safe integer.
//
// Pure/deterministic: fixed integer arithmetic only, no I/O/clock/random.
import { BluewaveError } from "@bluewave/contracts";
import { TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";
import {
  TORPEDO_BASE_FLOTATION_DAMAGE_PER_KG_EQ,
  TORPEDO_EXISTING_DAMAGE_MULTIPLIER_NEUTRAL_BP,
  TORPEDO_FLOTATION_SCALE_EXPONENT,
  TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP,
  TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP,
} from "./damageConstants.js";
import { TORPEDO_BASIS_POINTS_PER_UNIT } from "./constants.js";
import {
  TORPEDO_IMPACT_ZONES,
  type TorpedoImpactZone,
  TORPEDO_TARGET_PROTECTION_LEVELS,
  type TorpedoTargetProtectionLevel,
} from "./detonation.js";

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

function assertMultiplierBp(field: string, v: unknown): asserts v is number {
  if (!isInt(v) || v < 0 || v > 100_000)
    invariant(field, v, "an integer basis-point multiplier within [0, 100_000] is required");
}

// AC-16: the base warhead flotation damage from the authoritative
// explosive-equivalent mass (kg TNT-equivalent) — the §17 formula's first
// term. The conversion rate is an authored BALANCE TARGET constant (see
// damageConstants.ts): floor(eqMassKg * TORPEDO_BASE_FLOTATION_DAMAGE_PER_KG_EQ).
export function computeBaseWarheadFlotationDamage(
  warheadExplosiveEquivalentMassKg: number,
): number {
  if (!isInt(warheadExplosiveEquivalentMassKg) || warheadExplosiveEquivalentMassKg <= 0)
    invariant(
      "warheadExplosiveEquivalentMassKg",
      warheadExplosiveEquivalentMassKg,
      "warhead explosive-equivalent mass must be a positive integer kg",
    );
  // floor(eqMassKg × TORPEDO_BASE_FLOTATION_DAMAGE_PER_KG_EQ) — the authored
  // unit rate is integer (scale 1 kg -> 16 reserve-units), so the product is
  // already an integer; the explicit floor documents the shipped rounding.
  return Math.floor(warheadExplosiveEquivalentMassKg * TORPEDO_BASE_FLOTATION_DAMAGE_PER_KG_EQ);
}

// AC-16: the exact §17 flotation-loss formula. Multipliers may be passed as
// the canonical zone/protection (the shipped table is authoritative) or as
// raw integer bp (the caller-computed surface — e.g. a ruleset that already
// resolved a non-shipped value); each input validates fail-closed.
export function computeTorpedoFlotationDamage(o: {
  baseWarheadFlotationDamage: number; // integer, non-negative
  protectionLevel?: TorpedoTargetProtectionLevel;
  protectionLeakMultiplierBp?: number;
  impactZone?: TorpedoImpactZone;
  impactZoneMultiplierBp?: number;
  existingDamageMultiplierBp?: number;
}): number {
  if (!isInt(o.baseWarheadFlotationDamage) || o.baseWarheadFlotationDamage < 0)
    invariant(
      "baseWarheadFlotationDamage",
      o.baseWarheadFlotationDamage,
      "base warhead flotation damage must be a non-negative integer",
    );
  if (o.protectionLevel !== undefined) {
    if (!(TORPEDO_TARGET_PROTECTION_LEVELS as readonly string[]).includes(o.protectionLevel))
      invariant("protectionLevel", o.protectionLevel, "protection must be a canonical §17 level");
  }
  if (o.impactZone !== undefined) {
    if (!(TORPEDO_IMPACT_ZONES as readonly string[]).includes(o.impactZone))
      invariant("impactZone", o.impactZone, "impact zone must be a canonical §17 zone");
  }
  const protectionBp =
    o.protectionLeakMultiplierBp ??
    (o.protectionLevel !== undefined
      ? TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP[o.protectionLevel]
      : invariant(
          "protectionLeakMultiplierBp",
          undefined,
          "either the protection level or the raw multiplier is required",
        ));
  const zoneBp =
    o.impactZoneMultiplierBp ??
    (o.impactZone !== undefined
      ? TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP[o.impactZone]
      : invariant(
          "impactZoneMultiplierBp",
          undefined,
          "either the impact zone or the raw multiplier is required",
        ));
  const existingBp = o.existingDamageMultiplierBp ?? TORPEDO_EXISTING_DAMAGE_MULTIPLIER_NEUTRAL_BP;
  assertMultiplierBp("protectionLeakMultiplierBp", protectionBp);
  assertMultiplierBp("impactZoneMultiplierBp", zoneBp);
  assertMultiplierBp("existingDamageMultiplierBp", existingBp);

  const numerator =
    BigInt(o.baseWarheadFlotationDamage) *
    BigInt(protectionBp) *
    BigInt(zoneBp) *
    BigInt(existingBp);
  const denominator =
    BigInt(TORPEDO_BASIS_POINTS_PER_UNIT) ** BigInt(TORPEDO_FLOTATION_SCALE_EXPONENT);
  const raw = Number(numerator / denominator); // bigint division floors
  // Non-negative by construction (all terms >= 0); the explicit floor guard
  // is the shipped contract (final loss MUST be a non-negative integer).
  return Math.max(0, raw);
}
