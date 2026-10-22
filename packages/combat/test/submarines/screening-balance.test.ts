import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  SUBMARINE_ATTACK_OPPORTUNITY_CREATED,
  submarineScreeningBalancePolicyId,
  SHIPPED_SUBMARINE_SCREENING_BALANCE_CONTRACT,
  validateSubmarineScreeningBalanceContract,
  computeScreenRatioBp,
  screeningOpportunityMultiplierBp,
  SUBMARINE_HEAVY_SHIP_TYPES,
  SUBMARINE_ELIGIBLE_ESCORT_TYPES,
  computeAttackOpportunityValue,
  createAttackOpportunityRecord,
} from "@bluewave/combat/submarines";

describe("AC-13: screening balance (§18)", () => {
  it("heavy ship types are BB, BC, B, CV, CVL, CA", () => {
    expect(SUBMARINE_HEAVY_SHIP_TYPES).toEqual(["BB", "BC", "B", "CV", "CVL", "CA"]);
  });

  it("eligible escort types are DD, KE, CL", () => {
    expect(SUBMARINE_ELIGIBLE_ESCORT_TYPES).toEqual(["DD", "KE", "CL"]);
  });

  it("screenRatioBp: equal strength gives 10_000", () => {
    expect(computeScreenRatioBp(SafeInt(100), SafeInt(100))).toBe(10_000);
  });

  it("screenRatioBp: 2:1 escort advantage gives 20_000", () => {
    expect(computeScreenRatioBp(SafeInt(200), SafeInt(100))).toBe(20_000);
  });

  it("screenRatioBp: 1:2 escort disadvantage gives 5_000", () => {
    expect(computeScreenRatioBp(SafeInt(50), SafeInt(100))).toBe(5_000);
  });

  it("screenRatioBp: zero heavy ships resolves to max(1, 0) = 1", () => {
    expect(computeScreenRatioBp(SafeInt(50), SafeInt(0))).toBe(50 * 10_000);
  });

  it("screenRatioBp: zero escorts gives 0", () => {
    expect(computeScreenRatioBp(SafeInt(0), SafeInt(100))).toBe(0);
  });

  it("screenRatioBp: floors the division result", () => {
    expect(computeScreenRatioBp(SafeInt(1), SafeInt(3))).toBe(Math.floor((1 * 10_000) / 3));
  });

  it("screeningOpportunityMultiplierBp: < 2_500 → 15_000", () => {
    expect(screeningOpportunityMultiplierBp(SafeInt(0))).toBe(15_000);
    expect(screeningOpportunityMultiplierBp(SafeInt(2_499))).toBe(15_000);
  });

  it("screeningOpportunityMultiplierBp: 2_500..4_999 → 12_500", () => {
    expect(screeningOpportunityMultiplierBp(SafeInt(2_500))).toBe(12_500);
    expect(screeningOpportunityMultiplierBp(SafeInt(4_999))).toBe(12_500);
  });

  it("screeningOpportunityMultiplierBp: 5_000..7_499 → 10_000", () => {
    expect(screeningOpportunityMultiplierBp(SafeInt(5_000))).toBe(10_000);
    expect(screeningOpportunityMultiplierBp(SafeInt(7_499))).toBe(10_000);
  });

  it("screeningOpportunityMultiplierBp: 7_500..9_999 → 8_500", () => {
    expect(screeningOpportunityMultiplierBp(SafeInt(7_500))).toBe(8_500);
    expect(screeningOpportunityMultiplierBp(SafeInt(9_999))).toBe(8_500);
  });

  it("screeningOpportunityMultiplierBp: ≥10_000 → 7_500", () => {
    expect(screeningOpportunityMultiplierBp(SafeInt(10_000))).toBe(7_500);
    expect(screeningOpportunityMultiplierBp(SafeInt(100_000))).toBe(7_500);
  });

  it("screeningOpportunityMultiplierBp: fails closed on negative ratio", () => {
    expect(() => screeningOpportunityMultiplierBp(SafeInt(-1))).toThrow(BluewaveError);
  });

  it("computeScreenRatioBp: fails closed on negative escort strength", () => {
    expect(() => computeScreenRatioBp(SafeInt(-1), SafeInt(100))).toThrow(BluewaveError);
  });

  it("computeScreenRatioBp: fails closed on negative heavy ship strength", () => {
    expect(() => computeScreenRatioBp(SafeInt(100), SafeInt(-1))).toThrow(BluewaveError);
  });
});

describe("AC-14: attack-opportunity value-only (§19)", () => {
  it("computeAttackOpportunityValue: all 10_000 factors gives value = input", () => {
    const result = computeAttackOpportunityValue({
      policyWeightBp: 5_000,
      targetAvailabilityFactorBp: 10_000,
      intelligenceFactorBp: 10_000,
      regionalProtectionFactorBp: 10_000,
      missionStrengthFactorBp: 10_000,
    });
    expect(result).toBe(5_000);
  });

  it("computeAttackOpportunityValue: scales with all 5 factors", () => {
    const result = computeAttackOpportunityValue({
      policyWeightBp: 10_000,
      targetAvailabilityFactorBp: 8_000,
      intelligenceFactorBp: 7_000,
      regionalProtectionFactorBp: 6_000,
      missionStrengthFactorBp: 5_000,
    });
    const expected = Math.floor((10_000 * 8_000 * 7_000 * 6_000 * 5_000) / 10_000 ** 4);
    expect(result).toBe(expected);
  });

  it("computeAttackOpportunityValue: floors result", () => {
    const result = computeAttackOpportunityValue({
      policyWeightBp: 1,
      targetAvailabilityFactorBp: 7_500,
      intelligenceFactorBp: 7_500,
      regionalProtectionFactorBp: 7_500,
      missionStrengthFactorBp: 7_500,
    });
    expect(result).toBe(0);
  });

  it("computeAttackOpportunityValue: fails closed on negative factor", () => {
    expect(() =>
      computeAttackOpportunityValue({
        policyWeightBp: -1,
        targetAvailabilityFactorBp: 10_000,
        intelligenceFactorBp: 10_000,
        regionalProtectionFactorBp: 10_000,
        missionStrengthFactorBp: 10_000,
      }),
    ).toThrow(BluewaveError);
  });

  it("computeAttackOpportunityValue: fails closed on out-of-range factor", () => {
    expect(() =>
      computeAttackOpportunityValue({
        policyWeightBp: 25_000,
        targetAvailabilityFactorBp: 10_000,
        intelligenceFactorBp: 10_000,
        regionalProtectionFactorBp: 10_000,
        missionStrengthFactorBp: 10_000,
      }),
    ).toThrow(BluewaveError);
  });

  it("createAttackOpportunityRecord: creates record with correct fields", () => {
    const record = createAttackOpportunityRecord(
      "opp-001",
      "war-great-war",
      "area-north-sea",
      "sub-001",
      SafeInt(12),
      "FLEET_SUPPORT",
      SafeInt(8_500),
    );
    expect(record.opportunityId).toBe("opp-001");
    expect(record.warId).toBe("war-great-war");
    expect(record.areaId).toBe("area-north-sea");
    expect(record.submarineAssetId).toBe("sub-001");
    expect(record.month).toBe(12);
    expect(record.policyId).toBe("FLEET_SUPPORT");
    expect(record.opportunityValueBp).toBe(8_500);
    expect(record.reasonCode).toBe(SUBMARINE_ATTACK_OPPORTUNITY_CREATED);
    expect(record.streamKey).toBe("submarine/12/war-great-war/area-north-sea/attack_opportunity");
  });

  it("createAttackOpportunityRecord: fails closed on empty opportunityId", () => {
    expect(() =>
      createAttackOpportunityRecord(
        "",
        "war-1",
        "area-1",
        "sub-1",
        SafeInt(1),
        "FLEET_SUPPORT",
        SafeInt(10_000),
      ),
    ).toThrow(BluewaveError);
  });
});

describe("submarine_screening_balance_v1 contract (AC-21)", () => {
  it("shipped contract matches expected policy id and type sets", () => {
    expect(SHIPPED_SUBMARINE_SCREENING_BALANCE_CONTRACT.policyId).toBe(
      submarineScreeningBalancePolicyId,
    );
    expect(SHIPPED_SUBMARINE_SCREENING_BALANCE_CONTRACT.heavyShipTypes.length).toBe(6);
    expect(SHIPPED_SUBMARINE_SCREENING_BALANCE_CONTRACT.eligibleEscortTypes.length).toBe(3);
  });

  it("validate passes for the shipped contract", () => {
    expect(() =>
      validateSubmarineScreeningBalanceContract(SHIPPED_SUBMARINE_SCREENING_BALANCE_CONTRACT),
    ).not.toThrow();
  });

  it("validate fails on missing contract", () => {
    expect(() => validateSubmarineScreeningBalanceContract(null)).toThrow(BluewaveError);
  });

  it("validate fails on tampered heavy ship types", () => {
    expect(() =>
      validateSubmarineScreeningBalanceContract({
        ...SHIPPED_SUBMARINE_SCREENING_BALANCE_CONTRACT,
        heavyShipTypes: ["BB", "BC"],
      }),
    ).toThrow(BluewaveError);
  });

  it("validate fails on tampered opportunity band", () => {
    const tampered = {
      ...SHIPPED_SUBMARINE_SCREENING_BALANCE_CONTRACT,
      opportunityBands: SHIPPED_SUBMARINE_SCREENING_BALANCE_CONTRACT.opportunityBands.map((b, i) =>
        i === 0 ? { ...b, multiplierBp: 14_000 } : b,
      ),
    };
    expect(() => validateSubmarineScreeningBalanceContract(tampered)).toThrow(BluewaveError);
  });
});
