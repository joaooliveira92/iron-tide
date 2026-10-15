// DESIGN-40 §21 underwater-tube hit hazard (INC-6, AC-18). A hit on a
// compartment containing loaded underwater torpedo tubes MUST evaluate
// `underwater_tube_hit_hazard_v1`:
//   severeFloodingProbabilityBp = clamp(0, 10_000,
//     floor(5_000 * loadedTubeMultiplierBp * torpedoPropellantMultiplierBp *
//       isolationMultiplierBp * protectionMultiplierBp / 10_000^4))
// with the shipped tables — loaded tubes 2_500/10_000/12_500; propulsion
// ordinary air/wet-heater 10_000 / oxygen 15_000 / electric 7_500;
// isolation intact/degraded/failed 7_500/10_000/15_000; protection
// none/standard/improved 12_500/10_000/7_500 — and base 5_000 bp. A SEVERE
// result (one keyed draw below the composed probability) MUST create:
//   1. immediate additional flooding = 5_000 bp of the remaining flotation
//      reserve, capped by the reserve;
//   2. ONE additional flooding source at the shipped rate multiplier
//      15_000 bp over the ongoing progressive rate (creation-only);
//   3. launcher damage state DESTROYED;
//   4. a §22 loaded-torpedo chain-reaction check per loaded tube;
//   5. crew-casualty + nearby-system-shock checks.
// The severe result records the in-slice cause UNDERWATER_TUBE_SEVERE_FLOODING.
// A non-severe result creates none of those effects and consumes NO draw (the
// hazard draw layout is deterministic: AT MOST ONE hazard draw; the casualty
// and shock draws only exist inside the severe branch).
//
// INTERPRETATION (reviewer MEDIUM-1, DESIGN-40 §16/§17): the §21 "immediate
// additional flooding" (item 1) is FLOTATION-RESERVE loss per §16/§17
// semantics — it is immediate flotation loss, NOT a progressive-flooding
// accumulation. The SEPARATE progressive source is item 2 (the 15_000 bp
// extra source), a C-5 progressive source. The caller (damagePackage.ts)
// applies the immediate flooding as flotation-reserve loss (floor-at-0, capped
// by the reserve) so evaluateTerminalSeam can still see a SINKING/SUNK boundary;
// the caller does NOT add item 1 into progressiveFloodingTotal.
//
// The constant surface ships under the spec-named `underwater_tube_hit_hazard_v1`
// policy as SHIPPED_UNDERWATER_TUBE_HIT_HAZARD_CONTRACT + a fail-closed guard
// (AC-24), mirroring the detonation-contract precedent.
//
// Crew casualty + shock checks: §21 lists them without pinned numbers;
// INC-6 ships authored BALANCE TARGET bases (recorded for ADR-0029 in
// damageConstants.ts): the casualty check rolls against 5_000 bp and a
// successful roll applies TORPEDO_TUBE_CREW_CASUALTY_SHARE_BP (2_500 bp =
// 25%) of the at-risk crew (integer input) as casualties; the nearby-system
// shock check is performed by the caller through the §20 evaluator
// (evaluateTorpedoSystemShock, systemShock.ts) over the systems the layout
// classifies around the tube bay — this module returns the compounded
// processed inputs.
//
// Pure/deterministic: no ambient I/O/clock/random.
import { BluewaveError } from "@bluewave/contracts";
import {
  FLOODING_ISOLATION_STATES,
  type FloodingIsolationState,
  type LauncherDamageState,
  type TorpedoPropulsionType,
} from "./constants.js";
import {
  TORPEDO_TUBE_CREW_CASUALTY_BASE_BP,
  TORPEDO_TUBE_CREW_CASUALTY_SHARE_BP,
  TORPEDO_TUBE_SEVERE_FLOODING_BUDGET_BP,
} from "./damageConstants.js";
import { TORPEDO_BASIS_POINTS_PER_UNIT } from "./constants.js";
import { TORPEDO_STATE_INVARIANT_FAILED, UNDERWATER_TUBE_SEVERE_FLOODING } from "./reasonCodes.js";
import { createSevereTubeFloodingSource } from "./flooding.js";
import type { FloodingSourceRecord } from "../damage/state.js";
import { tubeHitPropulsionMultiplierBp } from "./oxygen.js";
import {
  assertSystemShockCandidate,
  eligibleShockSystems,
  type SystemShockCandidate,
} from "./systemShock.js";

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

// §21 shipped constant surface under the spec-named policy id.
export const underwaterTubeHitHazardPolicyId = "underwater_tube_hit_hazard_v1" as const;
export const TORPEDO_TUBE_HAZARD_BASE_BP = 5_000 as const;
export const TORPEDO_TUBE_HAZARD_SCALE_EXPONENT = 4 as const; // 10_000^4

// §21 loaded-tube multipliers (no loaded / one loaded / two or more).
export const TORPEDO_TUBE_LOADED_MULTIPLIER_BP = Object.freeze({
  NO_LOADED_TORPEDO: 2_500,
  ONE_LOADED_TUBE: 10_000,
  TWO_OR_MORE_LOADED_TUBES: 12_500,
} as const);

export function loadedTubeMultiplierBp(loadedCount: number): number {
  if (!isInt(loadedCount) || loadedCount < 0)
    invariant("loadedCount", loadedCount, "loaded tube count must be a non-negative integer");
  if (loadedCount === 0) return TORPEDO_TUBE_LOADED_MULTIPLIER_BP.NO_LOADED_TORPEDO;
  if (loadedCount === 1) return TORPEDO_TUBE_LOADED_MULTIPLIER_BP.ONE_LOADED_TUBE;
  return TORPEDO_TUBE_LOADED_MULTIPLIER_BP.TWO_OR_MORE_LOADED_TUBES;
}

// §21 isolation multipliers (tube-bay section — distinct from the §18 table).
export const TORPEDO_TUBE_ISOLATION_MULTIPLIER_BP: Record<FloodingIsolationState, number> = {
  INTACT: 7_500,
  DEGRADED: 10_000,
  FAILED: 15_000,
};

// §21 tube-bay protection levels (no dedicated / standard / improved).
export const TORPEDO_TUBE_PROTECTION_LEVELS = ["NONE", "STANDARD", "IMPROVED"] as const;
export type TorpedoTubeProtectionLevel = (typeof TORPEDO_TUBE_PROTECTION_LEVELS)[number];
export const TORPEDO_TUBE_PROTECTION_MULTIPLIER_BP: Record<TorpedoTubeProtectionLevel, number> = {
  NONE: 12_500,
  STANDARD: 10_000,
  IMPROVED: 7_500,
};

// UnderwaterTubeHitHazardContract — the §21 name-branded fail-closed surface.
export interface UnderwaterTubeHitHazardContract {
  policyId: string;
  baseSevereFloodingBp: number;
  scaleExponent: number;
  loadedTubeMultiplierBp: Record<string, number>;
  floodingIsolationMultiplierBp: Record<FloodingIsolationState, number>;
  protectionLevels: readonly TorpedoTubeProtectionLevel[];
  protectionMultiplierBp: Record<TorpedoTubeProtectionLevel, number>;
}

export const SHIPPED_UNDERWATER_TUBE_HIT_HAZARD_CONTRACT: UnderwaterTubeHitHazardContract = {
  policyId: underwaterTubeHitHazardPolicyId,
  baseSevereFloodingBp: TORPEDO_TUBE_HAZARD_BASE_BP,
  scaleExponent: TORPEDO_TUBE_HAZARD_SCALE_EXPONENT,
  loadedTubeMultiplierBp: TORPEDO_TUBE_LOADED_MULTIPLIER_BP,
  floodingIsolationMultiplierBp: TORPEDO_TUBE_ISOLATION_MULTIPLIER_BP,
  protectionLevels: TORPEDO_TUBE_PROTECTION_LEVELS,
  protectionMultiplierBp: TORPEDO_TUBE_PROTECTION_MULTIPLIER_BP,
};

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

function contractRecordEquals(
  a: Record<string, number> | null | undefined,
  b: Record<string, number>,
): boolean {
  if (!a) return false;
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  return bKeys.every((k) => a[k] === b[k]);
}

export function validateUnderwaterTubeHitHazardContract(
  c: Partial<UnderwaterTubeHitHazardContract> | null | undefined,
): asserts c is UnderwaterTubeHitHazardContract {
  if (!c) throwMismatch(c, "underwater_tube_hit_hazard_v1 missing contract");
  if (c.policyId !== underwaterTubeHitHazardPolicyId) throwMismatch(c, "hazard_v1 policy id");
  if (c.baseSevereFloodingBp !== TORPEDO_TUBE_HAZARD_BASE_BP)
    throwMismatch(c, "§21 base severe-flooding probability (5_000 bp)");
  if (c.scaleExponent !== TORPEDO_TUBE_HAZARD_SCALE_EXPONENT)
    throwMismatch(c, "§21 scale exponent (10_000^4)");
  if (!contractRecordEquals(c.loadedTubeMultiplierBp, TORPEDO_TUBE_LOADED_MULTIPLIER_BP))
    throwMismatch(c, "§21 loaded-tube multipliers");
  if (!contractRecordEquals(c.floodingIsolationMultiplierBp, TORPEDO_TUBE_ISOLATION_MULTIPLIER_BP))
    throwMismatch(c, "§21 isolation multipliers");
  if (!c.protectionLevels || c.protectionLevels.length !== TORPEDO_TUBE_PROTECTION_LEVELS.length)
    throwMismatch(c, "§21 protection-level closed enum");
  for (let i = 0; i < TORPEDO_TUBE_PROTECTION_LEVELS.length; i++) {
    if (c.protectionLevels[i] !== TORPEDO_TUBE_PROTECTION_LEVELS[i])
      throwMismatch(c, "§21 protection-level closed enum");
  }
  if (!contractRecordEquals(c.protectionMultiplierBp, TORPEDO_TUBE_PROTECTION_MULTIPLIER_BP))
    throwMismatch(c, "§21 protection multipliers");
}

// Probability composition.

// AC-18: the exact §21 severe-flooding probability composition. Propulsion may
// be passed as the multiplier or the canonical propulsion type (the §21
// authoritative table in oxygen.ts); isolation as the canonical state or a raw
// bp; protection as the canonical level or a raw bp; loaded tubes as the
// multiplier or the loaded count.
export function computeUnderwaterTubeSevereFloodingBp(o: {
  loadedTubeMultiplierBp?: number;
  loadedCount?: number; // convenience: 0/1/2+ -> the shipped table
  propulsionType?: TorpedoPropulsionType;
  propulsionMultiplierBp?: number;
  isolationState?: FloodingIsolationState;
  isolationMultiplierBp?: number;
  protectionLevel?: TorpedoTubeProtectionLevel;
  protectionMultiplierBp?: number;
}): number {
  if (
    o.protectionLevel !== undefined &&
    !(TORPEDO_TUBE_PROTECTION_LEVELS as readonly string[]).includes(o.protectionLevel)
  )
    invariant("protectionLevel", o.protectionLevel, "protection must be a canonical §21 level");
  if (
    o.isolationState !== undefined &&
    !(FLOODING_ISOLATION_STATES as readonly string[]).includes(o.isolationState)
  )
    invariant("isolationState", o.isolationState, "isolation must be a canonical state");
  const loaded =
    o.loadedTubeMultiplierBp ??
    (o.loadedCount !== undefined
      ? loadedTubeMultiplierBp(o.loadedCount)
      : invariant(
          "loadedTubeMultiplierBp",
          undefined,
          "loaded-tube multiplier or loaded count is required",
        ));
  const propulsion =
    o.propulsionMultiplierBp ??
    (o.propulsionType !== undefined
      ? tubeHitPropulsionMultiplierBp(o.propulsionType)
      : invariant(
          "propulsionMultiplierBp",
          undefined,
          "propulsion multiplier or type is required",
        ));
  const isolation =
    o.isolationMultiplierBp ??
    (o.isolationState !== undefined
      ? TORPEDO_TUBE_ISOLATION_MULTIPLIER_BP[o.isolationState]
      : invariant("isolationMultiplierBp", undefined, "isolation multiplier or state is required"));
  const protection =
    o.protectionMultiplierBp ??
    (o.protectionLevel !== undefined
      ? TORPEDO_TUBE_PROTECTION_MULTIPLIER_BP[o.protectionLevel]
      : invariant(
          "protectionMultiplierBp",
          undefined,
          "protection multiplier or level is required",
        ));
  for (const [field, v] of [
    ["loadedTubeMultiplierBp", loaded],
    ["propulsionMultiplierBp", propulsion],
    ["isolationMultiplierBp", isolation],
    ["protectionMultiplierBp", protection],
  ] as const) {
    if (!isInt(v) || v < 0 || v > 100_000)
      invariant(field, v, "an integer basis-point multiplier within [0, 100_000] is required");
  }
  const numerator =
    BigInt(TORPEDO_TUBE_HAZARD_BASE_BP) *
    BigInt(loaded) *
    BigInt(propulsion) *
    BigInt(isolation) *
    BigInt(protection);
  const denominator =
    BigInt(TORPEDO_BASIS_POINTS_PER_UNIT) ** BigInt(TORPEDO_TUBE_HAZARD_SCALE_EXPONENT);
  const raw = Number(numerator / denominator);
  return Math.min(TORPEDO_BASIS_POINTS_PER_UNIT, Math.max(0, raw));
}

// The severe-branch budget: 5_000 bp of the remaining flotation reserve,
// capped by the reserve — the exact §21 immediate additional flooding.
export function computeSevereImmediateFloodingKg(remainingFlotationReserve: number): number {
  if (!isInt(remainingFlotationReserve) || remainingFlotationReserve < 0)
    invariant(
      "remainingFlotationReserve",
      remainingFlotationReserve,
      "remaining flotation reserve must be a non-negative integer",
    );
  const budget = Math.floor(
    (remainingFlotationReserve * TORPEDO_TUBE_SEVERE_FLOODING_BUDGET_BP) /
      TORPEDO_BASIS_POINTS_PER_UNIT,
  );
  return Math.min(budget, remainingFlotationReserve); // capped by the reserve
}

// The full §21 evaluation.

export interface TubeHazardChainProbe {
  tubeIndex: number;
  torpedoModelId: string;
}

export interface TorpedoTubeHazardResult {
  severe: boolean;
  severeFloodingProbabilityBp: number;
  decision: { streamId: string; draw: number; drawBp: number } | null;
  immediateAdditionalFloodingKg: number; // 0 when not severe
  extraFloodingSource: FloodingSourceRecord | null; // the 15_000 bp extra source
  launcherDamageState: LauncherDamageState; // "DESTROYED" when severe
  chainChecks: readonly TubeHazardChainProbe[]; // per loaded tube (§22 probes)
  crewCasualties: number; // 0 when not severe
  crewCasualtyRoll: { streamId: string; draw: number; drawBp: number } | null;
  shockCandidates: readonly SystemShockCandidate[]; // the §20 pool (severe only)
  reasonCode: string | null; // UNDERWATER_TUBE_SEVERE_FLOODING on severe
}

// AC-18: the complete §21 evaluation. identity: battle/minute/substep/launcher
// + track make the keyed streams unique. loadedTubeCount + loadedChecks are
// the SAME launcher's loaded surface (loadedTubeCount drives the §21 loaded
// group; loadedChecks are the per-tube §22 probes). The tube bay's
// progressive-flooding base rate (the rate the main hit created, in kg/min)
// feeds the extra source; the ship's remaining flotation reserve feeds the
// immediate-flooding budget. The severe branch consumes THREE keyed draws in
// this fixed order (hazard -> casualty); the shock pool is RETURNED for the
// caller to resolve through the §20 evaluator (the plant draws are staged by
// the caller — damagePackage.ts documents the full composite layout).
export function resolveUnderwaterTubeHitHazard(o: {
  battleId: string;
  impactMinute: number;
  impactSubstep: number;
  torpedoTrackId: string;
  launcherId: string;
  severeFloodingProbabilityBp: number;
  loadedTubeCount: number;
  loadedChecks: readonly TubeHazardChainProbe[];
  baseProgressiveRateKgMin: number;
  remainingFlotationReserve: number;
  crewAtRisk: number; // integer crew present at the tube bay (casualty pool)
  shockCandidates: readonly SystemShockCandidate[];
  keyedRng: (stream: string) => number;
  targetCompartmentId: string;
}): TorpedoTubeHazardResult {
  if (
    typeof o.battleId !== "string" ||
    o.battleId.length === 0 ||
    !isInt(o.impactMinute) ||
    o.impactMinute < 0 ||
    !isInt(o.impactSubstep) ||
    o.impactSubstep < 1 ||
    typeof o.torpedoTrackId !== "string" ||
    o.torpedoTrackId.length === 0 ||
    typeof o.launcherId !== "string" ||
    o.launcherId.length === 0
  )
    invariant("identity", o, "the tube-hazard identity inputs must be well-formed");
  if (
    !isInt(o.severeFloodingProbabilityBp) ||
    o.severeFloodingProbabilityBp < 0 ||
    o.severeFloodingProbabilityBp > TORPEDO_BASIS_POINTS_PER_UNIT
  )
    invariant(
      "severeFloodingProbabilityBp",
      o.severeFloodingProbabilityBp,
      "severe-flooding probability must be an integer bp within [0, 10_000]",
    );
  if (!isInt(o.loadedTubeCount) || o.loadedTubeCount < 0)
    invariant(
      "loadedTubeCount",
      o.loadedTubeCount,
      "loaded tube count must be a non-negative integer",
    );
  if (!Array.isArray(o.loadedChecks))
    invariant("loadedChecks", o.loadedChecks, "loaded checks must be an array");
  for (const c of o.loadedChecks) {
    if (!isInt(c.tubeIndex) || c.tubeIndex < 0)
      invariant("tubeIndex", c.tubeIndex, "tube index must be a non-negative integer");
    if (typeof c.torpedoModelId !== "string" || c.torpedoModelId.length === 0)
      invariant("torpedoModelId", c.torpedoModelId, "model id must be non-empty");
  }
  if (!isInt(o.baseProgressiveRateKgMin) || o.baseProgressiveRateKgMin < 0)
    invariant(
      "baseProgressiveRateKgMin",
      o.baseProgressiveRateKgMin,
      "base progressive rate must be a non-negative integer kg/min",
    );
  if (!isInt(o.remainingFlotationReserve) || o.remainingFlotationReserve < 0)
    invariant(
      "remainingFlotationReserve",
      o.remainingFlotationReserve,
      "remaining flotation reserve must be a non-negative integer",
    );
  if (!isInt(o.crewAtRisk) || o.crewAtRisk < 0)
    invariant("crewAtRisk", o.crewAtRisk, "crew at risk must be a non-negative integer");
  if (typeof o.keyedRng !== "function")
    invariant("keyedRng", o.keyedRng, "a deterministic keyed RNG stream function is required");
  if (typeof o.targetCompartmentId !== "string" || o.targetCompartmentId.length === 0)
    invariant("targetCompartmentId", o.targetCompartmentId, "compartment id must be non-empty");
  if (!Array.isArray(o.shockCandidates))
    invariant("shockCandidates", o.shockCandidates, "shock candidates must be an array");
  (o.shockCandidates as readonly SystemShockCandidate[]).forEach(assertSystemShockCandidate);

  const hazardStream = `battle/torpedo/tube-hazard:${o.battleId}:${o.impactMinute}:${o.impactSubstep}:${o.torpedoTrackId}:${o.launcherId}`;
  const draw = o.keyedRng(hazardStream);
  if (typeof draw !== "number" || draw < 0 || draw >= 1)
    invariant("draw", draw, "the keyed draw must be a float within [0, 1)");
  const drawBp = Math.floor(draw * TORPEDO_BASIS_POINTS_PER_UNIT);
  const severe = drawBp < o.severeFloodingProbabilityBp;

  if (!severe) {
    return Object.freeze({
      severe: false,
      severeFloodingProbabilityBp: o.severeFloodingProbabilityBp,
      decision: Object.freeze({ streamId: hazardStream, draw, drawBp }),
      immediateAdditionalFloodingKg: 0,
      extraFloodingSource: null,
      launcherDamageState: "OPERATIONAL",
      chainChecks: Object.freeze([]),
      crewCasualties: 0,
      crewCasualtyRoll: null,
      shockCandidates: Object.freeze([]),
      reasonCode: null,
    });
  }

  // (1) immediate additional flooding — 5_000 bp of the remaining reserve,
  // capped by the reserve; (2) the one extra source at 15_000 bp.
  const immediateAdditionalFloodingKg = computeSevereImmediateFloodingKg(
    o.remainingFlotationReserve,
  );
  const extraFloodingSource = createSevereTubeFloodingSource({
    compartmentId: o.targetCompartmentId,
    baseProgressiveRateKgMin: o.baseProgressiveRateKgMin,
  });

  // (5) crew-casualty check — one keyed draw vs the authored base; on success
  // a 2_500-bp share of the at-risk crew is lost.
  const casualtyStream = `battle/torpedo/tube-hazard/casualty:${o.battleId}:${o.impactMinute}:${o.impactSubstep}:${o.torpedoTrackId}:${o.launcherId}`;
  const casualtyDraw = o.keyedRng(casualtyStream);
  if (typeof casualtyDraw !== "number" || casualtyDraw < 0 || casualtyDraw >= 1)
    invariant("casualtyDraw", casualtyDraw, "the keyed draw must be a float within [0, 1)");
  const casualtyDrawBp = Math.floor(casualtyDraw * TORPEDO_BASIS_POINTS_PER_UNIT);
  const casualtyStrike = casualtyDrawBp < TORPEDO_TUBE_CREW_CASUALTY_BASE_BP;
  const crewCasualties = casualtyStrike
    ? Math.floor(
        (o.crewAtRisk * TORPEDO_TUBE_CREW_CASUALTY_SHARE_BP) / TORPEDO_BASIS_POINTS_PER_UNIT,
      )
    : 0;

  return Object.freeze({
    severe: true,
    severeFloodingProbabilityBp: o.severeFloodingProbabilityBp,
    decision: Object.freeze({ streamId: hazardStream, draw, drawBp }),
    immediateAdditionalFloodingKg,
    extraFloodingSource,
    launcherDamageState: "DESTROYED",
    chainChecks: Object.freeze([...o.loadedChecks].map((c) => Object.freeze({ ...c }))),
    crewCasualties,
    crewCasualtyRoll: Object.freeze({
      streamId: casualtyStream,
      draw: casualtyDraw,
      drawBp: casualtyDrawBp,
    }),
    shockCandidates: Object.freeze(eligibleShockSystems(o.shockCandidates)),
    reasonCode: UNDERWATER_TUBE_SEVERE_FLOODING,
  });
}
