// AC-15 (INC-6): Strike recovery and return-to-base.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  createStrikeMissionState,
  transitionStrikeState,
  checkRecoveryAvailability,
  computeReturnToBase,
  AIR_COMBAT_RECOVERY_DECK_UNAVAILABLE,
  type StrikeMissionState,
} from "../../src/air-combat/index.js";

function createReturningState(): StrikeMissionState {
  const initial = createStrikeMissionState(
    "mission_01",
    "strike_01",
    ["sqn_001"],
    "target_ship_01",
    [0, 0] as [number, number],
    SafeInt(150),
    SafeInt(30),
  );
  const onTarget = transitionStrikeState(initial, "ON_TARGET", {
    position: [5000, 3000],
  });
  const attacking = transitionStrikeState(onTarget, "ATTACKING", {
    position: [5000, 3000],
  });
  const egress = transitionStrikeState(attacking, "EGRESSING", {
    position: [3000, 1500],
  });
  const returning = transitionStrikeState(egress, "RETURNING", {
    position: [3000, 1500],
  });
  return returning;
}

describe("AC-15: Strike recovery", () => {
  describe("checkRecoveryAvailability", () => {
    it("normal day recovery → available, lossRiskBp = 500", () => {
      const result = checkRecoveryAvailability("AVAILABLE", "CLEAR", false);
      expect(result.available).toBe(true);
      expect(result.reasonCode).toBeNull();
      expect(Number(result.lossRiskBp)).toBe(500);
    });

    it("night recovery → lossRiskBp = 2000", () => {
      const result = checkRecoveryAvailability("AVAILABLE", "CLEAR", true);
      expect(result.available).toBe(true);
      expect(Number(result.lossRiskBp)).toBe(2000 + 500); // base 500 + night 2000
    });

    it("bad weather recovery → lossRiskBp = 500 + 1500 = 2000", () => {
      const result = checkRecoveryAvailability("AVAILABLE", "STORM", false);
      expect(result.available).toBe(true);
      expect(Number(result.lossRiskBp)).toBe(2000); // base 500 + storm 1500
    });

    it("night + bad weather → lossRiskBp = 500 + 2000 + 1500 = 4000", () => {
      const result = checkRecoveryAvailability("AVAILABLE", "STORM", true);
      expect(result.available).toBe(true);
      expect(Number(result.lossRiskBp)).toBe(4000); // base 500 + night 2000 + storm 1500
    });

    it("night + clear weather → lossRiskBp = 500 + 2000 = 2500", () => {
      const result = checkRecoveryAvailability("AVAILABLE", "CLOUDS", true);
      expect(result.available).toBe(true);
      expect(Number(result.lossRiskBp)).toBe(2500); // base 500 + night 2000 (clouds not storm)
    });

    it("deck unavailable (DAMAGED) → AIR_COMBAT_RECOVERY_DECK_UNAVAILABLE", () => {
      const result = checkRecoveryAvailability("DAMAGED", "CLEAR", false);
      expect(result.available).toBe(false);
      expect(result.reasonCode).toBe(AIR_COMBAT_RECOVERY_DECK_UNAVAILABLE);
      expect(Number(result.lossRiskBp)).toBe(0);
    });

    it("deck unavailable (DECK_PARKED_FULL) → AIR_COMBAT_RECOVERY_DECK_UNAVAILABLE", () => {
      const result = checkRecoveryAvailability("DECK_PARKED_FULL", "CLEAR", false);
      expect(result.available).toBe(false);
      expect(result.reasonCode).toBe(AIR_COMBAT_RECOVERY_DECK_UNAVAILABLE);
    });
  });

  describe("computeReturnToBase", () => {
    it("moves toward base (start position)", () => {
      const state = createReturningState();
      // Position [3000, 1500], start [0, 0], speed 150 mps
      // Distance = sqrt(9_000_000 + 2_250_000) = sqrt(11_250_000) ≈ 3354
      // Distance per minute = 150 * 60 = 9000
      // So we reach base in one minute
      const returned = computeReturnToBase(state);
      expect(returned.position[0]).toBe(0);
      expect(returned.position[1]).toBe(0);
    });

    it("decrements fuel on return movement", () => {
      const state = createReturningState();
      expect(Number(state.fuelRemainingMinutes)).toBe(30);
      const returned = computeReturnToBase(state);
      expect(Number(returned.fuelRemainingMinutes)).toBe(29);
    });

    it("moves correct distance per minute when not reaching base", () => {
      // Slow speed so it takes multiple minutes
      const initial = createStrikeMissionState(
        "mission_02",
        "strike_02",
        ["sqn_002"],
        "target_ship_02",
        [0, 0] as [number, number],
        SafeInt(10), // 10 mps → 600m per minute
        SafeInt(30),
      );
      const onTarget = transitionStrikeState(initial, "ON_TARGET", {
        position: [10_000, 0],
      });
      const attacking = transitionStrikeState(onTarget, "ATTACKING", {
        position: [10_000, 0],
      });
      const egress = transitionStrikeState(attacking, "EGRESSING", {
        position: [10_000, 0],
      });
      const returning = transitionStrikeState(egress, "RETURNING", {
        position: [10_000, 0],
      });

      const result = computeReturnToBase(returning);
      // 600m toward [0, 0]: new x = 10000 - 600 = 9400
      expect(result.position[0]).toBeCloseTo(9_400, 0);
      expect(result.position[1]).toBeCloseTo(0, 0);
    });

    it("clamps position to start when within epsilon (100m)", () => {
      const initial = createStrikeMissionState(
        "mission_03",
        "strike_03",
        ["sqn_003"],
        "target_ship_03",
        [0, 0] as [number, number],
        SafeInt(150),
        SafeInt(30),
      );
      const onTarget = transitionStrikeState(initial, "ON_TARGET", {
        position: [50, 0], // Only 50m from start — within epsilon
      });
      const attacking = transitionStrikeState(onTarget, "ATTACKING", {
        position: [50, 0],
      });
      const egress = transitionStrikeState(attacking, "EGRESSING", {
        position: [50, 0],
      });
      const returning = transitionStrikeState(egress, "RETURNING", {
        position: [50, 0],
      });

      const result = computeReturnToBase(returning);
      expect(result.position[0]).toBe(0);
      expect(result.position[1]).toBe(0);
    });

    it("produces valid state hash", () => {
      const state = createReturningState();
      const result = computeReturnToBase(state);
      expect(result.stateHash).not.toBe("");
      expect(result.stateHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
