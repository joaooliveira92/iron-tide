import type { FireRecord, FloodingSourceRecord, ShipDamageState } from "./state.js";
import { withDamageStateHash } from "./state.js";
import type { DamageControlResource } from "./damageControlConstants.js";
import {
  allocateDamageControl,
  getEffectivePumping,
  getEffectiveFirefighting,
  getEffectiveRepairReduction,
  type DamageControlAllocation,
} from "./damageControl.js";
import { resolveFireProgression, computeFireSmokeStrength } from "./fireResolution.js";
import { floodedWaterBpFromKg, resolveFloodingProgression } from "./floodingResolution.js";
import { evaluateTerminalSeam } from "./terminalSeam.js";
import { BluewaveError } from "@bluewave/contracts";
import { INVALID_SHIP_DAMAGE_STATE } from "./reasonCodes.js";
import type { SmokeSourceType } from "../smoke/constants.js";
import { createSmokeEventRecord, type SmokeEventRecord } from "../smoke/smokeRecords.js";

export interface DamageControlContext {
  fireRecords: FireRecord[];
  floodingRecords: FloodingSourceRecord[];
  floodedWaterBp: number;
  designDisplacementKg: number;
  shipType: string;
  currentSpeedKt: number;
  resources: DamageControlResource;
  keyedRng: ((stream: string) => number) | null;
  shipId?: string;
}

export interface DamageControlStageResult {
  fireRecords: FireRecord[];
  floodingRecords: FloodingSourceRecord[];
  nextFloodedWaterBp: number;
  allocations: DamageControlAllocation[];
  smokeEventRecords: SmokeEventRecord[];
  highSpeedLoss: boolean;
  netDeltaKgMin: number;
}

export interface DamageDesignSurface {
  designFlotationReserve: number;
  designStabilityScore: number;
}

export function requireDamageDesignSurface(
  design: DamageDesignSurface | undefined,
  battleId: string,
  shipId: string,
): DamageDesignSurface {
  if (!design) {
    throw new BluewaveError(INVALID_SHIP_DAMAGE_STATE, {
      code: INVALID_SHIP_DAMAGE_STATE,
      battleId,
      shipId,
      reason:
        "damage-control write-back requires the ship's design surface (flotation reserve / stability score)",
    });
  }
  return design;
}

export function resolveDamageControl(
  context: DamageControlContext,
  battleMinute: number,
  substep: number,
): DamageControlStageResult {
  const floodedWaterBp = floodedWaterBpFromKg(context.floodedWaterBp, context.designDisplacementKg);
  const { allocations } = allocateDamageControl(
    context.resources,
    context.fireRecords,
    context.floodingRecords,
    floodedWaterBp,
  );

  const effectivePumping = getEffectivePumping(allocations);
  const _effectiveFirefighting = getEffectiveFirefighting(allocations);
  const effectiveRepairReduction = getEffectiveRepairReduction(allocations);

  const { fireRecords, newFires } = resolveFireProgression(
    context.fireRecords,
    context.shipType,
    context.keyedRng,
  );

  const allFires = [...fireRecords, ...newFires];

  const progressiveFailureBp = 10_000;
  const { nextFloodedWaterBp, highSpeedLoss, netDeltaKgMin } = resolveFloodingProgression(
    context.floodingRecords,
    context.floodedWaterBp,
    context.designDisplacementKg,
    context.currentSpeedKt,
    progressiveFailureBp,
    effectivePumping,
    effectiveRepairReduction,
    context.keyedRng,
  );

  const smokeEventRecords: SmokeEventRecord[] = [];
  for (const fire of allFires) {
    const smokeStrength = computeFireSmokeStrength(fire.intensityBp, context.shipType);
    if (smokeStrength > 0) {
      const shipPrefix = context.shipId ? `${context.shipId}:` : "";
      const cloudId = `fire-smoke:${shipPrefix}${fire.locationId}:${battleMinute}`;
      smokeEventRecords.push(
        createSmokeEventRecord({
          kind: "FUNNEL_EMISSION",
          battleMinute,
          substep,
          sourceType: "FIRE" as SmokeSourceType,
          sourceId: fire.locationId,
          cloudId,
          position: [0, 0] as readonly [number, number],
          densityBp: smokeStrength,
          weatherContext: null,
        }),
      );
    }
  }

  return {
    fireRecords: allFires,
    floodingRecords: context.floodingRecords,
    nextFloodedWaterBp,
    allocations,
    smokeEventRecords,
    highSpeedLoss,
    netDeltaKgMin,
  };
}

export interface DamageControlWriteBackInput {
  state: ShipDamageState;
  stageResult: DamageControlStageResult;
  designFlotationReserve: number;
  designStabilityScore: number;
}

export interface DamageControlWriteBackOutput {
  state: ShipDamageState;
  changed: boolean;
}

export function applyDamageControlToState(
  input: DamageControlWriteBackInput,
): DamageControlWriteBackOutput {
  const { state, stageResult, designFlotationReserve, designStabilityScore } = input;

  const flotationReserveAfter = Math.max(0, state.flotationReserve - stageResult.netDeltaKgMin);
  const flotationPct =
    designFlotationReserve > 0
      ? Math.floor((flotationReserveAfter * 10_000) / designFlotationReserve)
      : 0;
  const stabilityPct =
    designStabilityScore > 0
      ? Math.floor((state.stabilityScore * 10_000) / designStabilityScore)
      : 0;
  const terminal = evaluateTerminalSeam({
    flotationReserveAfter,
    structuralIntegrityAfter: state.structuralIntegrity,
    progressiveFloodingTotal: stageResult.nextFloodedWaterBp,
    catastrophicBreakup: false,
    capsizeRisk: false,
    currentTerminalStatus: state.terminalStatus,
    flotationPct,
    stabilityPct,
  });

  const next: ShipDamageState = {
    ...state,
    fireRecords: [...stageResult.fireRecords],
    floodingRecords: [...stageResult.floodingRecords],
    progressiveFloodingTotal: stageResult.nextFloodedWaterBp,
    flotationReserve: flotationReserveAfter,
    terminalStatus: terminal.transition === "NONE" ? state.terminalStatus : terminal.transition,
  };

  const changed =
    next.flotationReserve !== state.flotationReserve ||
    next.progressiveFloodingTotal !== state.progressiveFloodingTotal ||
    next.terminalStatus !== state.terminalStatus ||
    !fireRecordsEqual(state.fireRecords, next.fireRecords) ||
    !floodingRecordsEqual(state.floodingRecords, next.floodingRecords);

  if (!changed) return { state, changed: false };
  return { state: withDamageStateHash(next), changed: true };
}

function fireRecordsEqual(a: readonly FireRecord[], b: readonly FireRecord[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.locationId !== y.locationId || x.intensityBp !== y.intensityBp || x.cause !== y.cause)
      return false;
  }
  return true;
}

function floodingRecordsEqual(
  a: readonly FloodingSourceRecord[],
  b: readonly FloodingSourceRecord[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.compartmentId !== y.compartmentId || x.rateKgMin !== y.rateKgMin || x.cause !== y.cause)
      return false;
  }
  return true;
}
