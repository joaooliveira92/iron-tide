import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  BATTLE_MISSION_TYPES,
  MISSION_PRIORITIES,
  MISSION_REGISTRY,
  getMission,
  assertPrioritiesUnique,
  FLEET_BATTLE_MIN_STRENGTH,
  CRUISER_BATTLE_MIN_STRENGTH,
  REACHABLE_MISSION_SUBSET_V1,
} from "../../src/generation/mission.js";
import { BATTLE_MISSION_TYPE_UNREGISTERED } from "../../src/generation/reasonCodes.js";

describe("mission registry (AC-4)", () => {
  it("contains exactly the 9 canonical mission types", () => {
    expect(BATTLE_MISSION_TYPES).toHaveLength(9);
    expect([...BATTLE_MISSION_TYPES]).toEqual([
      "FLEET_BATTLE",
      "CRUISER_BATTLE",
      "COASTAL_RAID",
      "CONVOY_ATTACK",
      "CONVOY_DEFENSE",
      "INVASION",
      "RAIDER_INTERCEPTION",
      "BLOCKADE_BREAKOUT",
      "CARRIER_ACTION",
    ]);
  });

  it("priorities are exact and unique", () => {
    expect(() => assertPrioritiesUnique()).not.toThrow();
    expect(MISSION_PRIORITIES.INVASION).toBe(1);
    expect(MISSION_PRIORITIES.BLOCKADE_BREAKOUT).toBe(2);
    expect(MISSION_PRIORITIES.CONVOY_DEFENSE).toBe(3);
    expect(MISSION_PRIORITIES.CONVOY_ATTACK).toBe(4);
    expect(MISSION_PRIORITIES.RAIDER_INTERCEPTION).toBe(5);
    expect(MISSION_PRIORITIES.COASTAL_RAID).toBe(6);
    expect(MISSION_PRIORITIES.CARRIER_ACTION).toBe(7);
    expect(MISSION_PRIORITIES.FLEET_BATTLE).toBe(8);
    expect(MISSION_PRIORITIES.CRUISER_BATTLE).toBe(9);
  });

  it("unregistered type -> BATTLE_MISSION_TYPE_UNREGISTERED", () => {
    expect(() => getMission("SPACE_BATTLE")).toThrow(new RegExp(BATTLE_MISSION_TYPE_UNREGISTERED));
    expect(() => getMission("SPACE_BATTLE")).toThrow(BluewaveError);
  });

  it("every registered type has complete definitions", () => {
    for (const t of BATTLE_MISSION_TYPES) {
      const def = MISSION_REGISTRY[t];
      expect(def).toBeTruthy();
      expect(def.priority).toBe(MISSION_PRIORITIES[t]);
      expect(def.opportunityPredicateId).toBeTruthy();
      expect(def.forceRequirementPolicyId).toBeTruthy();
      expect(def.assetEligibilityPolicyId).toBeTruthy();
      expect(def.repairPolicyId).toBeTruthy();
      expect(def.acceptanceClass).toBeTruthy();
      expect(def.autoResolutionPolicyId).toBeTruthy();
    }
  });

  it("reachable subset is exactly FLEET_BATTLE + CRUISER_BATTLE (ADR B-1-3)", () => {
    expect([...REACHABLE_MISSION_SUBSET_V1].sort()).toEqual(["CRUISER_BATTLE", "FLEET_BATTLE"]);
  });

  it("deferred mission types have registered definitions but are unreachable (AC-14)", () => {
    const reachable = REACHABLE_MISSION_SUBSET_V1;
    const all = new Set(BATTLE_MISSION_TYPES);
    const deferred = [...all].filter((t) => !reachable.has(t));
    expect(deferred.sort()).toEqual([
      "BLOCKADE_BREAKOUT",
      "CARRIER_ACTION",
      "COASTAL_RAID",
      "CONVOY_ATTACK",
      "CONVOY_DEFENSE",
      "INVASION",
      "RAIDER_INTERCEPTION",
    ]);
    for (const t of deferred) {
      expect(MISSION_REGISTRY[t]).toBeDefined();
      expect(MISSION_REGISTRY[t]!.opportunityPredicateId).toMatch(/_unreachable_v1$/);
    }
  });

  it("strength floors are 300 / 150", () => {
    expect(FLEET_BATTLE_MIN_STRENGTH).toBe(300);
    expect(CRUISER_BATTLE_MIN_STRENGTH).toBe(150);
  });
});
