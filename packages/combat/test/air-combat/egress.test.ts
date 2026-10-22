import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  createStrikeMissionState,
  transitionStrikeState,
  checkStrikeFuel,
  computeEgressPosition,
  createEgressState,
  AIR_COMBAT_STRIKE_FUEL_INSUFFICIENT,
  type StrikeMissionState,
} from "../../src/air-combat/index.js";

function createAttackState(fuelMinutes: number = 10): StrikeMissionState {
  const initial = createStrikeMissionState(
    "mission_01",
    "strike_01",
    ["sqn_001"],
    "target_ship_01",
    [100, 200] as [number, number],
    SafeInt(150),
    SafeInt(fuelMinutes),
  );
  const enRouteToOnTarget = transitionStrikeState(initial, "ON_TARGET", {
    position: [1000, 800],
  });
  const onTargetToAttacking = transitionStrikeState(enRouteToOnTarget, "ATTACKING", {
    position: [1000, 800],
  });
  return onTargetToAttacking;
}

describe("AC-14: Strike egress and fuel check", () => {
  describe("checkStrikeFuel", () => {
    it("strike with sufficient fuel (>= 1 min) → sufficient = true", () => {
      const state = createAttackState(10);
      const result = checkStrikeFuel(state);
      expect(result.sufficient).toBe(true);
      expect(result.reasonCode).toBeNull();
    });

    it("strike with exactly 1 minute fuel → sufficient = true", () => {
      const state = createAttackState(1);
      const result = checkStrikeFuel(state);
      expect(result.sufficient).toBe(true);
      expect(result.reasonCode).toBeNull();
    });

    it("strike with 0 fuel → insufficient → AIR_COMBAT_STRIKE_FUEL_INSUFFICIENT", () => {
      const state = createAttackState(0);
      const result = checkStrikeFuel(state);
      expect(result.sufficient).toBe(false);
      expect(result.reasonCode).toBe(AIR_COMBAT_STRIKE_FUEL_INSUFFICIENT);
    });

    it("strike with less than 1 min (e.g., 0.5 not possible with SafeInt) but 0 works", () => {
      const state = createAttackState(0);
      const result = checkStrikeFuel(state);
      expect(result.sufficient).toBe(false);
    });
  });

  describe("computeEgressPosition", () => {
    it("moves toward start position", () => {
      const state = createAttackState(10);
      const newPos = computeEgressPosition(state);
      expect(newPos[0]).toBe(100);
      expect(newPos[1]).toBe(200);
    });

    it("does not overshoot start position", () => {
      const state = createAttackState(10);
      const newPos = computeEgressPosition(state);
      expect(newPos[0]).toBeLessThanOrEqual(state.startPosition[0]);
      expect(newPos[0]).toBe(100);
      expect(newPos[1]).toBe(200);
    });

    it("moves toward start by correct amount when not reaching", () => {
      const initial = createStrikeMissionState(
        "mission_02",
        "strike_02",
        ["sqn_002"],
        "target_ship_02",
        [0, 0] as [number, number],
        SafeInt(10),
        SafeInt(30),
      );
      const enRoute = transitionStrikeState(initial, "ON_TARGET", {
        position: [10_000, 0],
      });
      const attacking = transitionStrikeState(enRoute, "ATTACKING", {
        position: [10_000, 0],
      });

      const newPos = computeEgressPosition(attacking);
      expect(newPos[0]).toBeCloseTo(9_400, 0);
      expect(newPos[1]).toBeCloseTo(0, 0);
    });

    it("returns same position if already at start", () => {
      const initial = createStrikeMissionState(
        "mission_03",
        "strike_03",
        ["sqn_003"],
        "target_ship_03",
        [500, 500] as [number, number],
        SafeInt(150),
        SafeInt(30),
      );
      const onTarget = transitionStrikeState(initial, "ON_TARGET", {
        position: [500, 500],
      });
      const attacking = transitionStrikeState(onTarget, "ATTACKING", {
        position: [500, 500],
      });

      const newPos = computeEgressPosition(attacking);
      expect(newPos[0]).toBe(500);
      expect(newPos[1]).toBe(500);
    });
  });

  describe("createEgressState", () => {
    it("transitions state to EGRESSING phase", () => {
      const state = createAttackState(10);
      const egressState = createEgressState(state);
      expect(egressState.phase).toBe("EGRESSING");
    });

    it("decrements fuelRemainingMinutes by 1", () => {
      const state = createAttackState(10);
      expect(Number(state.fuelRemainingMinutes)).toBe(10);
      const egressState = createEgressState(state);
      expect(Number(egressState.fuelRemainingMinutes)).toBe(9);
    });

    it("updates position toward start", () => {
      const state = createAttackState(10);
      const egressState = createEgressState(state);
      const origDist = Math.sqrt(
        (state.position[0] - state.startPosition[0]) ** 2 +
          (state.position[1] - state.startPosition[1]) ** 2,
      );
      const newDist = Math.sqrt(
        (egressState.position[0] - egressState.startPosition[0]) ** 2 +
          (egressState.position[1] - egressState.startPosition[1]) ** 2,
      );
      expect(newDist).toBeLessThanOrEqual(origDist);
    });

    it("throws if transition is invalid (e.g., from EN_ROUTE)", () => {
      const initial = createStrikeMissionState(
        "mission_04",
        "strike_04",
        ["sqn_004"],
        "target_ship_04",
        [100, 200] as [number, number],
        SafeInt(150),
        SafeInt(30),
      );
      expect(() => createEgressState(initial)).toThrow();
    });

    it("produces a valid state hash", () => {
      const state = createAttackState(10);
      const egressState = createEgressState(state);
      expect(egressState.stateHash).not.toBe("");
      expect(egressState.stateHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("does not mutate the original state", () => {
      const state = createAttackState(10);
      const originalPhase = state.phase;
      const originalFuel = state.fuelRemainingMinutes;
      const originalHash = state.stateHash;

      const egressState = createEgressState(state);

      expect(state.phase).toBe(originalPhase);
      expect(state.fuelRemainingMinutes).toBe(originalFuel);
      expect(state.stateHash).toBe(originalHash);
      expect(egressState.phase).toBe("EGRESSING");
    });
  });
});
