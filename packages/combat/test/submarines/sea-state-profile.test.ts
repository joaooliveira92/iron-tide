import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  SUBMARINE_SEA_STATE_OPERATION_PROHIBITED,
  SUBMARINE_SEA_STATE_CATEGORIES,
  submarineSeaStatePolicyId,
  SHIPPED_SUBMARINE_SEA_STATE_CONTRACT,
  validateSubmarineSeaStateContract,
  seaStateCategory,
  isOptimumSeaState,
  submarineDetectionMultiplierBp,
  submarineSurfacedDetectionBp,
  submarineObservationMultiplierBp,
  submarineAttackMultiplierBp,
  isSeaStateOperationProhibited,
  assertSeaStateOperationPermitted,
  buildSeaStateProfile,
  SUBMARINE_SNORKEL_MACHINERY_MULTIPLIER_BP,
  SUBMARINE_SURFACED_TRANSIT_SPEED_BP,
  SUBMARINE_SURFACED_DETECTION_ADDITION_BP,
  SUBMARINE_SEA_STATE_MIN,
  SUBMARINE_SEA_STATE_MAX,
  SUBMARINE_SEA_STATE_OPTIMUM_MIN,
  SUBMARINE_SEA_STATE_OPTIMUM_MAX,
} from "@bluewave/combat/submarines";

describe("AC-11: sea-state scale (§13)", () => {
  it("shipped range min is 0 and max is 9", () => {
    expect(SUBMARINE_SEA_STATE_MIN).toBe(0);
    expect(SUBMARINE_SEA_STATE_MAX).toBe(9);
  });

  it("shipped optimum band is 2..5", () => {
    expect(SUBMARINE_SEA_STATE_OPTIMUM_MIN).toBe(2);
    expect(SUBMARINE_SEA_STATE_OPTIMUM_MAX).toBe(5);
  });

  it("shipped categories are CALM, OPTIMAL, HEAVY, SEVERE", () => {
    expect(SUBMARINE_SEA_STATE_CATEGORIES).toEqual(["CALM", "OPTIMAL", "HEAVY", "SEVERE"]);
  });

  it("seaStateCategory: CALM for 0 and 1", () => {
    expect(seaStateCategory(SafeInt(0))).toBe("CALM");
    expect(seaStateCategory(SafeInt(1))).toBe("CALM");
  });

  it("seaStateCategory: OPTIMAL for 2..5", () => {
    for (let ss = 2; ss <= 5; ss++) {
      expect(seaStateCategory(SafeInt(ss))).toBe("OPTIMAL");
    }
  });

  it("seaStateCategory: HEAVY for 6..7", () => {
    for (let ss = 6; ss <= 7; ss++) {
      expect(seaStateCategory(SafeInt(ss))).toBe("HEAVY");
    }
  });

  it("seaStateCategory: SEVERE for 8..9", () => {
    for (let ss = 8; ss <= 9; ss++) {
      expect(seaStateCategory(SafeInt(ss))).toBe("SEVERE");
    }
  });

  it("seaStateCategory fails closed on out-of-range values", () => {
    expect(() => seaStateCategory(SafeInt(-1))).toThrow(BluewaveError);
    expect(() => seaStateCategory(SafeInt(10))).toThrow(BluewaveError);
    expect(() => seaStateCategory(1.5 as SafeInt)).toThrow(BluewaveError);
  });

  it("isOptimumSeaState: true for 2..5, false otherwise", () => {
    for (let ss = 0; ss <= 9; ss++) {
      expect(isOptimumSeaState(SafeInt(ss))).toBe(ss >= 2 && ss <= 5);
    }
  });
});

describe("AC-12: §14 detection multipliers", () => {
  it("shipped exact table values", () => {
    const expected = [13_000, 11_500, 10_000, 9_500, 9_500, 10_000, 10_500, 11_000, 11_500, 12_500];
    for (let ss = 0; ss <= 9; ss++) {
      expect(submarineDetectionMultiplierBp(SafeInt(ss))).toBe(expected[ss]);
    }
  });
});

describe("AC-12: §15 observation multipliers", () => {
  it("shipped exact table values", () => {
    const expected = [11_000, 10_500, 10_000, 10_000, 10_000, 9_500, 8_000, 6_500, 5_000, 3_500];
    for (let ss = 0; ss <= 9; ss++) {
      expect(submarineObservationMultiplierBp(SafeInt(ss))).toBe(expected[ss]);
    }
  });
});

describe("AC-12: §16 attack multipliers", () => {
  it("shipped exact table values", () => {
    const expected = [10_000, 10_000, 10_500, 11_000, 11_000, 10_500, 8_500, 7_000, 5_000, 2_500];
    for (let ss = 0; ss <= 9; ss++) {
      expect(submarineAttackMultiplierBp(SafeInt(ss))).toBe(expected[ss]);
    }
  });

  it("highest attack multiplier is 11_000 at sea states 3 and 4", () => {
    expect(submarineAttackMultiplierBp(SafeInt(3))).toBe(11_000);
    expect(submarineAttackMultiplierBp(SafeInt(4))).toBe(11_000);
  });
});

describe("AC-12: §17 surface/snorkel operations", () => {
  it("snorkel machinery multiplier is 7_500", () => {
    expect(SUBMARINE_SNORKEL_MACHINERY_MULTIPLIER_BP).toBe(7_500);
  });

  it("surfaced transit speed multiplier is 7_500", () => {
    expect(SUBMARINE_SURFACED_TRANSIT_SPEED_BP).toBe(7_500);
  });

  it("surfaced detection addition at sea state 0-1 is 12_500", () => {
    expect(SUBMARINE_SURFACED_DETECTION_ADDITION_BP).toBe(12_500);
    expect(submarineSurfacedDetectionBp(SafeInt(0))).toBe(13_000 + 12_500);
    expect(submarineSurfacedDetectionBp(SafeInt(1))).toBe(11_500 + 12_500);
    expect(submarineSurfacedDetectionBp(SafeInt(2))).toBe(10_000);
  });

  it("isSeaStateOperationProhibited: true for 8-9, false for 0-7", () => {
    for (let ss = 0; ss <= 7; ss++) {
      expect(isSeaStateOperationProhibited(SafeInt(ss))).toBe(false);
    }
    for (let ss = 8; ss <= 9; ss++) {
      expect(isSeaStateOperationProhibited(SafeInt(ss))).toBe(true);
    }
  });

  it("assertSeaStateOperationPermitted throws for sea state 8-9", () => {
    expect(() => assertSeaStateOperationPermitted(SafeInt(8))).toThrow(
      SUBMARINE_SEA_STATE_OPERATION_PROHIBITED,
    );
    expect(() => assertSeaStateOperationPermitted(SafeInt(9))).toThrow(
      SUBMARINE_SEA_STATE_OPERATION_PROHIBITED,
    );
  });

  it("assertSeaStateOperationPermitted passes for sea state 0-7", () => {
    for (let ss = 0; ss <= 7; ss++) {
      expect(() => assertSeaStateOperationPermitted(SafeInt(ss))).not.toThrow();
    }
  });
});

describe("buildSeaStateProfile", () => {
  it("returns full profile for a given sea state", () => {
    const profile = buildSeaStateProfile(SafeInt(3));
    expect(profile.seaState).toBe(3);
    expect(profile.category).toBe("OPTIMAL");
    expect(profile.isOptimum).toBe(true);
    expect(profile.detectionMultiplierBp).toBe(9_500);
    expect(profile.observationMultiplierBp).toBe(10_000);
    expect(profile.attackMultiplierBp).toBe(11_000);
    expect(profile.operationProhibited).toBe(false);
    expect(profile.snorkelMachineryMultiplierBp).toBe(7_500);
    expect(profile.surfacedTransitSpeedBp).toBe(7_500);
  });

  it("SEVERE profile includes surfaced detection addition", () => {
    const profile = buildSeaStateProfile(SafeInt(9));
    expect(profile.category).toBe("SEVERE");
    expect(profile.isOptimum).toBe(false);
    expect(profile.operationProhibited).toBe(true);
  });

  it("CALM profile includes surfaced detection addition", () => {
    const profile = buildSeaStateProfile(SafeInt(0));
    expect(profile.category).toBe("CALM");
    expect(profile.surfacedDetectionBp).toBe(13_000 + 12_500);
  });
});

describe("submarine_sea_state_v1 contract (AC-21)", () => {
  it("shipped contract matches expected policy id and values", () => {
    expect(SHIPPED_SUBMARINE_SEA_STATE_CONTRACT.policyId).toBe(submarineSeaStatePolicyId);
    expect(SHIPPED_SUBMARINE_SEA_STATE_CONTRACT.basisPointsPerUnit).toBe(10_000);
    expect(SHIPPED_SUBMARINE_SEA_STATE_CONTRACT.seaStateRangeMin).toBe(0);
    expect(SHIPPED_SUBMARINE_SEA_STATE_CONTRACT.seaStateRangeMax).toBe(9);
  });

  it("validate passes for the shipped contract", () => {
    expect(() =>
      validateSubmarineSeaStateContract(SHIPPED_SUBMARINE_SEA_STATE_CONTRACT),
    ).not.toThrow();
  });

  it("validate fails on missing contract", () => {
    expect(() => validateSubmarineSeaStateContract(null)).toThrow(BluewaveError);
  });

  it("validate fails on tampered detection table", () => {
    const tampered = {
      ...SHIPPED_SUBMARINE_SEA_STATE_CONTRACT,
      detectionTableBp: { ...SHIPPED_SUBMARINE_SEA_STATE_CONTRACT.detectionTableBp, "3": 9_000 },
    };
    expect(() => validateSubmarineSeaStateContract(tampered)).toThrow(BluewaveError);
  });
});
