import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  allocateInventory,
  type AllocationDemand,
  type AllocationPriority,
} from "../../src/aircraft/inventory-allocation.js";

function demand(
  demandId: string,
  squadronId: string,
  modelId: string,
  quantity: number,
  priority: AllocationPriority,
): AllocationDemand {
  return { demandId, squadronId, modelId, quantity: SafeInt(quantity), priority };
}

describe("AC-22: inventory allocation priority", () => {
  it("allocates by priority order: battle > carrier > patrol > replacement > reequip > expansion > training", () => {
    const demands: AllocationDemand[] = [
      demand("d1", "sq_expansion", "model_a", 10, "SQUADRON_EXPANSION"),
      demand("d2", "sq_battle", "model_a", 10, "ACTIVE_BATTLE_OR_MANDATORY_DEFENSE"),
      demand("d3", "sq_training", "model_a", 10, "TRAINING_AND_RESERVE"),
    ];
    const available = new Map<string, SafeInt>([["model_a", SafeInt(15)]]);
    const result = allocateInventory(demands, available);
    expect(Number(result.allocated.get("model_a:sq_battle") ?? SafeInt.ZERO)).toBe(10);
    expect(Number(result.allocated.get("model_a:sq_expansion") ?? SafeInt.ZERO)).toBe(5);
    expect(result.allocated.has("model_a:sq_training")).toBe(false);
  });

  it("orders equal-priority demands by squadronId then demandId", () => {
    const demands: AllocationDemand[] = [
      demand("d_z", "sq_b", "model_a", 5, "SQUADRON_REEQUIPMENT"),
      demand("d_a", "sq_a", "model_a", 5, "SQUADRON_REEQUIPMENT"),
    ];
    const available = new Map<string, SafeInt>([["model_a", SafeInt(3)]]);
    const result = allocateInventory(demands, available);
    expect(Number(result.allocated.get("model_a:sq_a") ?? SafeInt.ZERO)).toBe(3);
    expect(result.allocated.has("model_a:sq_b")).toBe(false);
  });

  it("does not double-allocate aircraft", () => {
    const demands: AllocationDemand[] = [
      demand("d1", "sq_1", "model_a", 10, "ACTIVE_BATTLE_OR_MANDATORY_DEFENSE"),
      demand("d2", "sq_2", "model_a", 10, "CARRIER_AIR_GROUP_ACTIVE"),
    ];
    const available = new Map<string, SafeInt>([["model_a", SafeInt(8)]]);
    const result = allocateInventory(demands, available);
    expect(
      Number(result.allocated.get("model_a:sq_1") ?? SafeInt.ZERO) +
        Number(result.allocated.get("model_a:sq_2") ?? SafeInt.ZERO),
    ).toBe(8);
  });

  it("records remaining demands when allocation is partial", () => {
    const demands: AllocationDemand[] = [
      demand("d1", "sq_1", "model_a", 10, "ACTIVE_BATTLE_OR_MANDATORY_DEFENSE"),
    ];
    const available = new Map<string, SafeInt>([["model_a", SafeInt(4)]]);
    const result = allocateInventory(demands, available);
    expect(Number(result.allocated.get("model_a:sq_1") ?? SafeInt.ZERO)).toBe(4);
    expect(result.remaining.length).toBe(1);
    expect(Number(result.remaining[0].quantity)).toBe(6);
  });

  it("consumes no randomness (deterministic output)", () => {
    const demands: AllocationDemand[] = [
      demand("d1", "sq_1", "model_a", 5, "STRATEGIC_PATROL_AND_ASW"),
      demand("d2", "sq_2", "model_a", 5, "SQUADRON_REEQUIPMENT"),
    ];
    const available = new Map<string, SafeInt>([["model_a", SafeInt(10)]]);
    const r1 = allocateInventory(demands, available);
    const r2 = allocateInventory(demands, available);
    expect([...r1.allocated.entries()]).toEqual([...r2.allocated.entries()]);
  });
});
