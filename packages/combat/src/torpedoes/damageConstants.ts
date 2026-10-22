import { BluewaveError } from "@bluewave/contracts";
import { TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";
import {
  FLOODING_ISOLATION_STATES,
  type FloodingIsolationState,
  type TubeHitHazardPolicy,
} from "./constants.js";
import {
  TORPEDO_IMPACT_ZONES,
  type TorpedoImpactZone,
  TORPEDO_TARGET_PROTECTION_LEVELS,
  type TorpedoTargetProtectionLevel,
} from "./detonation.js";

export const torpedoDamagePolicyId = "torpedo_damage_v1" as const;

export const TORPEDO_FLOTATION_SCALE_EXPONENT = 3 as const;
export const TORPEDO_FLOTATION_ROUNDING = "floor" as const;
export const TORPEDO_FLOTATION_MIN_BP = 0 as const;
export const TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP: Record<TorpedoTargetProtectionLevel, number> = {
  NONE: 15_000,
  WEAK: 12_500,
  STANDARD: 10_000,
  STRONG: 7_500,
  ADVANCED: 5_000,
};
export const TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP: Record<TorpedoImpactZone, number> = {
  EXTREMITY: 7_500,
  MACHINERY: 12_500,
  MAGAZINE: 12_500,
  TUBE_BAY: 12_500,
  CENTRAL: 10_000,
  BREACHED: 15_000,
};
export const TORPEDO_BASE_FLOTATION_DAMAGE_PER_KG_EQ = 16 as const;
export const TORPEDO_STRUCTURAL_DAMAGE_PER_KG_EQ = 48 as const;

export const TORPEDO_EXISTING_DAMAGE_MULTIPLIER_NEUTRAL_BP = 10_000 as const;

export const TORPEDO_FLOODING_SCALE_EXPONENT = 4 as const;
export const TORPEDO_FLOODING_ROUNDING = "floor" as const;
export const TORPEDO_FLOODING_ISOLATION_MULTIPLIER_BP: Record<FloodingIsolationState, number> = {
  INTACT: 5_000,
  DEGRADED: 10_000,
  FAILED: 15_000,
};
export const TORPEDO_BASE_BREACH_RATE_KG_MIN_PER_M2 = 1_000 as const;
export const TORPEDO_FLOODING_NEUTRAL_MULTIPLIER_BP = 10_000 as const;

export const TORPEDO_SEAWATER_DENSITY_KG_PER_M3 = 1_000 as const;
export const TORPEDO_IMMEDIATE_FLOODING_MIN_DEPTH_M = 1 as const;

export const TORPEDO_MACHINERY_SEVERITIES = [
  "NO_EFFECT",
  "DEGRADED_PROPULSION",
  "MAJOR_PROPULSION_LOSS",
  "DEAD_IN_WATER",
  "CATASTROPHIC_MACHINERY_LOSS",
] as const;
export type TorpedoMachinerySeverity = (typeof TORPEDO_MACHINERY_SEVERITIES)[number];
export const TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP: Record<TorpedoMachinerySeverity, number> = {
  NO_EFFECT: 1_000,
  DEGRADED_PROPULSION: 4_000,
  MAJOR_PROPULSION_LOSS: 3_000,
  DEAD_IN_WATER: 1_500,
  CATASTROPHIC_MACHINERY_LOSS: 500,
};
export const TORPEDO_NON_MACHINERY_ELIGIBILITY_BP = 2_500 as const;
export function torpedoMachineryEligibilityBp(zone: TorpedoImpactZone): number {
  if (!(TORPEDO_IMPACT_ZONES as readonly string[]).includes(zone))
    throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
      code: TORPEDO_STATE_INVARIANT_FAILED,
      field: "zone",
      reason: "impact zone must be a canonical §17 zone",
      value: zone,
    });
  return zone === "MACHINERY" ? 10_000 : TORPEDO_NON_MACHINERY_ELIGIBILITY_BP;
}

export const TORPEDO_SYSTEM_SHOCK_BANDS = ["PRIMARY", "SECONDARY", "OUTSIDE"] as const;
export type TorpedoSystemShockBand = (typeof TORPEDO_SYSTEM_SHOCK_BANDS)[number];
export const TORPEDO_SYSTEM_SHOCK_BASE_BP: Record<TorpedoSystemShockBand, number> = {
  PRIMARY: 3_000,
  SECONDARY: 1_000,
  OUTSIDE: 0,
};

export const TORPEDO_TUBE_SEVERE_FLOODING_BUDGET_BP = 5_000 as const;
export const TORPEDO_TUBE_EXTRA_SOURCE_RATE_MULTIPLIER_BP = 15_000 as const;
export const TORPEDO_TUBE_CREW_CASUALTY_BASE_BP = 5_000 as const;
export const TORPEDO_TUBE_CREW_CASUALTY_SHARE_BP = 2_500 as const;

export const TORPEDO_CHAIN_REACTION_BASE_BP: Record<TubeHitHazardPolicy, number> = {
  ORDINARY: 1_500,
  OXYGEN: 3_000,
  ELECTRIC: 1_000,
};
export const TORPEDO_CHAIN_REACTION_MODIFIER_KEYS = [
  "isolation",
  "flooding",
  "protection",
  "fireIntensity",
  "existingDamage",
] as const;
export type TorpedoChainReactionModifierKey = (typeof TORPEDO_CHAIN_REACTION_MODIFIER_KEYS)[number];
export const TORPEDO_CHAIN_REACTION_NEUTRAL_MODIFIER_BP = 10_000 as const;
export const TORPEDO_CHAIN_REACTION_SCALE_EXPONENT = 5 as const;

export interface TorpedoDamageContract {
  policyId: string;
  flotationScaleExponent: number;
  flotationRounding: string;
  baseFlotationDamagePerKgEq: number;
  structuralDamagePerKgEq: number;
  protectionLeakMultiplierBp: Record<TorpedoTargetProtectionLevel, number>;
  impactZoneFlotationMultiplierBp: Record<TorpedoImpactZone, number>;
  floodingScaleExponent: number;
  floodingRounding: string;
  floodingIsolationMultiplierBp: Record<FloodingIsolationState, number>;
  baseBreachRateKgMinPerM2: number;
  seawaterDensityKgPerM3: number;
  immediateFloodingMinDepthM: number;
  machinerySeverityWeightsBp: Record<TorpedoMachinerySeverity, number>;
  nonMachineryEligibilityBp: number;
  tubeCrewCasualtyBaseBp: number;
  tubeCrewCasualtyShareBp: number;
  systemShockBands: readonly TorpedoSystemShockBand[];
  systemShockBaseBp: Record<TorpedoSystemShockBand, number>;
}

export const SHIPPED_TORPEDO_DAMAGE_CONTRACT: TorpedoDamageContract = {
  policyId: torpedoDamagePolicyId,
  flotationScaleExponent: TORPEDO_FLOTATION_SCALE_EXPONENT,
  flotationRounding: TORPEDO_FLOTATION_ROUNDING,
  baseFlotationDamagePerKgEq: TORPEDO_BASE_FLOTATION_DAMAGE_PER_KG_EQ,
  structuralDamagePerKgEq: TORPEDO_STRUCTURAL_DAMAGE_PER_KG_EQ,
  protectionLeakMultiplierBp: TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP,
  impactZoneFlotationMultiplierBp: TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP,
  floodingScaleExponent: TORPEDO_FLOODING_SCALE_EXPONENT,
  floodingRounding: TORPEDO_FLOODING_ROUNDING,
  floodingIsolationMultiplierBp: TORPEDO_FLOODING_ISOLATION_MULTIPLIER_BP,
  baseBreachRateKgMinPerM2: TORPEDO_BASE_BREACH_RATE_KG_MIN_PER_M2,
  seawaterDensityKgPerM3: TORPEDO_SEAWATER_DENSITY_KG_PER_M3,
  immediateFloodingMinDepthM: TORPEDO_IMMEDIATE_FLOODING_MIN_DEPTH_M,
  machinerySeverityWeightsBp: TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP,
  nonMachineryEligibilityBp: TORPEDO_NON_MACHINERY_ELIGIBILITY_BP,
  tubeCrewCasualtyBaseBp: TORPEDO_TUBE_CREW_CASUALTY_BASE_BP,
  tubeCrewCasualtyShareBp: TORPEDO_TUBE_CREW_CASUALTY_SHARE_BP,
  systemShockBands: TORPEDO_SYSTEM_SHOCK_BANDS,
  systemShockBaseBp: TORPEDO_SYSTEM_SHOCK_BASE_BP,
};

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function recordEquals(
  a: Record<string, number> | null | undefined,
  b: Record<string, number>,
): boolean {
  if (!a) return false;
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (!arrayEquals(aKeys, bKeys)) return false;
  return bKeys.every((k) => a[k] === b[k]);
}

export function validateTorpedoDamageContract(
  c: Partial<TorpedoDamageContract> | null | undefined,
): asserts c is TorpedoDamageContract {
  if (!c) throwMismatch(c, "torpedo_v1 damage contract missing");
  if (c.policyId !== torpedoDamagePolicyId)
    throwMismatch(c, "torpedo_v1 damage contract policy id");
  if (c.flotationScaleExponent !== TORPEDO_FLOTATION_SCALE_EXPONENT)
    throwMismatch(c, "torpedo_v1 §17 flotation scale exponent (10_000^3)");
  if (c.flotationRounding !== TORPEDO_FLOTATION_ROUNDING)
    throwMismatch(c, "torpedo_v1 §17 flotation rounding (floor)");
  if (c.baseFlotationDamagePerKgEq !== TORPEDO_BASE_FLOTATION_DAMAGE_PER_KG_EQ)
    throwMismatch(c, "torpedo_v1 §17 base flotation damage per kg TNT-equivalent (16)");
  if (c.structuralDamagePerKgEq !== TORPEDO_STRUCTURAL_DAMAGE_PER_KG_EQ)
    throwMismatch(c, "torpedo_v1 structural damage per kg TNT-equivalent (48)");
  if (!c.protectionLeakMultiplierBp)
    throwMismatch(c, "torpedo_v1 §17 protection-leak table missing");
  for (const level of TORPEDO_TARGET_PROTECTION_LEVELS) {
    if (c.protectionLeakMultiplierBp[level] !== TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP[level])
      throwMismatch(c, `torpedo_v1 §17 protection-leak multiplier for ${level}`);
  }
  if (!c.impactZoneFlotationMultiplierBp)
    throwMismatch(c, "torpedo_v1 §17 impact-zone flotation table missing");
  for (const zone of TORPEDO_IMPACT_ZONES) {
    if (
      c.impactZoneFlotationMultiplierBp[zone] !== TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP[zone]
    )
      throwMismatch(c, `torpedo_v1 §17 impact-zone flotation multiplier for ${zone}`);
  }
  if (c.floodingScaleExponent !== TORPEDO_FLOODING_SCALE_EXPONENT)
    throwMismatch(c, "torpedo_v1 §18 flooding scale exponent (10_000^4)");
  if (c.floodingRounding !== TORPEDO_FLOODING_ROUNDING)
    throwMismatch(c, "torpedo_v1 §18 flooding rounding (floor)");
  if (!c.floodingIsolationMultiplierBp)
    throwMismatch(c, "torpedo_v1 §18 isolation multipliers missing");
  for (const state of FLOODING_ISOLATION_STATES) {
    if (c.floodingIsolationMultiplierBp[state] !== TORPEDO_FLOODING_ISOLATION_MULTIPLIER_BP[state])
      throwMismatch(c, `torpedo_v1 §18 isolation multiplier for ${state}`);
  }
  if (c.baseBreachRateKgMinPerM2 !== TORPEDO_BASE_BREACH_RATE_KG_MIN_PER_M2)
    throwMismatch(c, "torpedo_v1 §18 base breach rate per m²");
  if (c.seawaterDensityKgPerM3 !== TORPEDO_SEAWATER_DENSITY_KG_PER_M3)
    throwMismatch(c, "torpedo_v1 §16 immediate-flooding seawater density (1_000 kg/m³)");
  if (c.immediateFloodingMinDepthM !== TORPEDO_IMMEDIATE_FLOODING_MIN_DEPTH_M)
    throwMismatch(c, "torpedo_v1 §16 immediate-flooding minimum breach depth (1 m)");
  if (
    !c.machinerySeverityWeightsBp ||
    !recordEquals(c.machinerySeverityWeightsBp, TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP)
  )
    throwMismatch(c, "torpedo_v1 §19 machinery severity weights (total 10_000)");
  if (c.nonMachineryEligibilityBp !== TORPEDO_NON_MACHINERY_ELIGIBILITY_BP)
    throwMismatch(c, "torpedo_v1 §19 non-machinery reduced eligibility (2_500)");
  if (c.tubeCrewCasualtyBaseBp !== TORPEDO_TUBE_CREW_CASUALTY_BASE_BP)
    throwMismatch(c, "torpedo_v1 §21 crew-casualty base (5_000 bp)");
  if (c.tubeCrewCasualtyShareBp !== TORPEDO_TUBE_CREW_CASUALTY_SHARE_BP)
    throwMismatch(c, "torpedo_v1 §21 crew-casualty share (2_500 bp)");
  if (!c.systemShockBands || !arrayEquals(c.systemShockBands, TORPEDO_SYSTEM_SHOCK_BANDS))
    throwMismatch(c, "torpedo_v1 §20 system-shock band enum");
  if (!c.systemShockBaseBp || !recordEquals(c.systemShockBaseBp, TORPEDO_SYSTEM_SHOCK_BASE_BP))
    throwMismatch(c, "torpedo_v1 §20 system-shock base probabilities");
}
