import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  SUBMARINE_STATE_INVARIANT_FAILED,
  SUBMARINE_BASIS_POINTS_PER_UNIT,
  SHIPPED_SUBMARINE_POLICIES,
  submarinePolicyById,
  acceptSubmarinePolicyChange,
  SUBMARINE_POLICY_CHANGE_EFFECTIVE_AT,
  SUBMARINE_POLICIES,
  validateSubmarinePolicyDefinition,
  type SubmarinePolicyDefinition,
  withSubmarinePolicyContentHash,
  verifySubmarinePolicyContentHash,
} from "../../src/submarines/index.js";

describe("AC-3: three canonical policies with exact §5 target weights", () => {
  it("ships exactly the three canonical §5 policies with content hash", () => {
    expect([...SUBMARINE_POLICIES]).toEqual(["FLEET_SUPPORT", "PRIZE_RULES", "UNRESTRICTED"]);
    const ids = SHIPPED_SUBMARINE_POLICIES.map((p) => p.policyId).sort();
    expect(ids).toEqual([...SUBMARINE_POLICIES].sort());
    for (const p of SHIPPED_SUBMARINE_POLICIES) {
      expect(() => validateSubmarinePolicyDefinition(p)).not.toThrow();
      expect(p.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(verifySubmarinePolicyContentHash(p)).toBe(true);
    }
  });

  it("FLEET_SUPPORT: warship 8_000, merchant 2_000, neutral 5_000", () => {
    const p = submarinePolicyById("FLEET_SUPPORT");
    expect(p.warshipAttackWeightBp).toBe(8_000);
    expect(p.merchantAttackWeightBp).toBe(2_000);
    expect(p.neutralIncidentMultiplierBp).toBe(5_000);
  });

  it("PRIZE_RULES: warship 5_000, merchant 5_000, neutral 10_000", () => {
    const p = submarinePolicyById("PRIZE_RULES");
    expect(p.warshipAttackWeightBp).toBe(5_000);
    expect(p.merchantAttackWeightBp).toBe(5_000);
    expect(p.neutralIncidentMultiplierBp).toBe(10_000);
  });

  it("UNRESTRICTED: warship 2_500, merchant 7_500, neutral 20_000", () => {
    const p = submarinePolicyById("UNRESTRICTED");
    expect(p.warshipAttackWeightBp).toBe(2_500);
    expect(p.merchantAttackWeightBp).toBe(7_500);
    expect(p.neutralIncidentMultiplierBp).toBe(20_000);
  });
});

describe("AC-3: allocation weights sum to exactly 10_000 per policy", () => {
  it("warship + merchant sums to exactly 10_000 for every policy", () => {
    for (const p of SHIPPED_SUBMARINE_POLICIES) {
      expect(p.warshipAttackWeightBp + p.merchantAttackWeightBp).toBe(
        SUBMARINE_BASIS_POINTS_PER_UNIT,
      );
      expect(p.warshipAttackWeightBp + p.merchantAttackWeightBp).toBe(10_000);
    }
  });

  it("a policy whose warship + merchant weights do not sum to 10_000 fails closed", () => {
    const creator = (
      warshipAttackWeightBp: number,
      merchantAttackWeightBp: number,
    ): SubmarinePolicyDefinition =>
      withSubmarinePolicyContentHash({
        policyId: "PRIZE_RULES",
        warshipAttackWeightBp,
        merchantAttackWeightBp,
        neutralIncidentMultiplierBp: 10_000,
        contentVersion: "submarine_policies_v1",
      });
    for (const [w, m] of [
      [5_001, 5_000],
      [5_000, 5_001],
      [6_000, 3_000],
      [0, 0],
    ] as const) {
      let err: BluewaveError | undefined;
      try {
        validateSubmarinePolicyDefinition(creator(w, m));
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(SUBMARINE_STATE_INVARIANT_FAILED);
      expect(err!.context.field).toBe("allocationWeights");
    }
    let outOfRange: BluewaveError | undefined;
    try {
      validateSubmarinePolicyDefinition(creator(10_001, -1));
    } catch (e) {
      outOfRange = e as BluewaveError;
    }
    expect(outOfRange).toBeDefined();
    expect(outOfRange!.message).toBe(SUBMARINE_STATE_INVARIANT_FAILED);
    expect(outOfRange!.context.field).toBe("warshipAttackWeightBp");
  });
});

describe("AC-3: policy change requires an accepted command, effective next resolution", () => {
  it("defines the effective-at constant as NEXT_TRADE_WARFARE_RESOLUTION", () => {
    expect(SUBMARINE_POLICY_CHANGE_EFFECTIVE_AT).toBe("NEXT_TRADE_WARFARE_RESOLUTION");
  });

  it("accepts a valid change to a different canonical policy at the next resolution", () => {
    const verdict = acceptSubmarinePolicyChange({
      fromPolicyId: "FLEET_SUPPORT",
      toPolicyId: "UNRESTRICTED",
    });
    expect(verdict.accepted).toBe(true);
    if (verdict.accepted) {
      expect(verdict.fromPolicyId).toBe("FLEET_SUPPORT");
      expect(verdict.toPolicyId).toBe("UNRESTRICTED");
      expect(verdict.effectiveAt).toBe("NEXT_TRADE_WARFARE_RESOLUTION");
    }
  });

  it("rejects a change to a non-canonical target policy", () => {
    const verdict = acceptSubmarinePolicyChange({
      fromPolicyId: "FLEET_SUPPORT",
      toPolicyId: "BOGUS" as never,
    });
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) expect(verdict.reason).toContain("canonical");
  });

  it("rejects a no-op change (from === to)", () => {
    const verdict = acceptSubmarinePolicyChange({
      fromPolicyId: "PRIZE_RULES",
      toPolicyId: "PRIZE_RULES",
    });
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) expect(verdict.reason).toContain("no-op");
  });
});

describe("AC-3: fail-closed policy lookup", () => {
  it("submarinePolicyById resolves every shipped policy and rejects an unknown one", () => {
    for (const p of SHIPPED_SUBMARINE_POLICIES) {
      expect(submarinePolicyById(p.policyId).policyId).toBe(p.policyId);
    }
    let err: BluewaveError | undefined;
    try {
      submarinePolicyById("BOGUS");
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(SUBMARINE_STATE_INVARIANT_FAILED);
  });
});
