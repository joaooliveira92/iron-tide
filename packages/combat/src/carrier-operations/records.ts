import { SafeInt } from "@bluewave/contracts";

export interface CarrierOperationRecord {
  battleMinute: number;
  substep: string;
  carrierId: string;
  squadronId: string | undefined;
  aircraftId: string | undefined;
  capacityUnitsDelta: SafeInt | undefined;
  spotInputs: unknown;
  spotResult: SafeInt | undefined;
  jetPredicates: unknown;
  deckState: string | undefined;
  contentionResult: string | undefined;
  timingMinutes: number | undefined;
  ratePerMinute: number | undefined;
  weatherInputs: unknown;
  windInputs: unknown;
  hazardExposure: SafeInt | undefined;
  hazardDecision: string | undefined;
  inventoryTransaction: unknown;
  formulaVersion: string;
  contentVersion: string;
  rulesetVersion: string;
  rngVersion: string | undefined;
  recordHash: string;
}

export interface CanonicalRecordInput {
  minute: number;
  substep: string;
  carrierId: string;
  squadronId?: string;
  aircraftId?: string;
  formulaVersion: string;
  contentVersion: string;
  rulesetVersion: string;
  rngVersion?: string;
}

export function createCarrierOperationRecord(
  input: CanonicalRecordInput,
  overrides: Partial<CarrierOperationRecord> = {},
): CarrierOperationRecord {
  return {
    battleMinute: input.minute,
    substep: input.substep,
    carrierId: input.carrierId,
    squadronId: input.squadronId,
    aircraftId: input.aircraftId,
    capacityUnitsDelta: undefined,
    spotInputs: undefined,
    spotResult: undefined,
    jetPredicates: undefined,
    deckState: undefined,
    contentionResult: undefined,
    timingMinutes: undefined,
    ratePerMinute: undefined,
    weatherInputs: undefined,
    windInputs: undefined,
    hazardExposure: undefined,
    hazardDecision: undefined,
    inventoryTransaction: undefined,
    formulaVersion: input.formulaVersion,
    contentVersion: input.contentVersion,
    rulesetVersion: input.rulesetVersion,
    rngVersion: input.rngVersion,
    recordHash: "a".repeat(64),
    ...overrides,
  };
}

export interface CarrierRecordKey {
  carrierId: string;
  isEmergency: boolean;
  operationClassPriority: number;
  strikeLaunchMinute: number;
  strikeId: string;
  squadronId: string;
  aircraftModelId: string;
  aircraftId: string;
  equipmentId: string;
  hazardEventId: string;
  ordnanceItemId: string;
  transactionId: string;
}

export function recordComparator(a: CarrierRecordKey, b: CarrierRecordKey): number {
  if (a.carrierId !== b.carrierId) return a.carrierId < b.carrierId ? -1 : 1;
  if (a.isEmergency !== b.isEmergency) return a.isEmergency ? -1 : 1;
  if (a.operationClassPriority !== b.operationClassPriority)
    return a.operationClassPriority - b.operationClassPriority;
  if (a.strikeLaunchMinute !== b.strikeLaunchMinute)
    return a.strikeLaunchMinute - b.strikeLaunchMinute;
  if (a.strikeId !== b.strikeId) return a.strikeId < b.strikeId ? -1 : 1;
  if (a.squadronId !== b.squadronId) return a.squadronId < b.squadronId ? -1 : 1;
  if (a.aircraftModelId !== b.aircraftModelId)
    return a.aircraftModelId < b.aircraftModelId ? -1 : 1;
  if (a.aircraftId !== b.aircraftId) return a.aircraftId < b.aircraftId ? -1 : 1;
  if (a.equipmentId !== b.equipmentId) return a.equipmentId < b.equipmentId ? -1 : 1;
  if (a.hazardEventId !== b.hazardEventId) return a.hazardEventId < b.hazardEventId ? -1 : 1;
  if (a.ordnanceItemId !== b.ordnanceItemId) return a.ordnanceItemId < b.ordnanceItemId ? -1 : 1;
  if (a.transactionId !== b.transactionId) return a.transactionId < b.transactionId ? -1 : 1;
  return 0;
}

export function sortRecords(keys: readonly CarrierRecordKey[]): CarrierRecordKey[] {
  return [...keys].sort(recordComparator);
}
