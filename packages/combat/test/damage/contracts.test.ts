import { BluewaveError } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  damagePolicyId,
  DAMAGE_RULESET_VERSION,
  DAMAGE_FORMULA_VERSION,
  DAMAGE_PIPELINE_STAGES,
  DAMAGE_CATEGORIES,
  SHIPPED_DAMAGE_CONTRACT,
  validateDamageContract,
  DAMAGE_STATE_INVARIANT_FAILED,
  type DamagePolicyContract,
} from "../../src/damage/index.js";

describe("AC-15: damage_v1 base contract + validate guard (fail closed)", () => {
  it("ships the damage_v1 policy id and SHIPPED_DAMAGE_CONTRACT", () => {
    expect(damagePolicyId).toBe("damage_v1");
    expect(SHIPPED_DAMAGE_CONTRACT.policyId).toBe("damage_v1");
  });

  it("SHIPPED_DAMAGE_CONTRACT ships the base segments", () => {
    expect(SHIPPED_DAMAGE_CONTRACT.rulesetVersion).toBe(DAMAGE_RULESET_VERSION);
    expect(SHIPPED_DAMAGE_CONTRACT.formulaVersion).toBe(DAMAGE_FORMULA_VERSION);
    expect([...SHIPPED_DAMAGE_CONTRACT.pipelineStages]).toEqual([...DAMAGE_PIPELINE_STAGES]);
    expect([...SHIPPED_DAMAGE_CONTRACT.damageCategories]).toEqual([...DAMAGE_CATEGORIES]);
  });

  it("validates the shipped contract without throwing", () => {
    expect(() => validateDamageContract(SHIPPED_DAMAGE_CONTRACT)).not.toThrow();
  });

  it("fails closed on a mismatched policy id", () => {
    let err: BluewaveError | undefined;
    try {
      validateDamageContract({ ...SHIPPED_DAMAGE_CONTRACT, policyId: "damage_v2" });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.code).toBe(DAMAGE_STATE_INVARIANT_FAILED);
  });

  it("fails closed on a tampered ruleset version", () => {
    expect(() =>
      validateDamageContract({ ...SHIPPED_DAMAGE_CONTRACT, rulesetVersion: "damage_ruleset_v2" }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered formula version", () => {
    expect(() =>
      validateDamageContract({ ...SHIPPED_DAMAGE_CONTRACT, formulaVersion: "damage_formula_v2" }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered pipelineStages set", () => {
    expect(() =>
      validateDamageContract({
        ...SHIPPED_DAMAGE_CONTRACT,
        pipelineStages: [...DAMAGE_PIPELINE_STAGES].reverse(),
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered damage category set", () => {
    expect(() =>
      validateDamageContract({
        ...SHIPPED_DAMAGE_CONTRACT,
        damageCategories: [...DAMAGE_CATEGORIES].slice(0, 3),
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a null/missing contract", () => {
    expect(() => validateDamageContract(null)).toThrow(BluewaveError);
    expect(() => validateDamageContract(undefined)).toThrow(BluewaveError);
  });

  it("ships the canonical terminal statuses in the contract", () => {
    expect([...(SHIPPED_DAMAGE_CONTRACT as DamagePolicyContract).terminalStatuses]).toEqual([
      "NORMAL",
      "SINKING",
      "FOUNDERED",
    ]);
  });
});
