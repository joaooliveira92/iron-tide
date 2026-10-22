import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  INVALID_SUBMARINE_REPRESENTATION,
  SUBMARINE_STATE_INVARIANT_FAILED,
  submarineStrategicAssetPolicyId,
  submarineTypesPolicyId,
  submarinePoliciesPolicyId,
  SHIPPED_SUBMARINE_STRATEGIC_ASSET_CONTRACT,
  SHIPPED_SUBMARINE_TYPES_CONTRACT,
  SHIPPED_SUBMARINE_POLICIES_CONTRACT,
  validateSubmarineStrategicAssetContract,
  validateSubmarineTypesContract,
  validateSubmarinePoliciesContract,
  SUBMARINE_TYPES,
  SUBMARINE_POLICIES,
  STRATEGIC_REPRESENTATIONS,
} from "@bluewave/combat/submarines";

describe("AC-21: submarine_strategic_asset_v1 contract + guard (fail closed)", () => {
  it("ships the *_v1 policy id and validates the shipped contract", () => {
    expect(submarineStrategicAssetPolicyId).toBe("submarine_strategic_asset_v1");
    expect(SHIPPED_SUBMARINE_STRATEGIC_ASSET_CONTRACT.policyId).toBe(
      "submarine_strategic_asset_v1",
    );
    expect(() =>
      validateSubmarineStrategicAssetContract(SHIPPED_SUBMARINE_STRATEGIC_ASSET_CONTRACT),
    ).not.toThrow();
  });

  it("fails closed on a tampered §1 representation enum or policy id", () => {
    let err: BluewaveError | undefined;
    try {
      validateSubmarineStrategicAssetContract({
        ...SHIPPED_SUBMARINE_STRATEGIC_ASSET_CONTRACT,
        representations: [...STRATEGIC_REPRESENTATIONS, "BOTH"] as never,
      });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(INVALID_SUBMARINE_REPRESENTATION);

    expect(() =>
      validateSubmarineStrategicAssetContract({
        ...SHIPPED_SUBMARINE_STRATEGIC_ASSET_CONTRACT,
        policyId: "x",
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on null/missing contract", () => {
    expect(() => validateSubmarineStrategicAssetContract(null)).toThrow(BluewaveError);
    expect(() => validateSubmarineStrategicAssetContract(undefined)).toThrow(BluewaveError);
  });
});

describe("AC-21: submarine_types_v1 contract + guard (fail closed)", () => {
  it("ships the *_v1 policy id and validates the shipped contract", () => {
    expect(submarineTypesPolicyId).toBe("submarine_types_v1");
    expect(SHIPPED_SUBMARINE_TYPES_CONTRACT.policyId).toBe("submarine_types_v1");
    expect(() => validateSubmarineTypesContract(SHIPPED_SUBMARINE_TYPES_CONTRACT)).not.toThrow();
  });

  it("wires the closed §4 five-type enum and the §10 long-range ASW table", () => {
    expect([...SHIPPED_SUBMARINE_TYPES_CONTRACT.submarineTypes]).toEqual([...SUBMARINE_TYPES]);
    expect(SHIPPED_SUBMARINE_TYPES_CONTRACT.longRangeAswVulnerabilityBp).toEqual({
      LOCAL: 10_500,
      REGIONAL: 10_750,
      REMOTE: 11_000,
      EXTREME_REMOTE: 11_500,
    });
  });

  it("fails closed on a tampered type list or a tampered §10 ASW value", () => {
    expect(() =>
      validateSubmarineTypesContract({
        ...SHIPPED_SUBMARINE_TYPES_CONTRACT,
        submarineTypes: [...SUBMARINE_TYPES, "NUCLEAR"] as never,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateSubmarineTypesContract({
        ...SHIPPED_SUBMARINE_TYPES_CONTRACT,
        longRangeAswVulnerabilityBp: {
          ...SHIPPED_SUBMARINE_TYPES_CONTRACT.longRangeAswVulnerabilityBp,
          REMOTE: 11_001,
        },
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered shipped-type-id list and null contract", () => {
    expect(() =>
      validateSubmarineTypesContract({
        ...SHIPPED_SUBMARINE_TYPES_CONTRACT,
        shippedSubmarineTypeIds: [],
      }),
    ).toThrow(BluewaveError);
    expect(() => validateSubmarineTypesContract(null)).toThrow(BluewaveError);
  });
});

describe("AC-21: submarine_policies_v1 contract + guard (fail closed)", () => {
  it("ships the *_v1 policy id and validates the shipped contract", () => {
    expect(submarinePoliciesPolicyId).toBe("submarine_policies_v1");
    expect(SHIPPED_SUBMARINE_POLICIES_CONTRACT.policyId).toBe("submarine_policies_v1");
    expect(() =>
      validateSubmarinePoliciesContract(SHIPPED_SUBMARINE_POLICIES_CONTRACT),
    ).not.toThrow();
  });

  it("wires the exact §5 target weights summing warship+merchant to 10_000", () => {
    const w = SHIPPED_SUBMARINE_POLICIES_CONTRACT.targetWeightsBp;
    expect([...SHIPPED_SUBMARINE_POLICIES_CONTRACT.policies]).toEqual([...SUBMARINE_POLICIES]);
    expect(w.FLEET_SUPPORT).toEqual({
      warshipAttackBp: 8_000,
      merchantAttackBp: 2_000,
      neutralIncidentMultiplierBp: 5_000,
    });
    expect(w.PRIZE_RULES).toEqual({
      warshipAttackBp: 5_000,
      merchantAttackBp: 5_000,
      neutralIncidentMultiplierBp: 10_000,
    });
    expect(w.UNRESTRICTED).toEqual({
      warshipAttackBp: 2_500,
      merchantAttackBp: 7_500,
      neutralIncidentMultiplierBp: 20_000,
    });
    for (const policy of SUBMARINE_POLICIES) {
      expect(w[policy].warshipAttackBp + w[policy].merchantAttackBp).toBe(10_000);
    }
  });

  it("fails closed on a tampered weight and a non-summing weight pair", () => {
    errFor(() =>
      validateSubmarinePoliciesContract({
        ...SHIPPED_SUBMARINE_POLICIES_CONTRACT,
        targetWeightsBp: {
          ...SHIPPED_SUBMARINE_POLICIES_CONTRACT.targetWeightsBp,
          UNRESTRICTED: {
            warshipAttackBp: 2_501,
            merchantAttackBp: 7_500,
            neutralIncidentMultiplierBp: 20_000,
          },
        },
      }),
    );
    errFor(() =>
      validateSubmarinePoliciesContract({
        ...SHIPPED_SUBMARINE_POLICIES_CONTRACT,
        targetWeightsBp: {
          ...SHIPPED_SUBMARINE_POLICIES_CONTRACT.targetWeightsBp,
          UNRESTRICTED: {
            warshipAttackBp: 2_000,
            merchantAttackBp: 7_500,
            neutralIncidentMultiplierBp: 20_000,
          },
        },
      }),
    );
  });

  it("fails closed on a tampered effective-at and null contract", () => {
    expect(() =>
      validateSubmarinePoliciesContract({
        ...SHIPPED_SUBMARINE_POLICIES_CONTRACT,
        policyChangeEffectiveAt: "IMMEDIATELY",
      }),
    ).toThrow(BluewaveError);
    expect(() => validateSubmarinePoliciesContract(null)).toThrow(BluewaveError);
  });
});

function errFor(fn: () => void): void {
  let err: BluewaveError | undefined;
  try {
    fn();
  } catch (e) {
    err = e as BluewaveError;
  }
  expect(err).toBeDefined();
  expect(err!.message).toBe(SUBMARINE_STATE_INVARIANT_FAILED);
}
