import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { type MineType } from "./constants.js";
import { effectiveEquipmentModeMultiplierBp, resolveDualEquipmentMode } from "./dual-equipment.js";
import {
  computeEffectiveSweepingValue,
  computeTypeAdjustedSweeping,
  mineTypeSweepResistanceMultiplierBp,
} from "./effective-sweeping.js";
import { mineTypeDefinitionById } from "./model.js";
import {
  computeAreaPressureRecordHash,
  MINE_PRESSURE_MIN,
  type AreaMinePressureRecord,
  withAreaMinePressureRecordHash,
} from "./pressure-record.js";
import {
  INVALID_MINE_PRESSURE_STATE,
  MINE_PRESSURE_REDUCED,
  type MineReasonCode,
} from "./reasonCodes.js";
import { baseSweepingValueById, type SweepingBaseValueKey } from "./sweeping-base-values.js";
import {
  INELIGIBLE_SHIP_SWEEPING_CONTRIBUTION,
  minesweepingShipEligible,
  type MinesweepingEligibilityPredicate,
  type MinesweepingShip,
} from "./sweeping-eligibility.js";

export interface RegionalSweepingShip {
  shipId: string;
  eligibility: MinesweepingShip;
  baseValueKey: SweepingBaseValueKey;
  equipmentIsDualPurpose: boolean;
  lockedMissionOrEquipmentCommand: string | null;
  technologyMultiplierBp: number;
  crewMultiplierBp: number;
  readinessMultiplierBp: number;
  damageMultiplierBp: number;
  supportMultiplierBp: number;
}

export interface RegionalSweepingContribution {
  shipId: string;
  effectiveSweepingValue: SafeInt;
}

export interface IneligibleSweepingShip {
  ship: MinesweepingShip;
  reason: string;
  failingPredicate: MinesweepingEligibilityPredicate | null;
}

export interface RegionalSweepingValueResult {
  regionalSweepingValue: SafeInt;
  over: readonly RegionalSweepingContribution[];
  ineligible: readonly IneligibleSweepingShip[];
}

export function compareMineId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sweepingContributionOrder(
  a: RegionalSweepingContribution,
  b: RegionalSweepingContribution,
): number {
  return compareMineId(a.shipId, b.shipId);
}

export function effectiveSweepingValueForShip(input: RegionalSweepingShip): SafeInt {
  const baseSweepingValue = baseSweepingValueById(input.baseValueKey);
  const mode = resolveDualEquipmentMode(
    input.equipmentIsDualPurpose,
    input.lockedMissionOrEquipmentCommand,
  );
  const resolution = computeEffectiveSweepingValue(baseSweepingValue, {
    equipmentModeMultiplierBp: effectiveEquipmentModeMultiplierBp(mode),
    technologyMultiplierBp: input.technologyMultiplierBp,
    crewMultiplierBp: input.crewMultiplierBp,
    readinessMultiplierBp: input.readinessMultiplierBp,
    damageMultiplierBp: input.damageMultiplierBp,
    supportMultiplierBp: input.supportMultiplierBp,
  });
  return resolution.effectiveSweepingValue;
}

export function computeRegionalSweepingValue(
  ships: readonly RegionalSweepingShip[],
): RegionalSweepingValueResult {
  const over: RegionalSweepingContribution[] = [];
  const ineligible: IneligibleSweepingShip[] = [];

  for (const input of ships) {
    const verdict = minesweepingShipEligible(input.eligibility);
    if (!verdict.eligible) {
      void INELIGIBLE_SHIP_SWEEPING_CONTRIBUTION;
      ineligible.push({
        ship: input.eligibility,
        reason: verdict.reason,
        failingPredicate: verdict.verdict.failingPredicate,
      });
      continue;
    }
    over.push({
      shipId: input.shipId,
      effectiveSweepingValue: effectiveSweepingValueForShip(input),
    });
  }

  const sorted = [...over].sort(sweepingContributionOrder);
  let regionalSweepingValue = SafeInt.ZERO;
  for (const contribution of sorted) {
    regionalSweepingValue = SafeInt.add(regionalSweepingValue, contribution.effectiveSweepingValue);
  }

  return { regionalSweepingValue, over: sorted, ineligible };
}

export interface SweepingAllocationCandidate {
  record: AreaMinePressureRecord;
  threatensSweepingSide: boolean;
  strikeRiskPriority: number;
  resistanceMultiplierBp: number;
}

export function sweepingAllocationOrder(
  a: SweepingAllocationCandidate,
  b: SweepingAllocationCandidate,
): number {
  const threatA = a.threatensSweepingSide ? 1 : 0;
  const threatB = b.threatensSweepingSide ? 1 : 0;
  return (
    threatB - threatA ||
    b.strikeRiskPriority - a.strikeRiskPriority ||
    Number(b.record.pressure) - Number(a.record.pressure) ||
    compareMineId(a.record.mineTypeId, b.record.mineTypeId) ||
    compareMineId(a.record.minePressureId, b.record.minePressureId)
  );
}

export const DEFAULT_STRIKE_RISK_PRIORITY: number = Number.MAX_SAFE_INTEGER;

export interface SweepingAllocationOptions {
  sweepingBelligerentId: string;
  hasMatchingSweepCapability: (record: AreaMinePressureRecord) => boolean;
  recordRiskPriority?: (record: AreaMinePressureRecord) => number;
}

export interface SweepingAllocationResultItem {
  recordId: string;
  mineTypeId: MineType;
  typeAdjustedSweeping: SafeInt;
  sweptPressure: SafeInt;
  pressureAfter: SafeInt;
  unreducedAllocation: SafeInt;
  pressureReducedCode: MineReasonCode | null;
}

export interface SweepingAllocationResult {
  allocations: readonly SweepingAllocationResultItem[];
  leftoverUnusedValue: SafeInt;
}

export function allocateSweeping(
  regionalValue: SafeInt,
  records: readonly AreaMinePressureRecord[],
  opts: SweepingAllocationOptions,
): SweepingAllocationResult {
  if (!SafeInt.isSafeInt(regionalValue) || regionalValue < 0)
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "regionalValue",
      reason: "regional sweeping value must be a non-negative integer (§10)",
      value: regionalValue,
    });

  const riskPriority = opts.recordRiskPriority ?? (() => DEFAULT_STRIKE_RISK_PRIORITY);

  const candidates: SweepingAllocationCandidate[] = records.map((record) => {
    const definition = mineTypeDefinitionById(record.mineTypeId);
    const resistanceMultiplierBp = mineTypeSweepResistanceMultiplierBp(
      definition,
      opts.hasMatchingSweepCapability(record),
    );
    const threatensSweepingSide =
      record.mineTypeId === "CONTROLLED_DEFENSIVE" &&
      record.targetBelligerents.includes(opts.sweepingBelligerentId);
    return {
      record,
      threatensSweepingSide,
      strikeRiskPriority: riskPriority(record),
      resistanceMultiplierBp,
    };
  });
  candidates.sort(sweepingAllocationOrder);

  let remainingBudget = regionalValue;
  const allocations: SweepingAllocationResultItem[] = [];
  for (const candidate of candidates) {
    const { record } = candidate;
    const typeAdjustedSweeping = computeTypeAdjustedSweeping(
      remainingBudget,
      candidate.resistanceMultiplierBp,
    );
    const sweptPressure = SafeInt(Math.min(Number(record.pressure), Number(typeAdjustedSweeping)));
    if (sweptPressure < 0 || sweptPressure > record.pressure)
      throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
        code: INVALID_MINE_PRESSURE_STATE,
        field: "sweptPressure",
        reason: "swept pressure must be within 0..currentPressure (§10, never below zero)",
        value: { currentPressure: record.pressure, sweptPressure },
      });
    const pressureAfter = SafeInt.sub(record.pressure, sweptPressure);
    const unreducedAllocation = SafeInt.sub(typeAdjustedSweeping, sweptPressure);

    remainingBudget = SafeInt.sub(remainingBudget, sweptPressure);

    allocations.push({
      recordId: record.minePressureId,
      mineTypeId: record.mineTypeId,
      typeAdjustedSweeping,
      sweptPressure,
      pressureAfter,
      unreducedAllocation,
      pressureReducedCode: sweptPressure > 0 ? MINE_PRESSURE_REDUCED : null,
    });
  }

  return { allocations, leftoverUnusedValue: remainingBudget };
}

export function applySweptPressure(
  record: AreaMinePressureRecord,
  sweptPressure: SafeInt,
  campaignMonth: SafeInt,
): AreaMinePressureRecord {
  if (!SafeInt.isSafeInt(sweptPressure) || sweptPressure < 0)
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "sweptPressure",
      reason: "swept pressure must be a non-negative integer (§10)",
      value: sweptPressure,
    });
  if (sweptPressure > record.pressure)
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "sweptPressure",
      reason: "swept pressure exceeds current pressure — sweeping never reduces below zero (§10)",
      value: { currentPressure: record.pressure, sweptPressure },
    });
  if (!SafeInt.isSafeInt(campaignMonth))
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "campaignMonth",
      reason: "campaign month must be a safe integer (§10)",
      value: campaignMonth,
    });

  const pressureAfter = SafeInt.sub(record.pressure, sweptPressure);
  const reduced: Omit<AreaMinePressureRecord, "recordHash"> = {
    ...record,
    pressure: pressureAfter,
    lastSweptMonth: campaignMonth,
  };

  if (pressureAfter >= MINE_PRESSURE_MIN) {
    return withAreaMinePressureRecordHash(reduced);
  }
  return {
    ...reduced,
    recordHash: computeAreaPressureRecordHash(reduced as AreaMinePressureRecord),
  };
}
