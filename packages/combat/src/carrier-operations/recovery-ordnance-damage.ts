import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { CARRIER_ORDNANCE_INVENTORY_INSUFFICIENT } from "./reasonCodes.js";

// §26 Recovery priority
export const RECOVERY_PRIORITY_LEVELS = [
  "EMERGENCY_FUEL",
  "DAMAGED_AIRCRAFT",
  "HAZARDOUS_ORDNANCE",
  "IMMEDIATE_CAP_RELAUNCH",
  "RETURNING_STRIKE",
  "SEARCH",
  "NORMAL_CAP",
] as const;

export type RecoveryPriorityLevel = (typeof RECOVERY_PRIORITY_LEVELS)[number];

export const RECOVERY_PRIORITY_NUMBERS: Record<RecoveryPriorityLevel, number> = {
  EMERGENCY_FUEL: 1,
  DAMAGED_AIRCRAFT: 2,
  HAZARDOUS_ORDNANCE: 3,
  IMMEDIATE_CAP_RELAUNCH: 4,
  RETURNING_STRIKE: 5,
  SEARCH: 6,
  NORMAL_CAP: 7,
};

export interface RecoveryRequest {
  aircraftId: string;
  priorityLevel: RecoveryPriorityLevel;
  squadronId: string;
  fuelStateBp: number;
  isDamaged: boolean;
  hasHazardousOrdnance: boolean;
}

export function recoveryPriorityComparator(a: RecoveryRequest, b: RecoveryRequest): number {
  const pa = RECOVERY_PRIORITY_NUMBERS[a.priorityLevel];
  const pb = RECOVERY_PRIORITY_NUMBERS[b.priorityLevel];
  if (pa !== pb) return pa - pb;
  if (a.aircraftId !== b.aircraftId) return a.aircraftId < b.aircraftId ? -1 : 1;
  return 0;
}

export function sortByRecoveryPriority(requests: readonly RecoveryRequest[]): RecoveryRequest[] {
  return [...requests].sort(recoveryPriorityComparator);
}

export interface RecoveryReservationCheck {
  deckCapacityAvailable: SafeInt;
  requestedSlots: SafeInt;
  carrierHasAlternateLanding: boolean;
}

export function canReserveForRecovery(check: RecoveryReservationCheck): boolean {
  if (Number(check.deckCapacityAvailable) >= Number(check.requestedSlots)) return true;
  return check.carrierHasAlternateLanding;
}

// §27 Ordnance state
export interface OrdnanceTransaction {
  ordnanceTypeId: string;
  quantity: SafeInt;
  transactionType: "RESERVE" | "CONSUME" | "RETURN_TO_STORAGE" | "JETTISON";
  timestamp: number;
}

export interface OrdnanceInventoryCheck {
  inventoryTypeId: string;
  availableQuantity: SafeInt;
  requestedQuantity: SafeInt;
}

export function hasSufficientOrdnance(check: OrdnanceInventoryCheck): boolean {
  return Number(check.availableQuantity) >= Number(check.requestedQuantity);
}

export function assertSufficientOrdnance(check: OrdnanceInventoryCheck): void {
  if (!hasSufficientOrdnance(check)) {
    throw new BluewaveError(CARRIER_ORDNANCE_INVENTORY_INSUFFICIENT, {
      code: CARRIER_ORDNANCE_INVENTORY_INSUFFICIENT,
      field: "availableQuantity",
      reason: `insufficient ${check.inventoryTypeId}: have ${check.availableQuantity}, need ${check.requestedQuantity}`,
      value: check,
    });
  }
}

export function canReturnOrdnanceToStorage(
  aircraftAboard: boolean,
  jettisonOccurred: boolean,
  weaponSafe: boolean,
  storageCapacityAvailable: boolean,
): boolean {
  if (!aircraftAboard) return false;
  if (jettisonOccurred) return false;
  if (!weaponSafe) return false;
  if (!storageCapacityAvailable) return false;
  return true;
}

// §28 Deck/hangar damage effects
export interface DeckHangarDamageEffects {
  spotValueMultiplierBp: number;
  launchRateMultiplierBp: number;
  recoveryRateMultiplierBp: number;
  hangarDeckMovementAllowed: boolean;
  refuelingPermitted: boolean;
  rearmingPermitted: boolean;
  fireExplosionRiskMultiplierBp: number;
  capacityAccessBp: number;
  repairRequired: boolean;
  jetCompatibilityDegraded: boolean;
}

export interface DeckHangarDamageState {
  flightDeckDamageBp: number;
  catapultDamageCount: number;
  totalCatapultCount: number;
  liftOperationalCount: number;
  totalLiftCount: number;
  hangarDamageBp: number;
  fuelSystemDamageBp: number;
  ordnanceStorageDamageBp: number;
}

export function computeDeckHangarDamageEffects(
  damage: DeckHangarDamageState,
): DeckHangarDamageEffects {
  const flightDeckMult =
    damage.flightDeckDamageBp >= 10_000
      ? 10_000
      : damage.flightDeckDamageBp >= 7_500
        ? 7_500
        : damage.flightDeckDamageBp >= 3_500
          ? 3_500
          : 0;

  const catsOperational = damage.totalCatapultCount - damage.catapultDamageCount;
  const launchRateMult =
    damage.totalCatapultCount > 0
      ? Math.round((catsOperational / damage.totalCatapultCount) * 10_000)
      : 10_000;

  const liftsOperational = damage.liftOperationalCount;
  const liftMovementOk = liftsOperational > 0;
  const trappedAircraft = liftMovementOk ? 0 : damage.totalLiftCount;

  return {
    spotValueMultiplierBp: flightDeckMult,
    launchRateMultiplierBp: launchRateMult,
    recoveryRateMultiplierBp: flightDeckMult,
    hangarDeckMovementAllowed: liftMovementOk,
    refuelingPermitted: damage.fuelSystemDamageBp < 10_000,
    rearmingPermitted: damage.ordnanceStorageDamageBp < 10_000,
    fireExplosionRiskMultiplierBp: damage.hangarDamageBp >= 5_000 ? 12_000 : 10_000,
    capacityAccessBp: trappedAircraft > 0 ? 5_000 : 10_000,
    repairRequired:
      damage.flightDeckDamageBp < 10_000 || damage.liftOperationalCount < damage.totalLiftCount,
    jetCompatibilityDegraded: damage.flightDeckDamageBp < 7_500 || !liftMovementOk,
  };
}
