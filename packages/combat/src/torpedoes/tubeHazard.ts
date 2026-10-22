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

export const underwaterTubeHitHazardPolicyId = "underwater_tube_hit_hazard_v1" as const;
export const TORPEDO_TUBE_HAZARD_BASE_BP = 5_000 as const;
export const TORPEDO_TUBE_HAZARD_SCALE_EXPONENT = 4 as const;

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

export const TORPEDO_TUBE_ISOLATION_MULTIPLIER_BP: Record<FloodingIsolationState, number> = {
  INTACT: 7_500,
  DEGRADED: 10_000,
  FAILED: 15_000,
};

export const TORPEDO_TUBE_PROTECTION_LEVELS = ["NONE", "STANDARD", "IMPROVED"] as const;
export type TorpedoTubeProtectionLevel = (typeof TORPEDO_TUBE_PROTECTION_LEVELS)[number];
export const TORPEDO_TUBE_PROTECTION_MULTIPLIER_BP: Record<TorpedoTubeProtectionLevel, number> = {
  NONE: 12_500,
  STANDARD: 10_000,
  IMPROVED: 7_500,
};

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

export function computeUnderwaterTubeSevereFloodingBp(o: {
  loadedTubeMultiplierBp?: number;
  loadedCount?: number;
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
  return Math.min(budget, remainingFlotationReserve);
}

export interface TubeHazardChainProbe {
  tubeIndex: number;
  torpedoModelId: string;
}

export interface TorpedoTubeHazardResult {
  severe: boolean;
  severeFloodingProbabilityBp: number;
  decision: { streamId: string; draw: number; drawBp: number } | null;
  immediateAdditionalFloodingKg: number;
  extraFloodingSource: FloodingSourceRecord | null;
  launcherDamageState: LauncherDamageState;
  chainChecks: readonly TubeHazardChainProbe[];
  crewCasualties: number;
  crewCasualtyRoll: { streamId: string; draw: number; drawBp: number } | null;
  shockCandidates: readonly SystemShockCandidate[];
  reasonCode: string | null;
}

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
  crewAtRisk: number;
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

  const immediateAdditionalFloodingKg = computeSevereImmediateFloodingKg(
    o.remainingFlotationReserve,
  );
  const extraFloodingSource = createSevereTubeFloodingSource({
    compartmentId: o.targetCompartmentId,
    baseProgressiveRateKgMin: o.baseProgressiveRateKgMin,
  });

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
