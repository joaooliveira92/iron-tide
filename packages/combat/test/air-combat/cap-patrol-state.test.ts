// AC-1 (INC-1): CAP patrol state creation.
// Tests createCapPatrolState validation and default values.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { createCapPatrolState, type CapPatrolState } from "../../src/air-combat/index.js";
import { AIR_COMBAT_INVALID_STATE } from "../../src/air-combat/index.js";

function validParams() {
  return {
    squadronId: "squadron_cap_01",
    missionAvailability: ["CAP", "ESCORT"],
    operationalAircraftCount: SafeInt(12),
    rangeDistance: SafeInt(800),
    speedScore: SafeInt(72),
    stationPosition: [100, 200] as [number, number],
  };
}

describe("AC-1: CAP patrol state creation", () => {
  it("creates a valid CapPatrolState with correct defaults", () => {
    const p = validParams();
    const state = createCapPatrolState(
      p.squadronId,
      p.missionAvailability,
      p.operationalAircraftCount,
      p.rangeDistance,
      p.speedScore,
      p.stationPosition,
    );

    expect(state.squadronId).toBe("squadron_cap_01");
    expect(state.stationPosition).toEqual([100, 200]);
    expect(state.altitude).toBe("MEDIUM");
    expect(state.engagementState).toBe("PATROLLING");
    expect(state.interceptTargetId).toBeNull();
    expect(state.interceptEtaMinutes).toBe(SafeInt.ZERO);
    expect(state.rulesetVersion).toBe("1");
  });

  it("computes fuelRemainingMinutes as rangeDistance / max(1, speedScore)", () => {
    // rangeDistance=800, speedScore=72 → floor(800/72) = 11
    const p = validParams();
    const state = createCapPatrolState(
      p.squadronId,
      p.missionAvailability,
      p.operationalAircraftCount,
      SafeInt(800),
      SafeInt(72),
      p.stationPosition,
    );
    expect(Number(state.fuelRemainingMinutes)).toBe(11);
  });

  it("handles speedScore of 0 for fuel heuristic (uses max(1, 0) = 1)", () => {
    const p = validParams();
    const state = createCapPatrolState(
      p.squadronId,
      p.missionAvailability,
      p.operationalAircraftCount,
      SafeInt(500),
      SafeInt(0),
      p.stationPosition,
    );
    // floor(500/1) = 500
    expect(Number(state.fuelRemainingMinutes)).toBe(500);
  });

  it("throws AIR_COMBAT_INVALID_STATE when squadron lacks 'CAP' in missionAvailability", () => {
    const p = validParams();
    expect(() =>
      createCapPatrolState(
        p.squadronId,
        ["ESCORT", "INTERCEPTION"],
        p.operationalAircraftCount,
        p.rangeDistance,
        p.speedScore,
        p.stationPosition,
      ),
    ).toThrow(AIR_COMBAT_INVALID_STATE);
  });

  it("throws AIR_COMBAT_INVALID_STATE when missionAvailability is empty", () => {
    const p = validParams();
    expect(() =>
      createCapPatrolState(
        p.squadronId,
        [],
        p.operationalAircraftCount,
        p.rangeDistance,
        p.speedScore,
        p.stationPosition,
      ),
    ).toThrow(AIR_COMBAT_INVALID_STATE);
  });

  it("throws AIR_COMBAT_INVALID_STATE when operationalAircraftCount is zero", () => {
    const p = validParams();
    expect(() =>
      createCapPatrolState(
        p.squadronId,
        p.missionAvailability,
        SafeInt.ZERO,
        p.rangeDistance,
        p.speedScore,
        p.stationPosition,
      ),
    ).toThrow(AIR_COMBAT_INVALID_STATE);
  });

  it("throws AIR_COMBAT_INVALID_STATE when operationalAircraftCount is negative", () => {
    const p = validParams();
    expect(() =>
      createCapPatrolState(
        p.squadronId,
        p.missionAvailability,
        SafeInt(-1),
        p.rangeDistance,
        p.speedScore,
        p.stationPosition,
      ),
    ).toThrow(AIR_COMBAT_INVALID_STATE);
  });

  it("throws AIR_COMBAT_INVALID_STATE for null squadronId", () => {
    const p = validParams();
    expect(() =>
      createCapPatrolState(
        null as unknown as string,
        p.missionAvailability,
        p.operationalAircraftCount,
        p.rangeDistance,
        p.speedScore,
        p.stationPosition,
      ),
    ).toThrow(AIR_COMBAT_INVALID_STATE);
  });

  it("throws AIR_COMBAT_INVALID_STATE for empty squadronId", () => {
    const p = validParams();
    expect(() =>
      createCapPatrolState(
        "",
        p.missionAvailability,
        p.operationalAircraftCount,
        p.rangeDistance,
        p.speedScore,
        p.stationPosition,
      ),
    ).toThrow(AIR_COMBAT_INVALID_STATE);
  });

  it("throws AIR_COMBAT_INVALID_STATE for undefined missionAvailability", () => {
    const p = validParams();
    expect(() =>
      createCapPatrolState(
        p.squadronId,
        undefined as unknown as string[],
        p.operationalAircraftCount,
        p.rangeDistance,
        p.speedScore,
        p.stationPosition,
      ),
    ).toThrow(AIR_COMBAT_INVALID_STATE);
  });

  it("throws AIR_COMBAT_INVALID_STATE when stationPosition is not a valid tuple", () => {
    const p = validParams();
    expect(() =>
      createCapPatrolState(
        p.squadronId,
        p.missionAvailability,
        p.operationalAircraftCount,
        p.rangeDistance,
        p.speedScore,
        null as unknown as [number, number],
      ),
    ).toThrow(AIR_COMBAT_INVALID_STATE);
  });

  it("produces a CapPatrolState with the correct interface shape", () => {
    const p = validParams();
    const state: CapPatrolState = createCapPatrolState(
      p.squadronId,
      p.missionAvailability,
      p.operationalAircraftCount,
      p.rangeDistance,
      p.speedScore,
      p.stationPosition,
    );

    expect(state).toHaveProperty("squadronId");
    expect(state).toHaveProperty("stationPosition");
    expect(state).toHaveProperty("altitude");
    expect(state).toHaveProperty("fuelRemainingMinutes");
    expect(state).toHaveProperty("engagementState");
    expect(state).toHaveProperty("interceptTargetId");
    expect(state).toHaveProperty("interceptEtaMinutes");
    expect(state).toHaveProperty("rulesetVersion");
  });
});
