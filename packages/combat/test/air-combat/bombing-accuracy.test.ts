//packages/combat/test/air-combat/bombing-accuracy.test.ts
// AC-10 (INC-4): Bombing accuracy formula with disruption, altitude, visibility, target maneuver, payload.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  computeBombingAccuracy,
  AIR_COMBAT_BASIS_POINTS,
  AIR_COMBAT_LEVEL_BOMBING_BASE_ACCURACY_BP,
  AIR_COMBAT_DIVE_BOMBING_BASE_ACCURACY_BP,
  AIR_COMBAT_VISIBILITY_CLEAR_BP,
  AIR_COMBAT_VISIBILITY_FOG_BP,
  AIR_COMBAT_MANEUVER_STATIONARY_BP,
  AIR_COMBAT_MANEUVER_AGILE_BP,
  AIR_COMBAT_BOMBING_PARAMETERS_INVALID,
  type BombingAccuracyParams,
} from "../../src/air-combat/index.js";

describe("AC-10: computeBombingAccuracy", () => {
  it("level bombing at LOW altitude, clear visibility, stationary target, no disruption → ~10_000", () => {
    // All factors at baseline: 10_000 * 10_000 * 10_000 * 10_000 * 10_000 * 10_000 / 10_000^5 = 10_000
    const params: BombingAccuracyParams = {
      baseAccuracyBp: SafeInt(AIR_COMBAT_LEVEL_BOMBING_BASE_ACCURACY_BP),
      payloadCapacity: SafeInt(200), // gives payloadFactorBp = 10_000
      visibilityBp: SafeInt(AIR_COMBAT_VISIBILITY_CLEAR_BP),
      targetManeuverBp: SafeInt(AIR_COMBAT_MANEUVER_STATIONARY_BP),
      disruptionBp: SafeInt(AIR_COMBAT_BASIS_POINTS), // no disruption
      altitude: "LOW",
    };
    const result = computeBombingAccuracy(params);
    expect(Number(result)).toBe(10_000);
  });

  it("level bombing at HIGH altitude → accuracy reduced to 5_000", () => {
    // Altitude HIGH penalty = 5_000, all others at 10_000, payload=200 gives 10_000
    // 10_000 * 5_000 * 10_000 * 10_000 * 10_000 * 10_000 / 10_000^5 = 5_000
    const params: BombingAccuracyParams = {
      baseAccuracyBp: SafeInt(AIR_COMBAT_LEVEL_BOMBING_BASE_ACCURACY_BP),
      payloadCapacity: SafeInt(200),
      visibilityBp: SafeInt(AIR_COMBAT_VISIBILITY_CLEAR_BP),
      targetManeuverBp: SafeInt(AIR_COMBAT_MANEUVER_STATIONARY_BP),
      disruptionBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
      altitude: "HIGH",
    };
    const result = computeBombingAccuracy(params);
    expect(Number(result)).toBe(5_000);
  });

  it("poor visibility (FOG = 5_000) → accuracy reduced to 5_000", () => {
    // 10_000 * 10_000 * 5_000 * 10_000 * 10_000 * 10_000 / 10_000^5 = 5_000
    const params: BombingAccuracyParams = {
      baseAccuracyBp: SafeInt(AIR_COMBAT_LEVEL_BOMBING_BASE_ACCURACY_BP),
      payloadCapacity: SafeInt(200),
      visibilityBp: SafeInt(AIR_COMBAT_VISIBILITY_FOG_BP),
      targetManeuverBp: SafeInt(AIR_COMBAT_MANEUVER_STATIONARY_BP),
      disruptionBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
      altitude: "LOW",
    };
    const result = computeBombingAccuracy(params);
    expect(Number(result)).toBe(5_000);
  });

  it("agile target (3_000) → accuracy reduced to 3_000", () => {
    // 10_000 * 10_000 * 10_000 * 3_000 * 10_000 * 10_000 / 10_000^5 = 3_000
    const params: BombingAccuracyParams = {
      baseAccuracyBp: SafeInt(AIR_COMBAT_LEVEL_BOMBING_BASE_ACCURACY_BP),
      payloadCapacity: SafeInt(200),
      visibilityBp: SafeInt(AIR_COMBAT_VISIBILITY_CLEAR_BP),
      targetManeuverBp: SafeInt(AIR_COMBAT_MANEUVER_AGILE_BP),
      disruptionBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
      altitude: "LOW",
    };
    const result = computeBombingAccuracy(params);
    expect(Number(result)).toBe(3_000);
  });

  it("maximum disruption (5_000) → accuracy reduced to 5_000", () => {
    // 10_000 * 10_000 * 10_000 * 10_000 * 5_000 * 10_000 / 10_000^5 = 5_000
    const params: BombingAccuracyParams = {
      baseAccuracyBp: SafeInt(AIR_COMBAT_LEVEL_BOMBING_BASE_ACCURACY_BP),
      payloadCapacity: SafeInt(200),
      visibilityBp: SafeInt(AIR_COMBAT_VISIBILITY_CLEAR_BP),
      targetManeuverBp: SafeInt(AIR_COMBAT_MANEUVER_STATIONARY_BP),
      disruptionBp: SafeInt(5_000),
      altitude: "LOW",
    };
    const result = computeBombingAccuracy(params);
    expect(Number(result)).toBe(5_000);
  });

  it("dive bombing bonus (22_500 base) → hits max 10_000 (clamped)", () => {
    // 22_500 * 10_000 * 10_000 * 10_000 * 10_000 * 10_000 / 10_000^5 = 22_500
    // clamped to [0, 10_000] → 10_000
    const params: BombingAccuracyParams = {
      baseAccuracyBp: SafeInt(AIR_COMBAT_DIVE_BOMBING_BASE_ACCURACY_BP),
      payloadCapacity: SafeInt(200),
      visibilityBp: SafeInt(AIR_COMBAT_VISIBILITY_CLEAR_BP),
      targetManeuverBp: SafeInt(AIR_COMBAT_MANEUVER_STATIONARY_BP),
      disruptionBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
      altitude: "LOW",
    };
    const result = computeBombingAccuracy(params);
    expect(Number(result)).toBe(10_000);
  });

  it("dive bombing higher than level under same penalties", () => {
    // With penalties: level at HIGH = 5_000, dive also at HIGH should be higher
    // Level: 10_000 * 5_000 * 10_000 * 10_000 * 10_000 * 10_000 / 10_000^5 = 5_000
    // Dive:  22_500 * 5_000 * 10_000 * 10_000 * 10_000 * 10_000 / 10_000^5 = 11_250
    //   but clamped to 10_000
    const levelParams: BombingAccuracyParams = {
      baseAccuracyBp: SafeInt(AIR_COMBAT_LEVEL_BOMBING_BASE_ACCURACY_BP),
      payloadCapacity: SafeInt(200),
      visibilityBp: SafeInt(AIR_COMBAT_VISIBILITY_CLEAR_BP),
      targetManeuverBp: SafeInt(AIR_COMBAT_MANEUVER_STATIONARY_BP),
      disruptionBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
      altitude: "HIGH",
    };
    const diveParams: BombingAccuracyParams = {
      ...levelParams,
      baseAccuracyBp: SafeInt(AIR_COMBAT_DIVE_BOMBING_BASE_ACCURACY_BP),
    };

    const levelResult = computeBombingAccuracy(levelParams);
    const diveResult = computeBombingAccuracy(diveParams);

    expect(Number(levelResult)).toBe(5_000);
    expect(Number(diveResult)).toBeGreaterThan(Number(levelResult));
  });

  it("combined factors: all penalties together → accuracy << individual penalties", () => {
    // Level, HIGH(5_000), FOG(5_000), agile(3_000), disruption(5_000), payload=20(1_000)
    // 10_000 * 5_000 * 5_000 * 3_000 * 5_000 * 1_000 / 10_000^5 = 37
    const params: BombingAccuracyParams = {
      baseAccuracyBp: SafeInt(AIR_COMBAT_LEVEL_BOMBING_BASE_ACCURACY_BP),
      payloadCapacity: SafeInt(20), // gives payloadFactorBp = clamp(1000, 10000, 20*50=1000) = 1000
      visibilityBp: SafeInt(AIR_COMBAT_VISIBILITY_FOG_BP),
      targetManeuverBp: SafeInt(AIR_COMBAT_MANEUVER_AGILE_BP),
      disruptionBp: SafeInt(5_000),
      altitude: "HIGH",
    };
    const result = computeBombingAccuracy(params);
    expect(Number(result)).toBe(37);
  });

  it("zero payload → minimum payload factor of 1_000bp, still computes", () => {
    // payload=0 → 0*50=0 → clamp(1000, 10000, 0) = 1000
    // 10_000 * 10_000 * 10_000 * 10_000 * 10_000 * 1_000 / 10_000^5 = 1_000
    const params: BombingAccuracyParams = {
      baseAccuracyBp: SafeInt(AIR_COMBAT_LEVEL_BOMBING_BASE_ACCURACY_BP),
      payloadCapacity: SafeInt(0),
      visibilityBp: SafeInt(AIR_COMBAT_VISIBILITY_CLEAR_BP),
      targetManeuverBp: SafeInt(AIR_COMBAT_MANEUVER_STATIONARY_BP),
      disruptionBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
      altitude: "LOW",
    };
    const result = computeBombingAccuracy(params);
    expect(Number(result)).toBe(1_000);
  });

  it("invalid parameters (negative baseAccuracyBp) → throws AIR_COMBAT_BOMBING_PARAMETERS_INVALID", () => {
    const params: BombingAccuracyParams = {
      baseAccuracyBp: SafeInt(-1),
      payloadCapacity: SafeInt(200),
      visibilityBp: SafeInt(AIR_COMBAT_VISIBILITY_CLEAR_BP),
      targetManeuverBp: SafeInt(AIR_COMBAT_MANEUVER_STATIONARY_BP),
      disruptionBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
      altitude: "LOW",
    };
    expect(() => computeBombingAccuracy(params)).toThrow(AIR_COMBAT_BOMBING_PARAMETERS_INVALID);
  });

  it("invalid parameters (negative disruptionBp) → throws AIR_COMBAT_BOMBING_PARAMETERS_INVALID", () => {
    const params: BombingAccuracyParams = {
      baseAccuracyBp: SafeInt(AIR_COMBAT_LEVEL_BOMBING_BASE_ACCURACY_BP),
      payloadCapacity: SafeInt(200),
      visibilityBp: SafeInt(AIR_COMBAT_VISIBILITY_CLEAR_BP),
      targetManeuverBp: SafeInt(AIR_COMBAT_MANEUVER_STATIONARY_BP),
      disruptionBp: SafeInt(-100),
      altitude: "LOW",
    };
    expect(() => computeBombingAccuracy(params)).toThrow(AIR_COMBAT_BOMBING_PARAMETERS_INVALID);
  });

  it("invalid parameters (invalid altitude string) → throws AIR_COMBAT_BOMBING_PARAMETERS_INVALID", () => {
    const params = {
      baseAccuracyBp: SafeInt(AIR_COMBAT_LEVEL_BOMBING_BASE_ACCURACY_BP),
      payloadCapacity: SafeInt(200),
      visibilityBp: SafeInt(AIR_COMBAT_VISIBILITY_CLEAR_BP),
      targetManeuverBp: SafeInt(AIR_COMBAT_MANEUVER_STATIONARY_BP),
      disruptionBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
      altitude: "STRATOSPHERE",
    } as unknown as BombingAccuracyParams;
    expect(() => computeBombingAccuracy(params)).toThrow(AIR_COMBAT_BOMBING_PARAMETERS_INVALID);
  });
});
