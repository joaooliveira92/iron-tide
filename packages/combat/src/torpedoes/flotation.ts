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

export function computeBaseWarheadFlotationDamage(
  warheadExplosiveEquivalentMassKg: number,
): number {
  if (!isInt(warheadExplosiveEquivalentMassKg) || warheadExplosiveEquivalentMassKg <= 0)
    invariant(
      "warheadExplosiveEquivalentMassKg",
      warheadExplosiveEquivalentMassKg,
      "warhead explosive-equivalent mass must be a positive integer kg",
    );
  return Math.floor(warheadExplosiveEquivalentMassKg * TORPEDO_BASE_FLOTATION_DAMAGE_PER_KG_EQ);
}

export function computeTorpedoFlotationDamage(o: {
  baseWarheadFlotationDamage: number;
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
  const raw = Number(numerator / denominator);
  return Math.max(0, raw);
}
