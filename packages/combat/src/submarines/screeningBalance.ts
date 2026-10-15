//packages/combat/src/submarines/screeningBalance.ts
// DESIGN-34 §18 heavy-ship-to-destroyer screening balance (AC-13, INC-6) + §19
// attack-opportunity selection value-only (AC-14, INC-6).
//
// §18:
//   screenRatioBp = floor(eligibleDestroyerAndEscortStrength * 10_000 /
//     max(1, eligibleHeavyShipStrength))
//   Heavy ships: BB, BC, B, CV, CVL, CA
//   Escorts: DD, KE, ASW-capable CL
//   Opportunity multiplier: ratio <2_500→15_000, 2_500–4_999→12_500,
//     5_000–7_499→10_000, 7_500–9_999→8_500, ≥10_000→7_500
//
// §19: strategic attack-opportunity selection (value-only). Uses policy weights,
//   target availability, intelligence, regional protection, mission strength.
//   Keyed stream: submarine/month/war/area/attack_opportunity.
//   Creates SUBMARINE_ATTACK_OPPORTUNITY_CREATED record. MUST NOT apply loss.
//
// Pure/deterministic: no I/O/clock/random.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { SUBMARINE_BASIS_POINTS_PER_UNIT, type SubmarinePolicy } from "./constants.js";
import {
  SUBMARINE_ATTACK_OPPORTUNITY_CREATED,
  SUBMARINE_STATE_INVARIANT_FAILED,
} from "./reasonCodes.js";

// ---------------------------------------------------------------------------
// §18 heavy-ship types and escort types
// ---------------------------------------------------------------------------

export const SUBMARINE_HEAVY_SHIP_TYPES = ["BB", "BC", "B", "CV", "CVL", "CA"] as const;
export type SubmarineHeavyShipType = (typeof SUBMARINE_HEAVY_SHIP_TYPES)[number];

export const SUBMARINE_ELIGIBLE_ESCORT_TYPES = ["DD", "KE", "CL"] as const;
// DESIGN-34 §18: escorts are eligible DD, KE, and ASW-capable CL. The CL
// ASW-capability distinction is a campaign-world predicate (not modelled here);
// the type set ships the three canonical escort hull types, and the caller
// supplies the ASW-qualified CL filter.

// ---------------------------------------------------------------------------
// §18 screen ratio formula
// ---------------------------------------------------------------------------

export function computeScreenRatioBp(
  eligibleEscortStrength: SafeInt,
  eligibleHeavyShipStrength: SafeInt,
): SafeInt {
  if (!SafeInt.isSafeInt(eligibleEscortStrength) || eligibleEscortStrength < (0 as SafeInt)) {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: "eligible escort strength must be a non-negative safe integer (§18)",
      value: eligibleEscortStrength,
    });
  }
  if (!SafeInt.isSafeInt(eligibleHeavyShipStrength) || eligibleHeavyShipStrength < (0 as SafeInt)) {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: "eligible heavy ship strength must be a non-negative safe integer (§18)",
      value: eligibleHeavyShipStrength,
    });
  }
  const denominator = Math.max(1, eligibleHeavyShipStrength);
  return SafeInt(
    Math.floor((eligibleEscortStrength * SUBMARINE_BASIS_POINTS_PER_UNIT) / denominator),
  );
}

// §18 opportunity multiplier bands (exact shipped values).
const SCREENING_OPPORTUNITY_BANDS: ReadonlyArray<{
  minRatio: number;
  maxRatio: number;
  multiplierBp: number;
}> = [
  { minRatio: 0, maxRatio: 2_499, multiplierBp: 15_000 },
  { minRatio: 2_500, maxRatio: 4_999, multiplierBp: 12_500 },
  { minRatio: 5_000, maxRatio: 7_499, multiplierBp: 10_000 },
  { minRatio: 7_500, maxRatio: 9_999, multiplierBp: 8_500 },
  { minRatio: 10_000, maxRatio: Infinity, multiplierBp: 7_500 },
];

export function screeningOpportunityMultiplierBp(screenRatioBp: SafeInt): SafeInt {
  if (!SafeInt.isSafeInt(screenRatioBp) || screenRatioBp < (0 as SafeInt)) {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: "screen ratio must be a non-negative safe integer (§18)",
      value: screenRatioBp,
    });
  }
  for (const band of SCREENING_OPPORTUNITY_BANDS) {
    if (screenRatioBp >= band.minRatio && screenRatioBp <= band.maxRatio) {
      return SafeInt(band.multiplierBp);
    }
  }
  throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
    code: SUBMARINE_STATE_INVARIANT_FAILED,
    reason: "screen ratio fell outside all §18 opportunity bands",
    value: screenRatioBp,
  });
}

// ---------------------------------------------------------------------------
// §19 attack-opportunity selection (value-only)
// ---------------------------------------------------------------------------

export interface AttackOpportunityInput {
  policyWeightBp: number;
  targetAvailabilityFactorBp: number;
  intelligenceFactorBp: number;
  regionalProtectionFactorBp: number;
  missionStrengthFactorBp: number;
}

export function computeAttackOpportunityValue(input: AttackOpportunityInput): SafeInt {
  const w = input.policyWeightBp;
  const t = input.targetAvailabilityFactorBp;
  const i = input.intelligenceFactorBp;
  const r = input.regionalProtectionFactorBp;
  const m = input.missionStrengthFactorBp;

  if (
    !isNonNegativeBp(w) ||
    !isNonNegativeBp(t) ||
    !isNonNegativeBp(i) ||
    !isNonNegativeBp(r) ||
    !isNonNegativeBp(m)
  ) {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: "all §19 attack-opportunity factors must be basis-point values [0, 20_000]",
      value: { w, t, i, r, m },
    });
  }

  // value = floor(policyWeight × targetAvailability × intelligence ×
  //          regionalProtection × missionStrength / 10_000^4)
  const product = BigInt(w) * BigInt(t) * BigInt(i) * BigInt(r) * BigInt(m);
  const denominator = BigInt(SUBMARINE_BASIS_POINTS_PER_UNIT ** 4);
  return SafeInt(Number(product / denominator));
}

function isNonNegativeBp(v: unknown): v is number {
  return (
    typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v) && v >= 0 && v <= 20_000
  );
}

// Opportunity record (value-only — no loss application).
export interface SubmarineAttackOpportunityRecord {
  opportunityId: string;
  warId: string;
  areaId: string;
  submarineAssetId: string;
  month: SafeInt;
  policyId: SubmarinePolicy;
  opportunityValueBp: SafeInt;
  reasonCode: typeof SUBMARINE_ATTACK_OPPORTUNITY_CREATED;
  streamKey: string;
}

export function createAttackOpportunityRecord(
  opportunityId: string,
  warId: string,
  areaId: string,
  submarineAssetId: string,
  month: SafeInt,
  policyId: SubmarinePolicy,
  opportunityValueBp: SafeInt,
): SubmarineAttackOpportunityRecord {
  if (!opportunityId || opportunityId.length === 0) {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason: "opportunity id must be non-empty",
      value: opportunityId,
    });
  }
  const streamKey = `submarine/${month}/${warId}/${areaId}/attack_opportunity`;
  return {
    opportunityId,
    warId,
    areaId,
    submarineAssetId,
    month,
    policyId,
    opportunityValueBp,
    reasonCode: SUBMARINE_ATTACK_OPPORTUNITY_CREATED,
    streamKey,
  };
}

// Shipped screening-opportunity bands (for contracts).
export const SHIPPED_SCREENING_OPPORTUNITY_BANDS: ReadonlyArray<{
  minRatio: number;
  maxRatio: number;
  multiplierBp: number;
}> = SCREENING_OPPORTUNITY_BANDS;
