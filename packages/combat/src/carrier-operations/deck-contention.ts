import { BluewaveError } from "@bluewave/contracts";
import { CARRIER_DECK_CONTENTION } from "./reasonCodes.js";

export const OPERATION_CLASSES = [
  "EMERGENCY_RECOVERY",
  "ORDINARY_RECOVERY",
  "ALERT_CAP_LAUNCH",
  "ACTIVE_STRIKE_LAUNCH",
  "SEARCH_LAUNCH",
  "ORDINARY_CAP_LAUNCH",
  "SPOTTING",
  "REFUELING_REARMING",
  "STRIKE_DOWN",
] as const;

export type OperationClass = (typeof OPERATION_CLASSES)[number];

export const OPERATION_PRIORITY: Record<OperationClass, number> = {
  EMERGENCY_RECOVERY: 1,
  ORDINARY_RECOVERY: 2,
  ALERT_CAP_LAUNCH: 3,
  ACTIVE_STRIKE_LAUNCH: 4,
  SEARCH_LAUNCH: 5,
  ORDINARY_CAP_LAUNCH: 6,
  SPOTTING: 7,
  REFUELING_REARMING: 8,
  STRIKE_DOWN: 9,
};

export interface ContentionPredicates {
  hasAngledDeck: boolean;
  deckDamagePermitsOverlap: boolean;
  weatherPermitsOverlap: boolean;
  trafficPermitsOverlap: boolean;
  hasFueledArmedAircraftOnDeck: boolean;
  clearDeckCapacitySufficient: boolean;
}

export function operationClassPriority(op: OperationClass): number {
  return OPERATION_PRIORITY[op];
}

export function priorityComparator(a: OperationClass, b: OperationClass): number {
  return OPERATION_PRIORITY[a] - OPERATION_PRIORITY[b];
}

export function isLaunchOrSpottingOperation(op: OperationClass): boolean {
  return (
    op === "ALERT_CAP_LAUNCH" ||
    op === "ACTIVE_STRIKE_LAUNCH" ||
    op === "SEARCH_LAUNCH" ||
    op === "ORDINARY_CAP_LAUNCH" ||
    op === "SPOTTING"
  );
}

export function isRecoveryOperation(op: OperationClass): boolean {
  return op === "EMERGENCY_RECOVERY" || op === "ORDINARY_RECOVERY";
}

export function mayOverlapOnAngledDeck(
  a: OperationClass,
  b: OperationClass,
  predicates: ContentionPredicates,
): boolean {
  if (!predicates.hasAngledDeck) return false;
  if (!predicates.deckDamagePermitsOverlap) return false;
  if (!predicates.weatherPermitsOverlap) return false;
  if (!predicates.trafficPermitsOverlap) return false;

  const aLaunchSpot = isLaunchOrSpottingOperation(a);
  const bLaunchSpot = isLaunchOrSpottingOperation(b);
  const aRecovery = isRecoveryOperation(a);
  const bRecovery = isRecoveryOperation(b);

  return (aLaunchSpot && bRecovery) || (aRecovery && bLaunchSpot);
}

export function canEmergencyRecoveryPreempt(currentOperation: OperationClass): boolean {
  if (currentOperation === "EMERGENCY_RECOVERY") return false;
  if (currentOperation === "ORDINARY_RECOVERY") return false;
  return true;
}

export function assertContentionPermitted(
  requested: OperationClass,
  currentOperations: readonly OperationClass[],
  predicates: ContentionPredicates,
): void {
  if (requested === "EMERGENCY_RECOVERY") {
    const preemptible = currentOperations.filter(
      (op) => op !== "EMERGENCY_RECOVERY" && op !== "ORDINARY_RECOVERY",
    );
    if (preemptible.length === 0 && currentOperations.length > 0) {
      throw new BluewaveError(CARRIER_DECK_CONTENTION, {
        code: CARRIER_DECK_CONTENTION,
        field: "currentOperations",
        reason: "emergency recovery cannot preempt existing recovery operations",
        value: { requested, currentOperations },
      });
    }
    return;
  }

  if (predicates.hasFueledArmedAircraftOnDeck && !predicates.clearDeckCapacitySufficient) {
    if (isRecoveryOperation(requested)) {
      throw new BluewaveError(CARRIER_DECK_CONTENTION, {
        code: CARRIER_DECK_CONTENTION,
        field: "clearDeckCapacitySufficient",
        reason: "fueled and armed aircraft on deck prevent recovery",
        value: { requested, currentOperations },
      });
    }
  }

  for (const current of currentOperations) {
    if (requested === current) continue;

    if (predicates.hasAngledDeck && mayOverlapOnAngledDeck(requested, current, predicates)) {
      continue;
    }

    if (!predicates.hasAngledDeck) {
      throw new BluewaveError(CARRIER_DECK_CONTENTION, {
        code: CARRIER_DECK_CONTENTION,
        field: "currentOperations",
        reason: `straight deck: operation ${requested} conflicts with ${current}`,
        value: { requested, currentOperations },
      });
    }

    const requestedLaunchSpot = isLaunchOrSpottingOperation(requested);
    const currentLaunchSpot = isLaunchOrSpottingOperation(current);
    const requestedRecovery = isRecoveryOperation(requested);
    const currentRecovery = isRecoveryOperation(current);

    if (requestedLaunchSpot && currentLaunchSpot) {
      throw new BluewaveError(CARRIER_DECK_CONTENTION, {
        code: CARRIER_DECK_CONTENTION,
        field: "currentOperations",
        reason: `angled deck: two launch/spotting operations cannot overlap: ${requested} conflicts with ${current}`,
        value: { requested, currentOperations },
      });
    }

    if (requestedRecovery && currentRecovery) {
      throw new BluewaveError(CARRIER_DECK_CONTENTION, {
        code: CARRIER_DECK_CONTENTION,
        field: "currentOperations",
        reason: `two recovery operations cannot overlap: ${requested} conflicts with ${current}`,
        value: { requested, currentOperations },
      });
    }

    if (
      (requestedLaunchSpot || requestedRecovery) &&
      !isLaunchOrSpottingOperation(current) &&
      !isRecoveryOperation(current)
    ) {
      throw new BluewaveError(CARRIER_DECK_CONTENTION, {
        code: CARRIER_DECK_CONTENTION,
        field: "currentOperations",
        reason: `operation ${requested} cannot overlap with ${current}`,
        value: { requested, currentOperations },
      });
    }
  }
}
