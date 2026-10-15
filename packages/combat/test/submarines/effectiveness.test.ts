import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  COASTAL_SUBMARINE_RANGE_RESTRICTED,
  SUBMARINE_RESOLUTION_DEFERRED,
  SUBMARINE_BASIS_POINTS_PER_UNIT,
  submarineEffectivenessPolicyId,
  SHIPPED_SUBMARINE_EFFECTIVENESS_CONTRACT,
  validateSubmarineEffectivenessContract,
  computeStrategicMissionEffectiveness,
  evaluateCoastalRestriction,
  coastalLocalEfficiencyOnly,
  SUBMARINE_BASE_SUPPORT_MULTIPLIER_BP,
  SUBMARINE_POLICY_MULTIPLIER_BP,
  SUBMARINE_INTELLIGENCE_MULTIPLIER_BP,
  SUBMARINE_ENEMY_PROTECTION_MULTIPLIER_BP,
  SUBMARINE_BLOCKADE_MULTIPLIER_BP,
  SUBMARINE_INTELLIGENCE_MULTIPLIER_DEFERRED_MARKER,
} from "../../src/submarines/index.js";

describe("AC-9: strategic mission effectiveness (§11)", () => {
  it("computes effectiveness with all default multipliers", () => {
    const result = computeStrategicMissionEffectiveness({
      baseMissionStrength: SafeInt(1_000),
      typeRemoteEfficiencyBp: SafeInt(10_000),
      reliabilityMultiplierBp: SafeInt(10_000),
    });
    expect(result).toBe(1_000);
  });

  it("applies typeRemoteEfficiencyBp correctly (10_000→12_500 = 1.25x)", () => {
    const result = computeStrategicMissionEffectiveness({
      baseMissionStrength: SafeInt(1_000),
      typeRemoteEfficiencyBp: SafeInt(12_500),
      reliabilityMultiplierBp: SafeInt(10_000),
    });
    expect(result).toBe(1_250);
  });

  it("applies reliabilityMultiplierBp correctly (4_000 = 0.4x)", () => {
    const result = computeStrategicMissionEffectiveness({
      baseMissionStrength: SafeInt(1_000),
      typeRemoteEfficiencyBp: SafeInt(10_000),
      reliabilityMultiplierBp: SafeInt(4_000),
    });
    expect(result).toBe(400);
  });

  it("applies all custom multipliers correctly", () => {
    const result = computeStrategicMissionEffectiveness({
      baseMissionStrength: SafeInt(10_000),
      typeRemoteEfficiencyBp: SafeInt(12_500),
      reliabilityMultiplierBp: SafeInt(11_000),
      baseSupportMultiplierBp: SafeInt(9_000),
      policyMultiplierBp: SafeInt(8_000),
      intelligenceMultiplierBp: SafeInt(7_000),
      enemyProtectionMultiplierBp: SafeInt(6_000),
      blockadeMultiplierBp: SafeInt(5_000),
    });
    const expected = Math.floor(
      (10_000 * 12_500 * 11_000 * 9_000 * 8_000 * 7_000 * 6_000 * 5_000) / 10_000 ** 7,
    );
    expect(result).toBe(expected);
  });

  it("floors the result (rounds once with FLOOR)", () => {
    const result = computeStrategicMissionEffectiveness({
      baseMissionStrength: SafeInt(1),
      typeRemoteEfficiencyBp: SafeInt(7_500),
      reliabilityMultiplierBp: SafeInt(7_500),
    });
    expect(result).toBe(0);
  });

  it("returns 0 when base is 0", () => {
    const result = computeStrategicMissionEffectiveness({
      baseMissionStrength: SafeInt(0),
      typeRemoteEfficiencyBp: SafeInt(10_000),
      reliabilityMultiplierBp: SafeInt(10_000),
    });
    expect(result).toBe(0);
  });

  it("accepts explicit custom baseSupportMultiplierBp", () => {
    const withCustom = computeStrategicMissionEffectiveness({
      baseMissionStrength: SafeInt(1_000),
      typeRemoteEfficiencyBp: SafeInt(10_000),
      reliabilityMultiplierBp: SafeInt(10_000),
      baseSupportMultiplierBp: SafeInt(8_000),
    });
    expect(withCustom).toBe(800);
  });

  it("accepts explicit custom policyMultiplierBp", () => {
    const withCustom = computeStrategicMissionEffectiveness({
      baseMissionStrength: SafeInt(1_000),
      typeRemoteEfficiencyBp: SafeInt(10_000),
      reliabilityMultiplierBp: SafeInt(10_000),
      policyMultiplierBp: SafeInt(12_000),
    });
    expect(withCustom).toBe(1_200);
  });

  it("accepts explicit custom intelligenceMultiplierBp", () => {
    const withCustom = computeStrategicMissionEffectiveness({
      baseMissionStrength: SafeInt(1_000),
      typeRemoteEfficiencyBp: SafeInt(10_000),
      reliabilityMultiplierBp: SafeInt(10_000),
      intelligenceMultiplierBp: SafeInt(8_500),
    });
    expect(withCustom).toBe(850);
  });

  it("accepts explicit custom enemyProtectionMultiplierBp", () => {
    const withCustom = computeStrategicMissionEffectiveness({
      baseMissionStrength: SafeInt(1_000),
      typeRemoteEfficiencyBp: SafeInt(10_000),
      reliabilityMultiplierBp: SafeInt(10_000),
      enemyProtectionMultiplierBp: SafeInt(11_500),
    });
    expect(withCustom).toBe(1_150);
  });

  it("accepts explicit custom blockadeMultiplierBp", () => {
    const withCustom = computeStrategicMissionEffectiveness({
      baseMissionStrength: SafeInt(1_000),
      typeRemoteEfficiencyBp: SafeInt(10_000),
      reliabilityMultiplierBp: SafeInt(10_000),
      blockadeMultiplierBp: SafeInt(9_000),
    });
    expect(withCustom).toBe(900);
  });

  it("fails closed on negative baseMissionStrength", () => {
    expect(() =>
      computeStrategicMissionEffectiveness({
        baseMissionStrength: SafeInt(-1),
        typeRemoteEfficiencyBp: SafeInt(10_000),
        reliabilityMultiplierBp: SafeInt(10_000),
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on non-integer baseMissionStrength", () => {
    expect(() =>
      computeStrategicMissionEffectiveness({
        baseMissionStrength: 1.5 as SafeInt,
        typeRemoteEfficiencyBp: SafeInt(10_000),
        reliabilityMultiplierBp: SafeInt(10_000),
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on out-of-range typeRemoteEfficiencyBp (>20_000)", () => {
    expect(() =>
      computeStrategicMissionEffectiveness({
        baseMissionStrength: SafeInt(1_000),
        typeRemoteEfficiencyBp: SafeInt(25_000),
        reliabilityMultiplierBp: SafeInt(10_000),
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on out-of-range reliabilityMultiplierBp (>20_000)", () => {
    expect(() =>
      computeStrategicMissionEffectiveness({
        baseMissionStrength: SafeInt(1_000),
        typeRemoteEfficiencyBp: SafeInt(10_000),
        reliabilityMultiplierBp: SafeInt(25_000),
      }),
    ).toThrow(BluewaveError);
  });

  it("uses default multipliers when optional params omitted", () => {
    const result = computeStrategicMissionEffectiveness({
      baseMissionStrength: SafeInt(5_000),
      typeRemoteEfficiencyBp: SafeInt(10_000),
      reliabilityMultiplierBp: SafeInt(10_000),
    });
    expect(result).toBe(5_000);
  });
});

describe("AC-10: coastal range restriction (§12)", () => {
  it("permits non-coastal types unrestricted", () => {
    const verdict = evaluateCoastalRestriction({
      submarineTypeId: "LONG_RANGE",
      atWar: true,
      targetProximityBand: "EXTREME_REMOTE",
      isWithinHomeArea: false,
      isAdjacentToSupportBase: false,
      isEmergencyRedeployment: false,
    });
    expect(verdict.restricted).toBe(false);
    expect(verdict.movementKind).toBe("NOT_COASTAL_TYPE");
  });

  it("permits coastal within home area during war", () => {
    const verdict = evaluateCoastalRestriction({
      submarineTypeId: "COASTAL",
      atWar: true,
      targetProximityBand: "LOCAL",
      isWithinHomeArea: true,
      isAdjacentToSupportBase: false,
      isEmergencyRedeployment: false,
    });
    expect(verdict.restricted).toBe(false);
    expect(verdict.movementKind).toBe("NORMAL_MOVEMENT_WITHIN_HOME_AREA");
  });

  it("permits coastal one adjacent edge to support base during war", () => {
    const verdict = evaluateCoastalRestriction({
      submarineTypeId: "COASTAL",
      atWar: true,
      targetProximityBand: "LOCAL",
      isWithinHomeArea: false,
      isAdjacentToSupportBase: true,
      isEmergencyRedeployment: false,
    });
    expect(verdict.restricted).toBe(false);
    expect(verdict.movementKind).toBe("NORMAL_MOVEMENT_ADJACENT_TO_SUPPORT_BASE");
  });

  it("permits coastal emergency redeployment during war", () => {
    const verdict = evaluateCoastalRestriction({
      submarineTypeId: "COASTAL",
      atWar: true,
      targetProximityBand: "LOCAL",
      isWithinHomeArea: false,
      isAdjacentToSupportBase: false,
      isEmergencyRedeployment: true,
    });
    expect(verdict.restricted).toBe(false);
    expect(verdict.movementKind).toBe("EMERGENCY_REDEPLOYMENT");
  });

  it("rejects coastal remote raiding (non-LOCAL band during war)", () => {
    const verdict = evaluateCoastalRestriction({
      submarineTypeId: "COASTAL",
      atWar: true,
      targetProximityBand: "REGIONAL",
      isWithinHomeArea: false,
      isAdjacentToSupportBase: false,
      isEmergencyRedeployment: false,
    });
    expect(verdict.restricted).toBe(true);
    expect(verdict.reasonCode).toBe(COASTAL_SUBMARINE_RANGE_RESTRICTED);
    expect(verdict.movementKind).toBe("REMOTE_RAIDING");
  });

  it("rejects coastal chained adjacent exceptions", () => {
    const verdict = evaluateCoastalRestriction({
      submarineTypeId: "COASTAL",
      atWar: true,
      targetProximityBand: "LOCAL",
      isWithinHomeArea: false,
      isAdjacentToSupportBase: false,
      isEmergencyRedeployment: false,
    });
    expect(verdict.restricted).toBe(true);
    expect(verdict.reasonCode).toBe(COASTAL_SUBMARINE_RANGE_RESTRICTED);
    expect(verdict.movementKind).toBe("CHAINED_ADJACENT_EXCEPTION");
  });

  it("permits coastal normal movement when not at war", () => {
    const verdict = evaluateCoastalRestriction({
      submarineTypeId: "COASTAL",
      atWar: false,
      targetProximityBand: "REGIONAL",
      isWithinHomeArea: false,
      isAdjacentToSupportBase: false,
      isEmergencyRedeployment: false,
    });
    expect(verdict.restricted).toBe(false);
    expect(verdict.movementKind).toBe("NORMAL_MOVEMENT_OUTSIDE_WAR");
  });

  it("rejects coastal remote raiding in REMOTE band", () => {
    const verdict = evaluateCoastalRestriction({
      submarineTypeId: "COASTAL",
      atWar: true,
      targetProximityBand: "REMOTE",
      isWithinHomeArea: false,
      isAdjacentToSupportBase: false,
      isEmergencyRedeployment: false,
    });
    expect(verdict.restricted).toBe(true);
    expect(verdict.movementKind).toBe("REMOTE_RAIDING");
  });

  it("rejects coastal remote raiding in EXTREME_REMOTE band", () => {
    const verdict = evaluateCoastalRestriction({
      submarineTypeId: "COASTAL",
      atWar: true,
      targetProximityBand: "EXTREME_REMOTE",
      isWithinHomeArea: false,
      isAdjacentToSupportBase: false,
      isEmergencyRedeployment: false,
    });
    expect(verdict.restricted).toBe(true);
    expect(verdict.movementKind).toBe("REMOTE_RAIDING");
  });
});

describe("coastalLocalEfficiencyOnly", () => {
  it("returns true for coastal in LOCAL band", () => {
    expect(coastalLocalEfficiencyOnly("COASTAL", "LOCAL")).toBe(true);
  });

  it("returns false for coastal in non-LOCAL band", () => {
    expect(coastalLocalEfficiencyOnly("COASTAL", "REGIONAL")).toBe(false);
    expect(coastalLocalEfficiencyOnly("COASTAL", "REMOTE")).toBe(false);
    expect(coastalLocalEfficiencyOnly("COASTAL", "EXTREME_REMOTE")).toBe(false);
  });

  it("returns false for non-coastal types in any band", () => {
    expect(coastalLocalEfficiencyOnly("LONG_RANGE", "LOCAL")).toBe(false);
    expect(coastalLocalEfficiencyOnly("MEDIUM_RANGE", "LOCAL")).toBe(false);
    expect(coastalLocalEfficiencyOnly("MINELAYING", "LOCAL")).toBe(false);
    expect(coastalLocalEfficiencyOnly("MISSILE", "LOCAL")).toBe(false);
  });
});

describe("§11 authored multiplier defaults", () => {
  it("base support multiplier is 10_000 (1.0x)", () => {
    expect(SUBMARINE_BASE_SUPPORT_MULTIPLIER_BP).toBe(SUBMARINE_BASIS_POINTS_PER_UNIT);
  });

  it("policy multiplier is 10_000 (1.0x)", () => {
    expect(SUBMARINE_POLICY_MULTIPLIER_BP).toBe(SUBMARINE_BASIS_POINTS_PER_UNIT);
  });

  it("intelligence multiplier is 10_000 (1.0x) and carries DEFERRED marker", () => {
    expect(SUBMARINE_INTELLIGENCE_MULTIPLIER_BP).toBe(SUBMARINE_BASIS_POINTS_PER_UNIT);
    expect(SUBMARINE_INTELLIGENCE_MULTIPLIER_DEFERRED_MARKER).toBe(SUBMARINE_RESOLUTION_DEFERRED);
  });

  it("enemy protection multiplier is 10_000 (1.0x)", () => {
    expect(SUBMARINE_ENEMY_PROTECTION_MULTIPLIER_BP).toBe(SUBMARINE_BASIS_POINTS_PER_UNIT);
  });

  it("blockade multiplier is 10_000 (1.0x)", () => {
    expect(SUBMARINE_BLOCKADE_MULTIPLIER_BP).toBe(SUBMARINE_BASIS_POINTS_PER_UNIT);
  });
});

describe("submarine_effectiveness_v1 contract (AC-21)", () => {
  it("shipped contract matches expected policy id and values", () => {
    expect(SHIPPED_SUBMARINE_EFFECTIVENESS_CONTRACT.policyId).toBe(submarineEffectivenessPolicyId);
    expect(SHIPPED_SUBMARINE_EFFECTIVENESS_CONTRACT.basisPointsPerUnit).toBe(10_000);
    expect(SHIPPED_SUBMARINE_EFFECTIVENESS_CONTRACT.denominator).toBe(10_000 ** 7);
  });

  it("validate passes for the shipped contract", () => {
    expect(() =>
      validateSubmarineEffectivenessContract(SHIPPED_SUBMARINE_EFFECTIVENESS_CONTRACT),
    ).not.toThrow();
  });

  it("validate fails on missing contract", () => {
    expect(() => validateSubmarineEffectivenessContract(null)).toThrow(BluewaveError);
  });

  it("validate fails on wrong policy id", () => {
    expect(() =>
      validateSubmarineEffectivenessContract({
        ...SHIPPED_SUBMARINE_EFFECTIVENESS_CONTRACT,
        policyId: "wrong",
      }),
    ).toThrow(BluewaveError);
  });

  it("validate fails on tampered baseSupportMultiplierBp", () => {
    expect(() =>
      validateSubmarineEffectivenessContract({
        ...SHIPPED_SUBMARINE_EFFECTIVENESS_CONTRACT,
        baseSupportMultiplierBp: 9_000,
      }),
    ).toThrow(BluewaveError);
  });
});
