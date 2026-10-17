// Versioned authoritative torpedo base constants (DESIGN-40 §1-§4 surface shipped
// by INC-1; §7/§8/§23 shipped integer values seeded for INC-2/INC-6 use) shipped
// as a `torpedo_v1` policy + `SHIPPED_TORPEDO_CONTRACT` + `validateTorpedoContract`,
// mirroring packages/combat/src/gunnery/constants.ts. Fail-closed on mismatch.
// Grounded in docs/research/c1-m3-torpedoes.md and recorded in the C-1 ADR
// (ADR-0029, INC-8). Pure/deterministic: fixed integer constants only.
import { BluewaveError } from "@bluewave/contracts";
import { SUBSTEP_SECONDS, SUBSTEPS_PER_MINUTE } from "../movement/constants.js";
import { TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export const torpedoPolicyId = "torpedo_v1" as const;

// Ruleset and formula versions pinned by the torpedo_v1 contract.
export const TORPEDO_RULESET_VERSION = "torpedo_ruleset_v1" as const;
export const TORPEDO_FORMULA_VERSION = "torpedo_formula_v1" as const;

// fixed-point scale shared by every basis-point quantity in this subsystem.
export const TORPEDO_BASIS_POINTS_PER_UNIT = 10_000 as const;

// Speeds are authored as integer basis-point knots (knots * 1_000) on the
// movement precedent (packages/combat/src/movement/constants.ts SPEED_BP_SCALE):
// 26.5 kn is the integer 26_500 bp. The engine-facing conversion to integer
// micrometres-per-second uses KNOTS_TO_UM_S (1 kn = 514_444 µm/s, DESIGN-40 §7
// pins 25 kn = 12_861_100 µm/s).
export const TORPEDO_SPEED_BP_SCALE = 1_000 as const;
export const TORPEDO_KNOTS_TO_UM_S = 514_444 as const;

// DESIGN-40 §1: every torpedo model carries reliability as basis points. The
// research note (docs/research/c1-m3-torpedoes.md §4.5) authors reliability on
// a per-100_000 scale (96_000 = 96.0%), finer-grained than 10_000 bp; the model
// constant set keeps those integers verbatim with this explicit scale.
// NOTE (INC-1 record — F8): DESIGN-40 §12 launch-failure roll normalizes the
// per-model reliability to the standard 10_000 bp roll scale with the explicit
// integer division floor(reliabilityBp / 10) — 100_000 / 10 = 10_000 bp scale
// (1% = 100 bp). INC-4 performs that normalization at the use site (track.ts
// createTorpedoTrack); this constant ships the 100_000-scale value verbatim and
// the two scales are intentionally not conflated here.
export const TORPEDO_RELIABILITY_SCALE = 100_000 as const;

// DESIGN-40 §2 closed mount-type enum — exactly these five values.
export const TORPEDO_MOUNT_TYPES = [
  "ABOVE_WATER_FIXED",
  "ABOVE_WATER_TRAINABLE",
  "UNDERWATER_FIXED",
  "UNDERWATER_TRAINABLE",
  "SUBMARINE_INTERNAL",
] as const;
export type TorpedoMountType = (typeof TORPEDO_MOUNT_TYPES)[number];

// Canonical propulsion types (research note §4.1 / §4.4). §21 propulsion tube-hit
// multipliers and §4.4 wake-visibility modifiers are keyed off these.
export const TORPEDO_PROPULSION_TYPES = [
  "COMPRESSED_AIR",
  "WET_HEATER",
  "ELECTRIC",
  "OXYGEN",
] as const;
export type TorpedoPropulsionType = (typeof TORPEDO_PROPULSION_TYPES)[number];

// Canonical warhead types (research note §3.5 explosive-equivalence table).
export const TORPEDO_WARHEAD_TYPES = [
  "WET_GUNCOTTON",
  "TNT",
  "TORPEX",
  "TPX",
  "HBX",
  "HEXANITE",
  "TYPE_97",
] as const;
export type TorpedoWarheadType = (typeof TORPEDO_WARHEAD_TYPES)[number];

// Per-model tube-hit-hazard policies (research note §4.8): ORDINARY for
// compressed-air/wet-heater, OXYGEN for oxygen, ELECTRIC for electric — matching
// the shipped DESIGN-40 §21 propulsion multipliers.
export const TUBE_HIT_HAZARD_POLICIES = ["ORDINARY", "OXYGEN", "ELECTRIC"] as const;
export type TubeHitHazardPolicy = (typeof TUBE_HIT_HAZARD_POLICIES)[number];

// DESIGN-40 §2 fire-control connection state (launcher state surface).
export const FIRE_CONTROL_CONNECTION_STATES = ["CONNECTED", "DEGRADED", "DISCONNECTED"] as const;
export type FireControlConnectionState = (typeof FIRE_CONTROL_CONNECTION_STATES)[number];

// DESIGN-40 §2 damage state; §21 severe underwater-tube flooding sets DESTROYED.
export const LAUNCHER_DAMAGE_STATES = ["OPERATIONAL", "DAMAGED", "DESTROYED"] as const;
export type LauncherDamageState = (typeof LAUNCHER_DAMAGE_STATES)[number];

// DESIGN-40 §18/§21 flooding-isolation states (intact / degraded / failed
// isolation multipliers 5_000 / 10_000 / 15_000).
export const FLOODING_ISOLATION_STATES = ["INTACT", "DEGRADED", "FAILED"] as const;
export type FloodingIsolationState = (typeof FLOODING_ISOLATION_STATES)[number];

// DESIGN-40 §2 "loaded torpedo model per tube or EMPTY" marker.
export const EMPTY_TUBE = "EMPTY" as const;
// DESIGN-40 §2 "active fire solution or NONE" marker.
export const NO_FIRE_SOLUTION = "NONE" as const;

// DESIGN-40 §7 underwater-tube speed limit (surface ships): exactly 25 knots =
// 12_861_100 µm/s; predicate currentSpeedMicrometresPerSecond <= 12_861_100.
// Flagged BALANCE TARGET in the research note (§4.6: historical practical band
// was ~15-20 kn); the shipped 25-kn ceiling is design-pinned, not silently tuned.
export const UNDERWATER_TUBE_MAX_SPEED_KNOTS = 25 as const;
export const UNDERWATER_TUBE_MAX_SPEED_UM_S = 12_861_100 as const;

// DESIGN-40 §8 above-water launcher speed defaults (exact shipped integers);
// a launcher definition MAY declare a narrower value (INC-2 enforces).
export const ABOVE_WATER_FIXED_MAX_LAUNCH_SPEED_KNOTS = 30 as const;
export const ABOVE_WATER_TRAINABLE_MAX_LAUNCH_SPEED_KNOTS = 35 as const;

// DESIGN-40 §6: target contact confidence gate. The reused validateTargetOrder
// fog gate (TACTICAL_FOG_OF_WAR_VIOLATION) runs first; a KNOWN contact below
// this basis-point confidence fails with TORPEDO_TARGET_CONTACT_INSUFFICIENT.
// (Gunnery precedent: SURFACE_FIRE_CONTROL_MINIMUM_BP = 2_000 in
// gunnery/constants.ts — the torpedo gate is the higher §6-pinned 4_000 bp.)
export const TORPEDO_TARGET_CONTACT_MINIMUM_BP = 4_000 as const;

// DESIGN-40 §10 shipped minimum launch solution quality by launch kind. INC-3
// computes the solution quality (§10 11-factor formula); INC-2 ships the
// threshold table + the pure threshold check that takes an already-computed
// integer solution-quality value (basis points [0, 10_000]) — the seam is
// documented in eligibility.ts. The §24 friendly-in-danger-sector minimum
// (7_500 bp or launch prohibited) is part of the INC-3 friendly-fire family.
export const TORPEDO_LAUNCH_KINDS = [
  "AUTOMATED",
  "MANUAL_CAPTAIN",
  "AREA_DENIAL",
  "SPREAD",
] as const;
export type TorpedoLaunchKind = (typeof TORPEDO_LAUNCH_KINDS)[number];
export const TORPEDO_SOLUTION_MINIMUM_BP: Record<TorpedoLaunchKind, number> = {
  AUTOMATED: 5_000,
  MANUAL_CAPTAIN: 4_000,
  AREA_DENIAL: 3_000,
  SPREAD: 3_000,
};

// DESIGN-40 §6 "sea state permits launch": DESIGN-40 does not pin a concrete
// sea-state rule, so this is an authored versioned-ruleset constant on the B-5
// weather integer scale (SEA_STATE_MIN 0 .. SEA_STATE_MAX 9,
// packages/combat/src/weather/constants.ts) — decoupled from the B-5 module
// (the eligibility gate takes a plain integer sea-state value). BALANCE TARGET:
// surface-ship torpedo launch is unsafe in heavy seas; the shipped ceiling is
// authored at 5 (rough sea) and recorded in the INC-2 report — never silently
// tuned. SUBMARINE_INTERNAL tube launches (C-3) are not governed by this
// surface-ship gate.
export const TORPEDO_MAX_LAUNCH_SEA_STATE = 5 as const;

// ---- DESIGN-40 §10 fire-solution manifest (INC-3) ------------------------------
// The shipped 11-factor versioned manifest: baseSolutionBp × the ten multiplier
// factors below, each an integer basis-point multiplier. The §9 knowledge inputs
// feed the manifest factors as documented in fire-solution.ts (the engine
// computes each multiplier from those inputs in INC-7; this slice ships the
// manifest + exact product formula + the authored neutral factor set). A missing
// factor fails with TORPEDO_FIRE_SOLUTION_FACTOR_MISSING — never a silent 10_000.
export const TORPEDO_SOLUTION_FACTOR_KEYS = [
  "range",
  "bearing",
  "targetMotion",
  "ownManeuver",
  "crew",
  "training",
  "seaState",
  "visibility",
  "technology",
  "damage",
] as const;
export type TorpedoSolutionFactorKey = (typeof TORPEDO_SOLUTION_FACTOR_KEYS)[number];
// Neutral multiplier (10_000 bp = x1.00): the authored value for a factor the
// firing side cannot meaningfully assess, and the neutral factor-set builder.
export const NEUTRAL_TORPEDO_SOLUTION_MULTIPLIER_BP = 10_000 as const;
export const TORPEDO_SOLUTION_FINAL_MIN_BP = 0 as const;
export const TORPEDO_SOLUTION_FINAL_MAX_BP = 10_000 as const;
// Denominator exponent: 10_000^10 = 10^40 (bigint; the raw numerator reaches
// ~10^44 > Number.MAX_SAFE_INTEGER — bigint intermediate is REQUIRED).
export const TORPEDO_SOLUTION_SCALE_EXPONENT = 10 as const;
export const TORPEDO_SOLUTION_ROUNDING = "floor" as const;
// §10/§24: a friendly/unidentified/low-confidence contact inside the launch
// danger sector raises the minimum required solution quality to 7_500 bp
// (highest of the §10 thresholds; the §24 prohibition overrides at 1_000 m).
export const TORPEDO_FRIENDLY_DANGER_SECTOR_MINIMUM_BP = 7_500 as const;

// ---- DESIGN-40 §24 friendly-fire danger sector (INC-3) -------------------------
// §24 prohibits a launch when a confirmed friendly is inside the danger sector
// with a predicted minimum separation below 1_000 m. Authored integer geometry
// (no floating point, ENGINEERING-CONTRACT): the sector half-angle is the salvo
// spread half-angle plus the target-contact uncertainty angle; the uncertainty
// angle is the small-angle approximation
//   floor(uncertaintyM * 57_296 / max(rangeM, 1)) mdeg
// and the minimum predicted separation of a friendly is its cross-track distance
// from the launch bearing line:
//   floor(friendlyRangeM * bearingDifferenceMdeg / 57_296) m
// with RAD_TO_MDEG = 57_296 the integer milli-degrees per radian (authoring
// constant; documented approximation — the exact trig would require
// floating point, which the contract forbids for authoritative arithmetic).
export const TORPEDO_FRIENDLY_FIRE_MIN_SEPARATION_M = 1_000 as const;
export const TORPEDO_DANGER_SECTOR_RAD_TO_MDEG = 57_296 as const;
// §24: a contact below this basis-point confidence counts as "low-confidence"
// for the §10 quality raise. Authored at the §6 gate value (4_000 bp) so the
// two gates share one published threshold; recorded, not silently tuned.
export const TORPEDO_FRIENDLY_FIRE_LOW_CONFIDENCE_BP = 4_000 as const;
// §24: identity marker for a contact that has NOT been identified — inside the
// danger sector it raises the §10 minimum (the §24 "unidentified contact" arm).
export const UNIDENTIFIED_CONTACT_IDENTITY = "UNIDENTIFIED" as const;

// ---- DESIGN-40 §11 salvo policy (INC-3, authored BALANCE TARGET) ---------------
// Deterministic policy over the nine §11 factors: mission objective, withdrawal
// state, target combat value, target size, range, solution quality, remaining
// ammunition, friendly launcher count, overkill estimate. Every numeric
// contribution is an integer basis-point term floored once
// (floor(bpInput * weightBp / 10_000)); the recommended salvo size is
// clamp(1, floor(scoreBp / BP_PER_TUBE), maxTubes). Directions are authored
// (documented in salvo.ts): high-value/large/long-range/poor-solution targets
// and lone-firing ships receive MORE tubes; scarce ammunition, strong friendly
// launcher coverage, and estimated overkill receive FEWER.
export const TORPEDO_MISSION_OBJECTIVES = [
  "ATTACK",
  "DEFENSE",
  "AREA_DENIAL",
  "BREAKTHROUGH",
] as const;
export type TorpedoMissionObjective = (typeof TORPEDO_MISSION_OBJECTIVES)[number];
export const TORPEDO_WITHDRAWAL_STATES = ["NORMAL", "WITHDRAWING"] as const;
export type TorpedoWithdrawalState = (typeof TORPEDO_WITHDRAWAL_STATES)[number];
// Base salvo size by mission objective (tubes), before any factor adjustment.
export const TORPEDO_SALVO_BASE_TUBES: Record<TorpedoMissionObjective, number> = {
  ATTACK: 2,
  DEFENSE: 1,
  AREA_DENIAL: 4,
  BREAKTHROUGH: 3,
};
// WITHDRAWING adds a parting salvo tube (authorized §11 withdrawal modifier).
export const TORPEDO_SALVO_WITHDRAWAL_MODIFIER_TUBES: Record<TorpedoWithdrawalState, number> = {
  NORMAL: 0,
  WITHDRAWING: 1,
};
export const TORPEDO_SALVO_FACTOR_KEYS = [
  "targetCombatValue",
  "targetSize",
  "rangePressure",
  "solutionQualityDeficit",
  "ammoScarcity",
  "friendlyCoveragePressure",
  "overkill",
] as const;
export type TorpedoSalvoFactorKey = (typeof TORPEDO_SALVO_FACTOR_KEYS)[number];
// Weight of each factor in the basis-point score (authored; sums document the
// relative importance — combat value and ammo conservation weigh most).
export const TORPEDO_SALVO_FACTOR_WEIGHTS_BP: Record<TorpedoSalvoFactorKey, number> = {
  targetCombatValue: 1_500,
  targetSize: 500,
  rangePressure: 1_000,
  solutionQualityDeficit: 1_000,
  ammoScarcity: 1_500,
  friendlyCoveragePressure: 1_000,
  overkill: 1_000,
};
export const TORPEDO_SALVO_BP_PER_TUBE = 1_000 as const;
export const TORPEDO_SALVO_MIN_TUBES = 1 as const;
// Range pressure (0..10_000 bp, HIGHER at longer range — dispersion demands
// more tubes): authored bands over the shipped setting ranges.
export const TORPEDO_SALVO_RANGE_PRESSURE_BP_TABLE: readonly {
  maxRangeM: number;
  pressureBp: number;
}[] = [
  { maxRangeM: 2_000, pressureBp: 0 },
  { maxRangeM: 5_000, pressureBp: 2_000 },
  { maxRangeM: 8_000, pressureBp: 4_000 },
  { maxRangeM: 12_000, pressureBp: 6_000 },
  { maxRangeM: Number.MAX_SAFE_INTEGER, pressureBp: 8_000 },
];
// Ammo scarcity (0..10_000 bp, HIGHER when fewer torpedoes remain — conserve):
// `minAmmo` is the smallest remaining-total count in the band.
export const TORPEDO_SALVO_AMMO_SCARCITY_BP_TABLE: readonly {
  minAmmo: number;
  scarcityBp: number;
}[] = [
  { minAmmo: 12, scarcityBp: 0 },
  { minAmmo: 8, scarcityBp: 2_000 },
  { minAmmo: 4, scarcityBp: 4_000 },
  { minAmmo: 2, scarcityBp: 6_000 },
  { minAmmo: 1, scarcityBp: 8_000 },
  { minAmmo: 0, scarcityBp: 10_000 },
];
// Friendly launcher coverage pressure (0..10_000 bp, HIGHER when fewer friendly
// launchers can cover — a lone ship must provide the coverage itself): `maxCount`
// is the largest friendly-launcher count in the band.
export const TORPEDO_SALVO_FRIENDLY_LAUNCHER_PRESSURE_BP_TABLE: readonly {
  maxCount: number;
  pressureBp: number;
}[] = [
  { maxCount: 0, pressureBp: 10_000 },
  { maxCount: 1, pressureBp: 7_000 },
  { maxCount: 2, pressureBp: 5_000 },
  { maxCount: Number.MAX_SAFE_INTEGER, pressureBp: 3_000 },
];

// DESIGN-40 §23 shipped oxygen-torpedo effects (algorithm constants; a torpedo
// part carries only its per-model wake modifier; mechanics resolve in INC-6).
// BALANCE TARGET: oxygen
// wake-detection 7_500 vs near-invisible wake evidence (research §4.4) — the
// per-model wakeVisibilityModifierBp is the lever, the shipped §23 value is not
// silently changed.
export const OXYGEN_RANGE_MULTIPLIER_BP = 15_000 as const;
export const OXYGEN_SPEED_MULTIPLIER_BP = 11_000 as const;
export const OXYGEN_WAKE_DETECTION_MULTIPLIER_BP = 7_500 as const;
export const OXYGEN_TUBE_HIT_SEVERE_FLOODING_MULTIPLIER_BP = 15_000 as const;
export const OXYGEN_CHAIN_REACTION_BASE_BP = 3_000 as const;

// ---- DESIGN-40 §12 launch timing/failure (INC-4) ------------------------------
// §12 pins the base launch-failure probability EXACTLY: 100 basis points per
// tube before model, damage, crew, and reliability modifiers (1% on the
// standard 10_000 bp roll scale — 100 bp per percent). The final per-tube
// failure chance is the deterministic sequence of signed basis-point
// adjustments documented in launch-failure.ts:
//   failureChanceBp = clamp(0, 10_000, 100 + ΔmodelReliability + Δdamage
//                                       + Δcrew + ΔreliabilityBand)
// and the failure outcome is the keyed per-tube draw: drawBp < failureChanceBp.
// DESIGN-40 pins ONLY the 100 bp base + the four modifier categories; the
// adjustment values are authored versioned-ruleset constants (BALANCE TARGET,
// recorded for the C-1 ADR).
export const TORPEDO_LAUNCH_FAILURE_BASE_BP = 100 as const;
export const TORPEDO_LAUNCH_FAILURE_MIN_BP = 0 as const;
export const TORPEDO_LAUNCH_FAILURE_MAX_BP = TORPEDO_SOLUTION_FINAL_MAX_BP; // 10_000
// §12 "at its declared firing substep": the torpedo stage substep. The B-3
// gunnery stage runs at substep 2 and the B-4 damage stage at substep 3, so the
// torpedo stage (INC-7) runs at substep 4. The resolver ACCEPTS the declared
// substep as an input and defaults to this shipped constant.
export const TORPEDO_LAUNCH_SUBSTEP = 4 as const;
// §12 "model" modifier: the per-model reliabilityBp (100_000 scale) enters the
// failure composition normalized to the 10_000 bp roll scale
// (floor(reliabilityBp / 10), 1% = 100 bp — the constants note below
// TORPEDO_RELIABILITY_SCALE). ΔmodelReliability =
//   floor((TORPEDO_RELIABILITY_SCALE - reliabilityBp) / 250)
// — each percent of model unreliability adds 4 bp to the failure chance (a
// launch failure is a mechanical tube/impeller/pistol event, deliberately a
// small share of the detonation-scale unreliability; authored BALANCE TARGET).
export const TORPEDO_LAUNCH_FAILURE_MODEL_RELIABILITY_DIVISOR = 250 as const;
// §12 "damage" modifier: launcher damage state. A DESTROYED launcher never
// launches (the eligibility launcherAndTubesOperational predicate rejects it
// and the resolver fails closed defensively); the table pins DAMAGED at +75 bp
// (authored BALANCE TARGET). DESTROYED is pinned at 10_000 bp (certain) as the
// unreachable-but-pinned table entry.
export const TORPEDO_LAUNCH_FAILURE_DAMAGE_ADJUSTMENT_BP: Record<LauncherDamageState, number> = {
  OPERATIONAL: 0,
  DAMAGED: 75,
  DESTROYED: TORPEDO_LAUNCH_FAILURE_MAX_BP,
};
// §12 "crew" modifier: crew skill/experience as an integer basis-point input
// [0, 10_000] (0 = green, 10_000 = elite). Δcrew =
//   floor((TORPEDO_LAUNCH_FAILURE_CREW_NEUTRAL_BP - crewQualityBp) / 100)
// — neutral (5_000) adds 0; elite subtracts 50 bp; green adds 50 bp (authored
// BALANCE TARGET).
export const TORPEDO_LAUNCH_FAILURE_CREW_NEUTRAL_BP = 5_000 as const;
export const TORPEDO_LAUNCH_FAILURE_CREW_ADJUSTMENT_DIVISOR = 100 as const;
// §12 "reliability band" modifier: a coarse tiering of the per-model
// reliabilityBp (100_000 scale), first band whose minReliabilityBp is met
// (descending). Authored BALANCE TARGET — a band credit for the most reliable
// models, a penalty for the poorest.
export const TORPEDO_LAUNCH_FAILURE_RELIABILITY_BAND_TABLE: readonly {
  minReliabilityBp: number;
  adjustmentBp: number;
}[] = [
  { minReliabilityBp: 95_000, adjustmentBp: -25 },
  { minReliabilityBp: 92_000, adjustmentBp: 0 },
  { minReliabilityBp: 90_000, adjustmentBp: 25 },
  { minReliabilityBp: 0, adjustmentBp: 50 },
];
// §12 outcome split: of the mechanical failures, the share that is
// TORPEDO_STUCK_IN_TUBE (the CONSUMING outcome — the torpedo is wedged in the
// tube). Within the failure band [0, failureChanceBp) the first
// floor(failureChanceBp * share / 10_000) bp are stuck-in-tube and the
// remainder is the non-consuming TORPEDO_LAUNCH_FAILURE. Authored BALANCE
// TARGET: 3_000 bp = 30% of mechanical failures are stuck-in-tube.
export const TORPEDO_STUCK_IN_TUBE_SHARE_BP = 3_000 as const;
// §13 "target contact identifier or NONE for area fire" marker (distinct from
// the §2 NO_FIRE_SOLUTION marker — different semantic surface).
export const NO_TARGET_CONTACT = "NONE" as const;
// §13 lifecycle: the closed union of terminal outcomes. A torpedo remains an
// authoritative entity until one of these is set (actual hit/detonation
// resolution is INC-5; this slice ships the type + the lifecycle state machine
// with terminalResult: null until then).
export const TORPEDO_TERMINAL_RESULTS = [
  "HIT",
  "DETONATION",
  "DUD",
  "GROUNDING",
  "EXHAUSTION",
  "DESTRUCTION",
  "BATTLE_END",
] as const;
export type TorpedoTerminalResult = (typeof TORPEDO_TERMINAL_RESULTS)[number];
// §13 advance quantum: the torpedo track advances per tactical minute
// (SUBSTEPS_PER_MINUTE 60 × SUBSTEP_SECONDS 1 = 60_000 ms, the movement minute
// precedent — single source of truth via movement/constants.js). The resolver
// accepts an explicit dtMs; this is the shipped default.
export const TORPEDO_MINUTE_MS = SUBSTEPS_PER_MINUTE * SUBSTEP_SECONDS * 1_000;
// §13 position/heading projection: the track stores heading as integer
// milli-degrees (full circle 360_000 — the torpedo module's angular convention,
// §24 friendly-fire geometry) and projects displacement along the nearest-lower
// integer degree through the movement module's authored per-degree direction
// table (exported directionBp; single source of truth, no duplicated table).
// The mdeg -> degree fold is an explicit authored approximation (1° granularity
// on a 360_000 mdeg circle; far below the arming-distance quantum).
export const TORPEDO_TRACK_MDEG_PER_DEGREE = 1_000;

// The full research-grounded `torpedo_models_v1` shipped model-id set
// (docs/research/c1-m3-torpedoes.md §4.1): 8 historical models across 1880-1945.
// INC-1 seeded the first five (covering every propulsion type and era band
// EARLY/PRE_WAR/INTERWAR); INC-8 rolls up the remaining research-table models
// (Whitehead 14-in 1886, RN 21-in Mk VIII 1927, USN 21-in Mk 14 1931). This
// ordered list is the authoritative id surface for the torpedo_models_v1
// contract, the torpedo_v1 shippedModelIds pin, and the model->fuze key set.
// The ids are canonical repository labels: `whitehead_14in_1886` carries a
// retrospective vintage year, not a manufacturer or service designation
// (docs/research/n-2-whitehead-14in-identity.md §5).
export const SEED_TORPEDO_MODEL_IDS = [
  "whitehead_18in_1894",
  "rn_21in_mk_iv_1916",
  "ger_533mm_g7a_1934",
  "ger_533mm_g7e_1936",
  "jpn_61cm_type93_1935",
  "whitehead_14in_1886",
  "rn_21in_mk_viii_1927",
  "usn_21in_mk14_1931",
] as const;
export type SeedTorpedoModelId = (typeof SEED_TORPEDO_MODEL_IDS)[number];

// TorpedoContract — ships the INC-1 authored constant surface. INC-8 rolls the
// FULL research-grounded `torpedo_models_v1` set into SEED_TORPEDO_MODEL_IDS
// (8 models, docs/research/c1-m3-torpedoes.md §4.1); INC-1 seeded the model
// contract + the first five grounded ids.
export interface TorpedoContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  speedBpScale: number;
  knotsToUmS: number;
  reliabilityScale: number;
  mountTypes: readonly TorpedoMountType[];
  propulsionTypes: readonly TorpedoPropulsionType[];
  warheadTypes: readonly TorpedoWarheadType[];
  tubeHitHazardPolicies: readonly TubeHitHazardPolicy[];
  fireControlConnectionStates: readonly FireControlConnectionState[];
  launcherDamageStates: readonly LauncherDamageState[];
  floodingIsolationStates: readonly FloodingIsolationState[];
  underwaterTubeMaxSpeedKnots: number;
  underwaterTubeMaxSpeedUmS: number;
  aboveWaterFixedMaxLaunchSpeedKnots: number;
  aboveWaterTrainableMaxLaunchSpeedKnots: number;
  targetContactMinimumBp: number;
  solutionMinimumBp: Record<TorpedoLaunchKind, number>;
  maxLaunchSeaState: number;
  oxygenRangeMultiplierBp: number;
  oxygenSpeedMultiplierBp: number;
  oxygenWakeDetectionMultiplierBp: number;
  oxygenTubeHitSevereFloodingMultiplierBp: number;
  oxygenChainReactionBaseBp: number;
  // INC-3 (fire solution + salvo + friendly-fire): §10 manifest, §24 geometry,
  // §11 salvo policy.
  solutionFactorKeys: readonly string[];
  solutionScaleExponent: number;
  solutionRounding: string;
  neutralSolutionMultiplierBp: number;
  solutionFinalMinBp: number;
  solutionFinalMaxBp: number;
  friendlyDangerSectorMinimumBp: number;
  friendlyFireMinSeparationM: number;
  dangerSectorRadToMdeg: number;
  friendlyFireLowConfidenceBp: number;
  unidentifiedContactIdentity: string;
  missionObjectives: readonly string[];
  withdrawalStates: readonly string[];
  salvoBaseTubes: Record<string, number>;
  salvoWithdrawalModifierTubes: Record<string, number>;
  salvoFactorKeys: readonly string[];
  salvoFactorWeightsBp: Record<string, number>;
  salvoBpPerTube: number;
  salvoMinTubes: number;
  salvoRangePressureBpTable: readonly { maxRangeM: number; pressureBp: number }[];
  salvoAmmoScarcityBpTable: readonly { minAmmo: number; scarcityBp: number }[];
  salvoFriendlyLauncherPressureBpTable: readonly { maxCount: number; pressureBp: number }[];
  // INC-4 (launch timing/failure + track): §12 failure composition, §12 firing
  // substep, §12 stuck share, §13 terminal-result union + area-fire marker.
  launchFailureBaseBp: number;
  launchFailureMinBp: number;
  launchFailureMaxBp: number;
  launchSubstep: number;
  launchFailureModelReliabilityDivisor: number;
  launchFailureDamageAdjustmentBp: Record<LauncherDamageState, number>;
  launchFailureCrewNeutralBp: number;
  launchFailureCrewAdjustmentDivisor: number;
  launchFailureReliabilityBandTable: readonly { minReliabilityBp: number; adjustmentBp: number }[];
  stuckInTubeShareBp: number;
  terminalResults: readonly string[];
  noTargetContact: string;
  torpedoMinuteMs: number;
  trackMdegPerDegree: number;
  shippedModelIds: readonly string[];
}

export const SHIPPED_TORPEDO_CONTRACT: TorpedoContract = {
  policyId: torpedoPolicyId,
  rulesetVersion: TORPEDO_RULESET_VERSION,
  formulaVersion: TORPEDO_FORMULA_VERSION,
  basisPointsPerUnit: TORPEDO_BASIS_POINTS_PER_UNIT,
  speedBpScale: TORPEDO_SPEED_BP_SCALE,
  knotsToUmS: TORPEDO_KNOTS_TO_UM_S,
  reliabilityScale: TORPEDO_RELIABILITY_SCALE,
  mountTypes: TORPEDO_MOUNT_TYPES,
  propulsionTypes: TORPEDO_PROPULSION_TYPES,
  warheadTypes: TORPEDO_WARHEAD_TYPES,
  tubeHitHazardPolicies: TUBE_HIT_HAZARD_POLICIES,
  fireControlConnectionStates: FIRE_CONTROL_CONNECTION_STATES,
  launcherDamageStates: LAUNCHER_DAMAGE_STATES,
  floodingIsolationStates: FLOODING_ISOLATION_STATES,
  underwaterTubeMaxSpeedKnots: UNDERWATER_TUBE_MAX_SPEED_KNOTS,
  underwaterTubeMaxSpeedUmS: UNDERWATER_TUBE_MAX_SPEED_UM_S,
  aboveWaterFixedMaxLaunchSpeedKnots: ABOVE_WATER_FIXED_MAX_LAUNCH_SPEED_KNOTS,
  aboveWaterTrainableMaxLaunchSpeedKnots: ABOVE_WATER_TRAINABLE_MAX_LAUNCH_SPEED_KNOTS,
  targetContactMinimumBp: TORPEDO_TARGET_CONTACT_MINIMUM_BP,
  solutionMinimumBp: TORPEDO_SOLUTION_MINIMUM_BP,
  maxLaunchSeaState: TORPEDO_MAX_LAUNCH_SEA_STATE,
  oxygenRangeMultiplierBp: OXYGEN_RANGE_MULTIPLIER_BP,
  oxygenSpeedMultiplierBp: OXYGEN_SPEED_MULTIPLIER_BP,
  oxygenWakeDetectionMultiplierBp: OXYGEN_WAKE_DETECTION_MULTIPLIER_BP,
  oxygenTubeHitSevereFloodingMultiplierBp: OXYGEN_TUBE_HIT_SEVERE_FLOODING_MULTIPLIER_BP,
  oxygenChainReactionBaseBp: OXYGEN_CHAIN_REACTION_BASE_BP,
  solutionFactorKeys: TORPEDO_SOLUTION_FACTOR_KEYS,
  solutionScaleExponent: TORPEDO_SOLUTION_SCALE_EXPONENT,
  solutionRounding: TORPEDO_SOLUTION_ROUNDING,
  neutralSolutionMultiplierBp: NEUTRAL_TORPEDO_SOLUTION_MULTIPLIER_BP,
  solutionFinalMinBp: TORPEDO_SOLUTION_FINAL_MIN_BP,
  solutionFinalMaxBp: TORPEDO_SOLUTION_FINAL_MAX_BP,
  friendlyDangerSectorMinimumBp: TORPEDO_FRIENDLY_DANGER_SECTOR_MINIMUM_BP,
  friendlyFireMinSeparationM: TORPEDO_FRIENDLY_FIRE_MIN_SEPARATION_M,
  dangerSectorRadToMdeg: TORPEDO_DANGER_SECTOR_RAD_TO_MDEG,
  friendlyFireLowConfidenceBp: TORPEDO_FRIENDLY_FIRE_LOW_CONFIDENCE_BP,
  unidentifiedContactIdentity: UNIDENTIFIED_CONTACT_IDENTITY,
  missionObjectives: TORPEDO_MISSION_OBJECTIVES,
  withdrawalStates: TORPEDO_WITHDRAWAL_STATES,
  salvoBaseTubes: TORPEDO_SALVO_BASE_TUBES,
  salvoWithdrawalModifierTubes: TORPEDO_SALVO_WITHDRAWAL_MODIFIER_TUBES,
  salvoFactorKeys: TORPEDO_SALVO_FACTOR_KEYS,
  salvoFactorWeightsBp: TORPEDO_SALVO_FACTOR_WEIGHTS_BP,
  salvoBpPerTube: TORPEDO_SALVO_BP_PER_TUBE,
  salvoMinTubes: TORPEDO_SALVO_MIN_TUBES,
  salvoRangePressureBpTable: TORPEDO_SALVO_RANGE_PRESSURE_BP_TABLE,
  salvoAmmoScarcityBpTable: TORPEDO_SALVO_AMMO_SCARCITY_BP_TABLE,
  salvoFriendlyLauncherPressureBpTable: TORPEDO_SALVO_FRIENDLY_LAUNCHER_PRESSURE_BP_TABLE,
  launchFailureBaseBp: TORPEDO_LAUNCH_FAILURE_BASE_BP,
  launchFailureMinBp: TORPEDO_LAUNCH_FAILURE_MIN_BP,
  launchFailureMaxBp: TORPEDO_LAUNCH_FAILURE_MAX_BP,
  launchSubstep: TORPEDO_LAUNCH_SUBSTEP,
  launchFailureModelReliabilityDivisor: TORPEDO_LAUNCH_FAILURE_MODEL_RELIABILITY_DIVISOR,
  launchFailureDamageAdjustmentBp: TORPEDO_LAUNCH_FAILURE_DAMAGE_ADJUSTMENT_BP,
  launchFailureCrewNeutralBp: TORPEDO_LAUNCH_FAILURE_CREW_NEUTRAL_BP,
  launchFailureCrewAdjustmentDivisor: TORPEDO_LAUNCH_FAILURE_CREW_ADJUSTMENT_DIVISOR,
  launchFailureReliabilityBandTable: TORPEDO_LAUNCH_FAILURE_RELIABILITY_BAND_TABLE,
  stuckInTubeShareBp: TORPEDO_STUCK_IN_TUBE_SHARE_BP,
  terminalResults: TORPEDO_TERMINAL_RESULTS,
  noTargetContact: NO_TARGET_CONTACT,
  torpedoMinuteMs: TORPEDO_MINUTE_MS,
  trackMdegPerDegree: TORPEDO_TRACK_MDEG_PER_DEGREE,
  shippedModelIds: SEED_TORPEDO_MODEL_IDS,
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

// Deep equality for the contract's authored integer-keyed tables: the key set
// must match exactly and every value must match exactly.
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

// Deep equality for the contract's authored integer band tables: same length,
// same fields, same values, in the same order.
function bandTableEquals<T extends Record<string, number>>(
  a: readonly T[] | null | undefined,
  b: readonly T[],
): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every((band, i) => {
    const expected = b[i];
    if (expected === undefined) return false;
    return Object.keys(expected).every((k) => band[k] === expected[k]);
  });
}

export function validateTorpedoContract(
  c: Partial<TorpedoContract> | null | undefined,
): asserts c is TorpedoContract {
  if (!c) throwMismatch(c, "torpedo_v1 missing contract");
  if (c.policyId !== torpedoPolicyId) throwMismatch(c, "torpedo_v1 expectant policy id");
  if (c.rulesetVersion !== TORPEDO_RULESET_VERSION || c.formulaVersion !== TORPEDO_FORMULA_VERSION)
    throwMismatch(c, "torpedo_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== TORPEDO_BASIS_POINTS_PER_UNIT)
    throwMismatch(c, "torpedo_v1 basis-point scale");
  if (c.speedBpScale !== TORPEDO_SPEED_BP_SCALE || c.knotsToUmS !== TORPEDO_KNOTS_TO_UM_S)
    throwMismatch(c, "torpedo_v1 speed scale (knots bp / µm-s conversion)");
  if (c.reliabilityScale !== TORPEDO_RELIABILITY_SCALE)
    throwMismatch(c, "torpedo_v1 reliability scale");
  if (!c.mountTypes || !arrayEquals(c.mountTypes, TORPEDO_MOUNT_TYPES))
    throwMismatch(c, "torpedo_v1 mount-type closed enum (§2)");
  if (!c.propulsionTypes || !arrayEquals(c.propulsionTypes, TORPEDO_PROPULSION_TYPES))
    throwMismatch(c, "torpedo_v1 propulsion-type set");
  if (!c.warheadTypes || !arrayEquals(c.warheadTypes, TORPEDO_WARHEAD_TYPES))
    throwMismatch(c, "torpedo_v1 warhead-type set");
  if (!c.tubeHitHazardPolicies || !arrayEquals(c.tubeHitHazardPolicies, TUBE_HIT_HAZARD_POLICIES))
    throwMismatch(c, "torpedo_v1 tube-hit-hazard policy set");
  if (
    !c.fireControlConnectionStates ||
    !arrayEquals(c.fireControlConnectionStates, FIRE_CONTROL_CONNECTION_STATES)
  )
    throwMismatch(c, "torpedo_v1 fire-control connection states");
  if (!c.launcherDamageStates || !arrayEquals(c.launcherDamageStates, LAUNCHER_DAMAGE_STATES))
    throwMismatch(c, "torpedo_v1 launcher damage states");
  if (
    !c.floodingIsolationStates ||
    !arrayEquals(c.floodingIsolationStates, FLOODING_ISOLATION_STATES)
  )
    throwMismatch(c, "torpedo_v1 flooding-isolation states");
  if (
    c.underwaterTubeMaxSpeedKnots !== UNDERWATER_TUBE_MAX_SPEED_KNOTS ||
    c.underwaterTubeMaxSpeedUmS !== UNDERWATER_TUBE_MAX_SPEED_UM_S
  )
    throwMismatch(c, "torpedo_v1 §7 underwater-tube speed limit");
  if (
    c.aboveWaterFixedMaxLaunchSpeedKnots !== ABOVE_WATER_FIXED_MAX_LAUNCH_SPEED_KNOTS ||
    c.aboveWaterTrainableMaxLaunchSpeedKnots !== ABOVE_WATER_TRAINABLE_MAX_LAUNCH_SPEED_KNOTS
  )
    throwMismatch(c, "torpedo_v1 §8 above-water launch speed defaults");
  if (c.targetContactMinimumBp !== TORPEDO_TARGET_CONTACT_MINIMUM_BP)
    throwMismatch(c, "torpedo_v1 §6 target contact minimum");
  if (!c.solutionMinimumBp) throwMismatch(c, "torpedo_v1 §10 solution minimums missing");
  if (!arrayEquals(Object.keys(c.solutionMinimumBp).sort(), [...TORPEDO_LAUNCH_KINDS].sort()))
    throwMismatch(c, "torpedo_v1 §10 solution-minimum launch-kind set");
  for (const kind of TORPEDO_LAUNCH_KINDS) {
    if (c.solutionMinimumBp[kind] !== TORPEDO_SOLUTION_MINIMUM_BP[kind])
      throwMismatch(c, `torpedo_v1 §10 solution minimum for launch kind ${kind}`);
  }
  if (c.maxLaunchSeaState !== TORPEDO_MAX_LAUNCH_SEA_STATE)
    throwMismatch(c, "torpedo_v1 §6 sea-state launch ceiling");
  if (
    c.oxygenRangeMultiplierBp !== OXYGEN_RANGE_MULTIPLIER_BP ||
    c.oxygenSpeedMultiplierBp !== OXYGEN_SPEED_MULTIPLIER_BP ||
    c.oxygenWakeDetectionMultiplierBp !== OXYGEN_WAKE_DETECTION_MULTIPLIER_BP ||
    c.oxygenTubeHitSevereFloodingMultiplierBp !== OXYGEN_TUBE_HIT_SEVERE_FLOODING_MULTIPLIER_BP ||
    c.oxygenChainReactionBaseBp !== OXYGEN_CHAIN_REACTION_BASE_BP
  )
    throwMismatch(c, "torpedo_v1 §23 oxygen effects");
  // INC-3 §10 fire-solution manifest: closed factor list (ordered), exact scale
  // exponent/rounding, exact final clamp, exact neutral multiplier.
  if (!c.solutionFactorKeys || !arrayEquals(c.solutionFactorKeys, TORPEDO_SOLUTION_FACTOR_KEYS))
    throwMismatch(c, "torpedo_v1 §10 solution factor manifest");
  if (c.solutionScaleExponent !== TORPEDO_SOLUTION_SCALE_EXPONENT)
    throwMismatch(c, "torpedo_v1 §10 solution scale exponent");
  if (c.solutionRounding !== TORPEDO_SOLUTION_ROUNDING)
    throwMismatch(c, "torpedo_v1 §10 solution rounding");
  if (c.neutralSolutionMultiplierBp !== NEUTRAL_TORPEDO_SOLUTION_MULTIPLIER_BP)
    throwMismatch(c, "torpedo_v1 §10 neutral solution multiplier");
  if (c.solutionFinalMinBp !== TORPEDO_SOLUTION_FINAL_MIN_BP)
    throwMismatch(c, "torpedo_v1 §10 solution final min");
  if (c.solutionFinalMaxBp !== TORPEDO_SOLUTION_FINAL_MAX_BP)
    throwMismatch(c, "torpedo_v1 §10 solution final max");
  if (c.friendlyDangerSectorMinimumBp !== TORPEDO_FRIENDLY_DANGER_SECTOR_MINIMUM_BP)
    throwMismatch(c, "torpedo_v1 §10/§24 friendly danger-sector minimum");
  // INC-3 §24 friendly-fire geometry + the retired-marker surface.
  if (c.friendlyFireMinSeparationM !== TORPEDO_FRIENDLY_FIRE_MIN_SEPARATION_M)
    throwMismatch(c, "torpedo_v1 §24 friendly-fire minimum separation");
  if (c.dangerSectorRadToMdeg !== TORPEDO_DANGER_SECTOR_RAD_TO_MDEG)
    throwMismatch(c, "torpedo_v1 §24 danger-sector rad-to-mdeg");
  if (c.friendlyFireLowConfidenceBp !== TORPEDO_FRIENDLY_FIRE_LOW_CONFIDENCE_BP)
    throwMismatch(c, "torpedo_v1 §24 friendly-fire low-confidence gate");
  if (c.unidentifiedContactIdentity !== UNIDENTIFIED_CONTACT_IDENTITY)
    throwMismatch(c, "torpedo_v1 §24 unidentified identity marker");
  // INC-3 §11 salvo policy: closed enums, base/withdrawal tables, weights, and
  // the authored band tables (exact deep equality).
  if (!c.missionObjectives || !arrayEquals(c.missionObjectives, TORPEDO_MISSION_OBJECTIVES))
    throwMismatch(c, "torpedo_v1 §11 mission-objective closed enum");
  if (!c.withdrawalStates || !arrayEquals(c.withdrawalStates, TORPEDO_WITHDRAWAL_STATES))
    throwMismatch(c, "torpedo_v1 §11 withdrawal-state closed enum");
  if (!recordEquals(c.salvoBaseTubes, TORPEDO_SALVO_BASE_TUBES))
    throwMismatch(c, "torpedo_v1 §11 salvo base tubes");
  if (!recordEquals(c.salvoWithdrawalModifierTubes, TORPEDO_SALVO_WITHDRAWAL_MODIFIER_TUBES))
    throwMismatch(c, "torpedo_v1 §11 salvo withdrawal modifier");
  if (!c.salvoFactorKeys || !arrayEquals(c.salvoFactorKeys, TORPEDO_SALVO_FACTOR_KEYS))
    throwMismatch(c, "torpedo_v1 §11 salvo factor manifest");
  if (!recordEquals(c.salvoFactorWeightsBp, TORPEDO_SALVO_FACTOR_WEIGHTS_BP))
    throwMismatch(c, "torpedo_v1 §11 salvo factor weights");
  if (c.salvoBpPerTube !== TORPEDO_SALVO_BP_PER_TUBE)
    throwMismatch(c, "torpedo_v1 §11 salvo bp per tube");
  if (c.salvoMinTubes !== TORPEDO_SALVO_MIN_TUBES)
    throwMismatch(c, "torpedo_v1 §11 salvo minimum tubes");
  if (!bandTableEquals(c.salvoRangePressureBpTable, TORPEDO_SALVO_RANGE_PRESSURE_BP_TABLE))
    throwMismatch(c, "torpedo_v1 §11 salvo range-pressure bands");
  if (!bandTableEquals(c.salvoAmmoScarcityBpTable, TORPEDO_SALVO_AMMO_SCARCITY_BP_TABLE))
    throwMismatch(c, "torpedo_v1 §11 salvo ammo-scarcity bands");
  if (
    !bandTableEquals(
      c.salvoFriendlyLauncherPressureBpTable,
      TORPEDO_SALVO_FRIENDLY_LAUNCHER_PRESSURE_BP_TABLE,
    )
  )
    throwMismatch(c, "torpedo_v1 §11 salvo friendly-launcher pressure bands");
  // INC-4 §12 launch timing/failure: exact base, clamp, firing substep, the
  // authored modifier composition (divisors + damage/crew/band tables), and the
  // stuck-in-tube share of mechanical failures.
  if (c.launchFailureBaseBp !== TORPEDO_LAUNCH_FAILURE_BASE_BP)
    throwMismatch(c, "torpedo_v1 §12 launch-failure base (100 bp)");
  if (c.launchFailureMinBp !== TORPEDO_LAUNCH_FAILURE_MIN_BP)
    throwMismatch(c, "torpedo_v1 §12 launch-failure min");
  if (c.launchFailureMaxBp !== TORPEDO_LAUNCH_FAILURE_MAX_BP)
    throwMismatch(c, "torpedo_v1 §12 launch-failure max");
  if (c.launchSubstep !== TORPEDO_LAUNCH_SUBSTEP)
    throwMismatch(c, "torpedo_v1 §12 declared firing substep");
  if (c.launchFailureModelReliabilityDivisor !== TORPEDO_LAUNCH_FAILURE_MODEL_RELIABILITY_DIVISOR)
    throwMismatch(c, "torpedo_v1 §12 model-reliability modifier divisor");
  if (!recordEquals(c.launchFailureDamageAdjustmentBp, TORPEDO_LAUNCH_FAILURE_DAMAGE_ADJUSTMENT_BP))
    throwMismatch(c, "torpedo_v1 §12 launcher-damage modifier table");
  if (c.launchFailureCrewNeutralBp !== TORPEDO_LAUNCH_FAILURE_CREW_NEUTRAL_BP)
    throwMismatch(c, "torpedo_v1 §12 crew modifier neutral point");
  if (c.launchFailureCrewAdjustmentDivisor !== TORPEDO_LAUNCH_FAILURE_CREW_ADJUSTMENT_DIVISOR)
    throwMismatch(c, "torpedo_v1 §12 crew modifier divisor");
  if (
    !bandTableEquals(
      c.launchFailureReliabilityBandTable,
      TORPEDO_LAUNCH_FAILURE_RELIABILITY_BAND_TABLE,
    )
  )
    throwMismatch(c, "torpedo_v1 §12 reliability-band modifier table");
  if (c.stuckInTubeShareBp !== TORPEDO_STUCK_IN_TUBE_SHARE_BP)
    throwMismatch(c, "torpedo_v1 §12 stuck-in-tube share of failures");
  // INC-4 §13 track: closed terminal-result union, area-fire marker, minute
  // quantum, and the mdeg -> degree projection fold.
  if (!c.terminalResults || !arrayEquals(c.terminalResults, TORPEDO_TERMINAL_RESULTS))
    throwMismatch(c, "torpedo_v1 §13 terminal-result closed union");
  if (c.noTargetContact !== NO_TARGET_CONTACT)
    throwMismatch(c, "torpedo_v1 §13 area-fire target marker");
  if (c.torpedoMinuteMs !== TORPEDO_MINUTE_MS)
    throwMismatch(c, "torpedo_v1 §13 track minute quantum");
  if (c.trackMdegPerDegree !== TORPEDO_TRACK_MDEG_PER_DEGREE)
    throwMismatch(c, "torpedo_v1 §13 mdeg-to-degree projection fold");
  // Fail closed on the shipped-model-id list: exact (ordered) equality with the
  // INC-1 seed ids. A tampered/empty/extra list never passes — the full
  // research-grounded rollup lands in INC-8 under the same fail-closed check.
  if (!c.shippedModelIds || !arrayEquals(c.shippedModelIds, SEED_TORPEDO_MODEL_IDS))
    throwMismatch(c, "torpedo_v1 shipped model id list");
}

// Fail-closed conversion: integer basis-point knots -> integer µm/s. Rejects
// non-integers and unsafe integers at the boundary (ENGINEERING-CONTRACT
// arithmetic). The division by SPEED_BP_SCALE is exact by construction for the
// shipped scale (knots * 1_000 * 514_444 / 1_000).
export function torpedoSpeedBpKnotsToUmS(speedKnotsBp: number): number {
  if (!Number.isInteger(speedKnotsBp) || speedKnotsBp <= 0) {
    throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
      code: TORPEDO_STATE_INVARIANT_FAILED,
      reason: "speed must be a positive integer in basis-point knots",
      value: speedKnotsBp,
    });
  }
  const umS = (speedKnotsBp * TORPEDO_KNOTS_TO_UM_S) / TORPEDO_SPEED_BP_SCALE;
  if (!Number.isSafeInteger(umS)) {
    throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
      code: TORPEDO_STATE_INVARIANT_FAILED,
      reason: "speed conversion produced an unsafe integer",
      speedKnotsBp,
      umS,
    });
  }
  return umS;
}
