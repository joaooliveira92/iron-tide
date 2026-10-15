//packages/combat/src/torpedoes/damageConstants.ts
// DESIGN-40 §16–§23 torpedo-damage shipped constants (INC-6, AC-15..AC-18).
// Every DESIGN-40-pinned integer lives here VERBATIM (protection-leak §17,
// impact-zone §17, flooding-isolation §18, machinery weights §19, shock-radius
// §20, chain-reaction §22); authored BALANCE TARGET integers (the base-breach
// rate, base flotation damage rate, structural rate, severe-tube casualty base
// + share, the immediate-flooding breach-volume density + minimum depth,
// chain-reaction modifier manifest) are documented below and recorded for
// ADR-0029 — never silently tuned. §21 tube-hit-hazard constants live in
// tubeHazard.ts under the spec-named `underwater_tube_hit_hazard_v1` contract.
// The constants here ship as `SHIPPED_TORPEDO_DAMAGE_CONTRACT` +
// `validateTorpedoDamageContract` (the INC-1..INC-5 contract idiom: fail-closed
// on any tampering). The highest-leverage authored constants (base flotation +
// structural per-kg rates, severe-tube casualty base + share, and the
// immediate-flooding breach-volume density + minimum depth) are CONTRACT-PINNED
// (the reviewer's HIGH-1) so a tamper cannot silently retune them.
//
// Types come from detonation.ts (§17 zone + protection surfaces) and
// constants.ts — there is no import cycle (detonation.ts never imports this
// module). Pure/deterministic: fixed integer constants only.
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

// ---- §17 flotation damage (immediateFlotationLoss) --------------------------
// floor(baseWarheadFlotationDamage * protectionLeakMultiplierBp *
//       impactZoneMultiplierBp * existingDamageMultiplierBp / 10_000^3)
export const TORPEDO_FLOTATION_SCALE_EXPONENT = 3 as const;
export const TORPEDO_FLOTATION_ROUNDING = "floor" as const;
export const TORPEDO_FLOTATION_MIN_BP = 0 as const;
// §17 shipped protection-leak multipliers (leak fraction of the base warhead
// flotation damage that penetrates the underwater-protection scheme).
export const TORPEDO_PROTECTION_LEAK_MULTIPLIER_BP: Record<TorpedoTargetProtectionLevel, number> = {
  NONE: 15_000,
  WEAK: 12_500,
  STANDARD: 10_000,
  STRONG: 7_500,
  ADVANCED: 5_000,
};
// §17 shipped impact-zone flotation multipliers. DESIGN-40 pins FIVE zones
// (bow/stern extremity, machinery, magazine, central protected, already
// breached). The engine's §17 zone enum adds TUBE_BAY (an ordnance zone the
// §21/§22 mechanics need); DESIGN-40 does not ship a value for it, so INC-6
// authors TUBE_BAY at the magazine/machinery-class interior-space value
// (12_500) — documented BALANCE TARGET for ADR-0029 (never silently tuned).
export const TORPEDO_IMPACT_ZONE_FLOTATION_MULTIPLIER_BP: Record<TorpedoImpactZone, number> = {
  EXTREMITY: 7_500,
  MACHINERY: 12_500,
  MAGAZINE: 12_500,
  TUBE_BAY: 12_500, // authored BALANCE TARGET (see note above); ordnance-class interior
  CENTRAL: 10_000,
  BREACHED: 15_000,
};
// BALANCE TARGET (authored, ADR-0029): the base warhead flotation damage per
// kilogram of TNT-equivalent warhead mass (the §17 formula's first term).
// World-war damage ground-truth scales a single torpedo hit to a large
// fraction of a cruiser's reserve (research note §3.4: 30-50 m² breaches
// flooding multiple compartments), so the authored constant seeds a
// Type-93-scale charge (~490 kg) with a base flotation damage of ~7_840
// reserve-units (490 × 16) — before the §17 leak/zone/existing multipliers.
export const TORPEDO_BASE_FLOTATION_DAMAGE_PER_KG_EQ = 16 as const;
// BALANCE TARGET (authored — ADR-0029): the structural-integrity loss per
// kilogram of TNT-equivalent warhead mass (3× the flotation rate — hull-break
// damage scales with the charge while the reserve absorbs the flooding).
export const TORPEDO_STRUCTURAL_DAMAGE_PER_KG_EQ = 48 as const;

// §17 existing-damage multiplier: "already breached zone: 15_000" is the
// impact-zone arm; the existingDamageMultiplierBp input is the ship's
// already-damaged modifier (authored neutral 10_000; a flooding-damaged ship
// may raise it — the callers supply the value, never a silent default).
export const TORPEDO_EXISTING_DAMAGE_MULTIPLIER_NEUTRAL_BP = 10_000 as const;

// ---- §18 progressive flooding -----------------------------------------------
// floor(baseBreachRate * seaPressureMultiplierBp * hullDamageMultiplierBp *
//       compartmentMultiplierBp * isolationMultiplierBp / 10_000^4)
export const TORPEDO_FLOODING_SCALE_EXPONENT = 4 as const;
export const TORPEDO_FLOODING_ROUNDING = "floor" as const;
// §18 shipped isolation multipliers (intact / degraded / failed).
export const TORPEDO_FLOODING_ISOLATION_MULTIPLIER_BP: Record<FloodingIsolationState, number> = {
  INTACT: 5_000,
  DEGRADED: 10_000,
  FAILED: 15_000,
};
// BALANCE TARGET (authored — ADR-0029): the base breach rate per square metre
// of hull-breach area (integer kg/min × m²). The research note (c1-m3-torpedoes
// §3.4) grounds only the BREACH SCALE — cruiser/battleship torpedo hits open
// ~20–55 m² and flood several compartments — and immobility, QUALITATIVELY; it
// does NOT quote any kg/min × m² flooding rate, so NO rate is cited here. The
// authored value (no external citation) makes a 30 m² breach ≈ 30_000 kg/min
// before multipliers — a pure balance target, never silently tuned.
export const TORPEDO_BASE_BREACH_RATE_KG_MIN_PER_M2 = 1_000 as const;
// Neutral multipliers for the §18 factors DESIGN-40 does not ship tables for
// (sea pressure / hull damage / compartment) — they are integer bp inputs the
// layout/phase layer supplies; neutral 10_000 = no strain modifier.
export const TORPEDO_FLOODING_NEUTRAL_MULTIPLIER_BP = 10_000 as const;

// ---- §16/§17 immediate-flooding breach-volume estimate ----------------------
// The package's immediateFloodingKg is the breach-volume estimate
// floor(hullBreachAreaM2 × breachDepthM × seawaterDensity), with the breach
// depth = the detonation depth floored at TORPEDO_IMMEDIATE_FLOODING_MIN_DEPTH_M
// (a flat 0 m / waterline strike still opens a hole down to the shallowest
// modelable depth). Both are authored BALANCE TARGETs (ADR-0029) and are
// CONTRACT-PINNED here (the reviewer's HIGH-1 / LOW-2) so the inlined literals
// can never drift from the shipped surface.
export const TORPEDO_SEAWATER_DENSITY_KG_PER_M3 = 1_000 as const;
export const TORPEDO_IMMEDIATE_FLOODING_MIN_DEPTH_M = 1 as const;

// ---- §19 machinery damage ---------------------------------------------------
export const TORPEDO_MACHINERY_SEVERITIES = [
  "NO_EFFECT",
  "DEGRADED_PROPULSION",
  "MAJOR_PROPULSION_LOSS",
  "DEAD_IN_WATER",
  "CATASTROPHIC_MACHINERY_LOSS",
] as const;
export type TorpedoMachinerySeverity = (typeof TORPEDO_MACHINERY_SEVERITIES)[number];
// §19 shipped machinery-hit severity weights — total exactly 10_000.
export const TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP: Record<TorpedoMachinerySeverity, number> = {
  NO_EFFECT: 1_000,
  DEGRADED_PROPULSION: 4_000,
  MAJOR_PROPULSION_LOSS: 3_000,
  DEAD_IN_WATER: 1_500,
  CATASTROPHIC_MACHINERY_LOSS: 500,
};
// §19 non-machinery reduced eligibility multiplier (exact).
export const TORPEDO_NON_MACHINERY_ELIGIBILITY_BP = 2_500 as const;
// §19 "in or adjacent to machinery spaces": the MACHINERY zone is "in"; every
// other zone is non-machinery (the engine's zone classes span whole
// compartments, so "adjacent" interiors are covered by either a MACHINERY zone
// hit or the reduced eligibility below — the relevant scope note).
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

// ---- §20 turret/system shock -------------------------------------------------
export const TORPEDO_SYSTEM_SHOCK_BANDS = ["PRIMARY", "SECONDARY", "OUTSIDE"] as const;
export type TorpedoSystemShockBand = (typeof TORPEDO_SYSTEM_SHOCK_BANDS)[number];
// §20 shipped base system-shock probability by declared shock radius.
export const TORPEDO_SYSTEM_SHOCK_BASE_BP: Record<TorpedoSystemShockBand, number> = {
  PRIMARY: 3_000,
  SECONDARY: 1_000,
  OUTSIDE: 0,
};

// ---- §21 immediate severe-flooding budget (used by tubeHazard.ts) -----------
export const TORPEDO_TUBE_SEVERE_FLOODING_BUDGET_BP = 5_000 as const;
export const TORPEDO_TUBE_EXTRA_SOURCE_RATE_MULTIPLIER_BP = 15_000 as const;
// BALANCE TARGET (authored — ADR-0029): §21 "crew-casualty … checks" needs a
// base casualty share. A severe oxygen-tube flood in a manned tube bay is
// near-certain casualties; the authored base + at-risk-fraction constants
// follow the Canberra/Prince-of-Wales records (research §3.4).
export const TORPEDO_TUBE_CREW_CASUALTY_BASE_BP = 5_000 as const;
export const TORPEDO_TUBE_CREW_CASUALTY_SHARE_BP = 2_500 as const;

// ---- §22 chain-reaction base probability by propellant class (base §22) ----
// §22 shipped base: ordinary 1_500 / oxygen 3_000 / electric 1_000 in bp.
// The OXYGEN slot ≡ the §23 OXYGEN_CHAIN_REACTION_BASE_BP constant (the
// §23/§22 agreement; see constants.ts) — the record reuses the constant so the
// two surfaces can never drift apart.
export const TORPEDO_CHAIN_REACTION_BASE_BP: Record<TubeHitHazardPolicy, number> = {
  ORDINARY: 1_500,
  OXYGEN: 3_000,
  ELECTRIC: 1_000,
};
// §22 explicit integer modifier manifest (design-control isolation, flooding,
// protection, fire intensity, existing damage) — the five factors of the
// probability composition; the neutral (no strain) value is 10_000 bp.
export const TORPEDO_CHAIN_REACTION_MODIFIER_KEYS = [
  "isolation",
  "flooding",
  "protection",
  "fireIntensity",
  "existingDamage",
] as const;
export type TorpedoChainReactionModifierKey = (typeof TORPEDO_CHAIN_REACTION_MODIFIER_KEYS)[number];
export const TORPEDO_CHAIN_REACTION_NEUTRAL_MODIFIER_BP = 10_000 as const;
export const TORPEDO_CHAIN_REACTION_SCALE_EXPONENT = 5 as const; // 10_000^5

// ---------------------------------------------------------------------------
// TorpedoDamageContract — ships the INC-6 authored §16–§23 damage-constant
// surface (INC-24 "every new torpedo constant ships *_v1 + contract +
// validate guard"; the §21 surface ships under its own name-branded contract
// in tubeHazard.ts). Fail-closed on tampering, mirroring the detonation
// contract precedent (detonation.ts SHIPPED_TORPEDO_DETONATION_CONTRACT).
export interface TorpedoDamageContract {
  policyId: string;
  flotationScaleExponent: number;
  flotationRounding: string;
  baseFlotationDamagePerKgEq: number; // §17 first term — authored BALANCE TARGET (HIGH-1)
  structuralDamagePerKgEq: number; // structural rate — authored BALANCE TARGET (HIGH-1)
  protectionLeakMultiplierBp: Record<TorpedoTargetProtectionLevel, number>;
  impactZoneFlotationMultiplierBp: Record<TorpedoImpactZone, number>;
  floodingScaleExponent: number;
  floodingRounding: string;
  floodingIsolationMultiplierBp: Record<FloodingIsolationState, number>;
  baseBreachRateKgMinPerM2: number;
  seawaterDensityKgPerM3: number; // §16 immediate-flooding breach volume (HIGH-1/LOW-2)
  immediateFloodingMinDepthM: number; // §16 immediate-flooding depth floor (HIGH-1/LOW-2)
  machinerySeverityWeightsBp: Record<TorpedoMachinerySeverity, number>;
  nonMachineryEligibilityBp: number;
  tubeCrewCasualtyBaseBp: number; // §21 casualty base — authored BALANCE TARGET (HIGH-1)
  tubeCrewCasualtyShareBp: number; // §21 casualty share — authored BALANCE TARGET (HIGH-1)
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
