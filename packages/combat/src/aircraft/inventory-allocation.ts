import { SafeInt } from "@bluewave/contracts";
import { compareStrings } from "../core/ordering.js";

export const ALLOCATION_PRIORITIES = [
  "ACTIVE_BATTLE_OR_MANDATORY_DEFENSE",
  "CARRIER_AIR_GROUP_ACTIVE",
  "STRATEGIC_PATROL_AND_ASW",
  "COMBAT_LOSS_REPLACEMENT",
  "SQUADRON_REEQUIPMENT",
  "SQUADRON_EXPANSION",
  "TRAINING_AND_RESERVE",
] as const;

export type AllocationPriority = (typeof ALLOCATION_PRIORITIES)[number];

export interface AllocationDemand {
  demandId: string;
  squadronId: string;
  modelId: string;
  quantity: SafeInt;
  priority: AllocationPriority;
}

export interface AllocationResultV1 {
  allocated: ReadonlyMap<string, SafeInt>;
  remaining: AllocationDemand[];
}

export function allocateInventory(
  demands: readonly AllocationDemand[],
  availableInventory: ReadonlyMap<string, SafeInt>,
): AllocationResultV1 {
  const allocated = new Map<string, SafeInt>();
  const remaining: AllocationDemand[] = [];
  const available = new Map(availableInventory);

  const priorityOrder = ALLOCATION_PRIORITIES;
  const priorityIndex = (p: AllocationPriority): number => priorityOrder.indexOf(p);

  const sorted = [...demands].sort((a, b) => {
    const piA = priorityIndex(a.priority);
    const piB = priorityIndex(b.priority);
    if (piA !== piB) return piA - piB;
    return compareStrings(a.squadronId, b.squadronId) || compareStrings(a.demandId, b.demandId);
  });

  for (const demand of sorted) {
    const key = `${demand.modelId}:${demand.squadronId}`;
    const stock = available.get(demand.modelId) ?? SafeInt.ZERO;
    const stockNum = Number(stock);
    const demandNum = Number(demand.quantity);
    const grantedNum = stockNum < demandNum ? stockNum : demandNum;
    const granted = SafeInt(grantedNum) as SafeInt;
    if (granted > SafeInt.ZERO) {
      allocated.set(key, SafeInt.add(allocated.get(key) ?? SafeInt.ZERO, granted));
      available.set(demand.modelId, SafeInt.sub(stock, granted));
    }
    if (granted < demand.quantity) {
      remaining.push({
        ...demand,
        quantity: SafeInt.sub(demand.quantity, granted),
      });
    }
  }

  return { allocated, remaining };
}
