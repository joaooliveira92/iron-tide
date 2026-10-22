import { type AreaMinePressureRecord } from "./pressure-record.js";
import { SafeInt } from "@bluewave/contracts";
import {
  type SweepingAllocationCandidate,
  compareMineId,
  sweepingAllocationOrder,
  sweepingContributionOrder,
  type RegionalSweepingContribution,
} from "./sweeping-aggregation.js";

export function compareMineStrings(a: string, b: string): number {
  return compareMineId(a, b);
}

export function compareWarsById(a: { warId: string }, b: { warId: string }): number {
  return compareMineStrings(a.warId, b.warId);
}

export function compareAreasById(a: { areaId: string }, b: { areaId: string }): number {
  return compareMineStrings(a.areaId, b.areaId);
}

export function compareMinePressureRecords(
  a: Pick<AreaMinePressureRecord, "layingParticipantId" | "mineTypeId" | "minePressureId">,
  b: Pick<AreaMinePressureRecord, "layingParticipantId" | "mineTypeId" | "minePressureId">,
): number {
  return (
    compareMineStrings(a.layingParticipantId, b.layingParticipantId) ||
    compareMineStrings(a.mineTypeId, b.mineTypeId) ||
    compareMineStrings(a.minePressureId, b.minePressureId)
  );
}

export function compareLayingSourcesById(a: { source: string }, b: { source: string }): number {
  return compareMineStrings(a.source, b.source);
}

export function compareSweepingShipsById(a: { shipId: string }, b: { shipId: string }): number {
  return compareMineStrings(a.shipId, b.shipId);
}

export { sweepingContributionOrder, sweepingAllocationOrder };

export function contributionToAllocationOrder(
  a: RegionalSweepingContribution,
  b: RegionalSweepingContribution,
): number {
  return sweepingContributionOrder(a, b);
}

export function compareSweepAllocation(
  a: SweepingAllocationCandidate,
  b: SweepingAllocationCandidate,
): number {
  return sweepingAllocationOrder(a, b);
}

export interface AllocatedSweepingSortKey {
  minePressureId: string;
  sweptPressure: SafeInt;
  pressureAfter: SafeInt;
  mineTypeId: string;
  threatensSweepingSide: boolean;
  strikeRiskPriority: number;
}

export function compareAllocatedSweepingBySection10(
  a: Pick<
    AllocatedSweepingSortKey,
    | "minePressureId"
    | "sweptPressure"
    | "pressureAfter"
    | "mineTypeId"
    | "threatensSweepingSide"
    | "strikeRiskPriority"
  >,
  b: Pick<
    AllocatedSweepingSortKey,
    | "minePressureId"
    | "sweptPressure"
    | "pressureAfter"
    | "mineTypeId"
    | "threatensSweepingSide"
    | "strikeRiskPriority"
  >,
): number {
  const threatA = a.threatensSweepingSide ? 1 : 0;
  const threatB = b.threatensSweepingSide ? 1 : 0;
  const pressureA = Number(a.sweptPressure) + Number(a.pressureAfter);
  const pressureB = Number(b.sweptPressure) + Number(b.pressureAfter);
  return (
    threatB - threatA ||
    b.strikeRiskPriority - a.strikeRiskPriority ||
    pressureB - pressureA ||
    compareMineStrings(a.mineTypeId, b.mineTypeId) ||
    compareMineStrings(a.minePressureId, b.minePressureId)
  );
}

export function compareTargetChecksById(a: { targetId: string }, b: { targetId: string }): number {
  return compareMineStrings(a.targetId, b.targetId);
}

export function compareRouteChecksByRouteEdgeId(
  a: { routeEdgeId: string },
  b: { routeEdgeId: string },
): number {
  return compareMineStrings(a.routeEdgeId, b.routeEdgeId);
}

export function compareFriendlyFireChecksByShipId(
  a: { shipId: string },
  b: { shipId: string },
): number {
  return compareMineStrings(a.shipId, b.shipId);
}

export function compareEffectsByDeclaredOrdinal(
  a: { ordinal: number; stableId: string },
  b: { ordinal: number; stableId: string },
): number {
  return a.ordinal - b.ordinal || compareMineStrings(a.stableId, b.stableId);
}

export function canonicallySorted<T>(items: readonly T[], compare: (a: T, b: T) => number): T[] {
  return [...items].sort(compare);
}
