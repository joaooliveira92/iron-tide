//packages/combat/test/air-combat/strike-state-machine.test.ts
// AC-8 (INC-3): Strike mission state machine with valid transitions.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  createStrikeMissionState,
  transitionStrikeState,
  validateStrikeTransition,
  computeStrikeStateHash,
  STRIKE_MISSION_TRANSITIONS,
  AIR_COMBAT_INVALID_STRIKE_TRANSITION,
  type StrikeMissionState,
  type StrikeMissionPhase,
} from "../../src/air-combat/index.js";

function validState(): StrikeMissionState {
  return createStrikeMissionState(
    "mission_01",
    "strike_01",
    ["sqn_001", "sqn_002"],
    "target_ship_01",
    [100, 200] as [number, number],
    SafeInt(150),
    SafeInt(30),
  );
}

describe("AC-8: Strike mission state machine", () => {
  describe("createStrikeMissionState", () => {
    it("creates valid initial state with correct defaults", () => {
      const state = validState();

      expect(state.missionId).toBe("mission_01");
      expect(state.strikeId).toBe("strike_01");
      expect(state.squadronIds).toEqual(["sqn_001", "sqn_002"]);
      expect(state.targetId).toBe("target_ship_01");
      expect(state.position).toEqual([100, 200]);
      expect(state.startPosition).toEqual([100, 200]);
      expect(Number(state.speedMps)).toBe(150);
      expect(state.altitude).toBe("MEDIUM");
      expect(Number(state.fuelRemainingMinutes)).toBe(30);
      expect(Number(state.disruptionBp)).toBe(10000);
      expect(Number(state.attackCount)).toBe(0);
      expect(state.isFirstPass).toBe(true);
      expect(state.stateHash).not.toBe("");
    });
  });

  describe("STRIKE_MISSION_TRANSITIONS", () => {
    it("defines valid transitions per the state machine spec", () => {
      expect(STRIKE_MISSION_TRANSITIONS.EN_ROUTE).toEqual(["ON_TARGET"]);
      expect(STRIKE_MISSION_TRANSITIONS.ON_TARGET).toEqual(["ATTACKING"]);
      expect(STRIKE_MISSION_TRANSITIONS.ATTACKING).toEqual(["EGRESSING", "ON_TARGET"]);
      expect(STRIKE_MISSION_TRANSITIONS.EGRESSING).toEqual(["RETURNING"]);
      expect(STRIKE_MISSION_TRANSITIONS.RETURNING).toEqual([]);
    });
  });

  describe("validateStrikeTransition", () => {
    it("accepts EN_ROUTE → ON_TARGET", () => {
      expect(() => validateStrikeTransition("EN_ROUTE", "ON_TARGET")).not.toThrow();
    });

    it("accepts ON_TARGET → ATTACKING", () => {
      expect(() => validateStrikeTransition("ON_TARGET", "ATTACKING")).not.toThrow();
    });

    it("accepts ATTACKING → EGRESSING", () => {
      expect(() => validateStrikeTransition("ATTACKING", "EGRESSING")).not.toThrow();
    });

    it("accepts ATTACKING → ON_TARGET (multi-attack)", () => {
      expect(() => validateStrikeTransition("ATTACKING", "ON_TARGET")).not.toThrow();
    });

    it("accepts EGRESSING → RETURNING", () => {
      expect(() => validateStrikeTransition("EGRESSING", "RETURNING")).not.toThrow();
    });

    it("throws for invalid transition: EN_ROUTE → EGRESSING", () => {
      expect(() => validateStrikeTransition("EN_ROUTE", "EGRESSING", "mission_01")).toThrow(
        AIR_COMBAT_INVALID_STRIKE_TRANSITION,
      );
    });

    it("throws for invalid transition: ON_TARGET → RETURNING", () => {
      expect(() => validateStrikeTransition("ON_TARGET", "RETURNING", "mission_01")).toThrow(
        AIR_COMBAT_INVALID_STRIKE_TRANSITION,
      );
    });

    it("throws for invalid transition: ATTACKING → EN_ROUTE", () => {
      expect(() => validateStrikeTransition("ATTACKING", "EN_ROUTE", "mission_01")).toThrow(
        AIR_COMBAT_INVALID_STRIKE_TRANSITION,
      );
    });

    it("throws for invalid transition: RETURNING → anything (terminal)", () => {
      expect(() => validateStrikeTransition("RETURNING", "EN_ROUTE", "mission_01")).toThrow(
        AIR_COMBAT_INVALID_STRIKE_TRANSITION,
      );

      expect(() => validateStrikeTransition("RETURNING", "ON_TARGET", "mission_01")).toThrow(
        AIR_COMBAT_INVALID_STRIKE_TRANSITION,
      );

      expect(() => validateStrikeTransition("RETURNING", "ATTACKING", "mission_01")).toThrow(
        AIR_COMBAT_INVALID_STRIKE_TRANSITION,
      );

      expect(() => validateStrikeTransition("RETURNING", "EGRESSING", "mission_01")).toThrow(
        AIR_COMBAT_INVALID_STRIKE_TRANSITION,
      );
    });

    it("throws for null/undefined current phase", () => {
      expect(() =>
        validateStrikeTransition(null as unknown as StrikeMissionPhase, "ON_TARGET"),
      ).toThrow(AIR_COMBAT_INVALID_STRIKE_TRANSITION);

      expect(() =>
        validateStrikeTransition(undefined as unknown as StrikeMissionPhase, "ON_TARGET"),
      ).toThrow(AIR_COMBAT_INVALID_STRIKE_TRANSITION);
    });

    it("throws for null/undefined next phase", () => {
      expect(() =>
        validateStrikeTransition("EN_ROUTE", null as unknown as StrikeMissionPhase),
      ).toThrow(AIR_COMBAT_INVALID_STRIKE_TRANSITION);

      expect(() =>
        validateStrikeTransition("EN_ROUTE", undefined as unknown as StrikeMissionPhase),
      ).toThrow(AIR_COMBAT_INVALID_STRIKE_TRANSITION);
    });
  });

  describe("transitionStrikeState", () => {
    it("follows happy path: EN_ROUTE → ON_TARGET → ATTACKING → EGRESSING → RETURNING", () => {
      const initial = validState();
      expect(initial.phase).toBe("EN_ROUTE");

      const enRouteToTarget = transitionStrikeState(initial, "ON_TARGET");
      expect(enRouteToTarget.phase).toBe("ON_TARGET");

      const onTargetToAttacking = transitionStrikeState(enRouteToTarget, "ATTACKING");
      expect(onTargetToAttacking.phase).toBe("ATTACKING");
      expect(onTargetToAttacking.isFirstPass).toBe(true);

      const attackingToEgress = transitionStrikeState(onTargetToAttacking, "EGRESSING");
      expect(attackingToEgress.phase).toBe("EGRESSING");

      const egressToReturn = transitionStrikeState(attackingToEgress, "RETURNING");
      expect(egressToReturn.phase).toBe("RETURNING");
    });

    it("supports multi-attack: ATTACKING → ON_TARGET → ATTACKING", () => {
      const initial = validState();
      const onTarget = transitionStrikeState(initial, "ON_TARGET");
      const firstAttack = transitionStrikeState(onTarget, "ATTACKING");

      // Re-attack: go back to ON_TARGET
      const reTarget = transitionStrikeState(firstAttack, "ON_TARGET");
      expect(reTarget.phase).toBe("ON_TARGET");
      expect(Number(reTarget.attackCount)).toBe(1);
      expect(reTarget.isFirstPass).toBe(false);

      // Second attack pass
      const secondAttack = transitionStrikeState(reTarget, "ATTACKING");
      expect(secondAttack.phase).toBe("ATTACKING");
      expect(Number(secondAttack.attackCount)).toBe(1);
      expect(secondAttack.isFirstPass).toBe(false);

      // Go to egress
      const egress = transitionStrikeState(secondAttack, "EGRESSING");
      expect(egress.phase).toBe("EGRESSING");
    });

    it("increments attackCount when transitioning ATTACKING → ON_TARGET", () => {
      const initial = validState();
      const onTarget = transitionStrikeState(initial, "ON_TARGET");
      const attack = transitionStrikeState(onTarget, "ATTACKING");
      expect(Number(attack.attackCount)).toBe(0);

      const reTarget = transitionStrikeState(attack, "ON_TARGET");
      expect(Number(reTarget.attackCount)).toBe(1);

      const reAttack = transitionStrikeState(reTarget, "ATTACKING");
      const reTarget2 = transitionStrikeState(reAttack, "ON_TARGET");
      expect(Number(reTarget2.attackCount)).toBe(2);
    });

    it("updates position when provided in params", () => {
      const initial = validState();
      const enRouteToTarget = transitionStrikeState(initial, "ON_TARGET", {
        position: [500, 600],
      });
      expect(enRouteToTarget.position).toEqual([500, 600]);
    });

    it("updates disruptionBp when provided in params", () => {
      const initial = validState();
      const onTarget = transitionStrikeState(initial, "ON_TARGET", {
        disruptionBp: SafeInt(7500),
      });
      expect(Number(onTarget.disruptionBp)).toBe(7500);
    });

    it("does NOT mutate the input state", () => {
      const initial = validState();
      const originalPhase = initial.phase;
      const originalHash = initial.stateHash;

      const nextState = transitionStrikeState(initial, "ON_TARGET");

      expect(initial.phase).toBe(originalPhase);
      expect(initial.stateHash).toBe(originalHash);
      expect(nextState.phase).toBe("ON_TARGET");
      expect(nextState.stateHash).not.toBe(originalHash);
    });

    it("updates stateHash after transition", () => {
      const initial = validState();
      const hash1 = initial.stateHash;

      const nextState = transitionStrikeState(initial, "ON_TARGET");
      const hash2 = nextState.stateHash;

      expect(hash1).not.toBe("");
      expect(hash2).not.toBe("");
      expect(hash2).not.toBe(hash1);
    });

    it("throws on invalid transition", () => {
      const initial = validState();
      expect(() => transitionStrikeState(initial, "EGRESSING")).toThrow(
        AIR_COMBAT_INVALID_STRIKE_TRANSITION,
      );
    });
  });

  describe("computeStrikeStateHash", () => {
    it("returns a non-empty deterministic hash", () => {
      const state = validState();
      const hash = computeStrikeStateHash(state);
      expect(hash).not.toBe("");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns the same hash for identical states", () => {
      const state1 = validState();
      const state2 = validState();

      const hash1 = computeStrikeStateHash(state1);
      const hash2 = computeStrikeStateHash(state2);

      expect(hash1).toBe(hash2);
    });

    it("returns different hashes for different states", () => {
      const state1 = createStrikeMissionState(
        "mission_01",
        "strike_01",
        ["sqn_001"],
        "target_ship_01",
        [100, 200] as [number, number],
        SafeInt(150),
        SafeInt(30),
      );
      const state2 = createStrikeMissionState(
        "mission_02",
        "strike_02",
        ["sqn_003"],
        "target_ship_02",
        [300, 400] as [number, number],
        SafeInt(180),
        SafeInt(45),
      );

      const hash1 = computeStrikeStateHash(state1);
      const hash2 = computeStrikeStateHash(state2);

      expect(hash1).not.toBe(hash2);
    });
  });
});
