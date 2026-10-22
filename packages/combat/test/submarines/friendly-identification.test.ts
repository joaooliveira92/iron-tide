import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  submarineFriendlyIdentificationPolicyId,
  SHIPPED_SUBMARINE_FRIENDLY_IDENTIFICATION_CONTRACT,
  validateSubmarineFriendlyIdentificationContract,
  computeMisidentificationProbability,
  SUBMARINE_FRIENDLY_IDENTIFICATION_BASE_BP,
} from "@bluewave/combat/submarines";

describe("AC-16: friendly identification (§23)", () => {
  it("base probability is 500 bp", () => {
    expect(SUBMARINE_FRIENDLY_IDENTIFICATION_BASE_BP).toBe(500);
  });

  it("all-zero modifiers: base only = 500", () => {
    const result = computeMisidentificationProbability({
      baseProbabilityBp: SafeInt(500),
      visibilityModifierBp: SafeInt(0),
      communicationModifierBp: SafeInt(0),
      doctrineModifierBp: SafeInt(0),
      fatigueModifierBp: SafeInt(0),
      identificationQualityBp: SafeInt(0),
    });
    expect(result).toBe(500);
  });

  it("clamps to min 0 when modifiers produce negative", () => {
    const result = computeMisidentificationProbability({
      baseProbabilityBp: SafeInt(200),
      visibilityModifierBp: SafeInt(0),
      communicationModifierBp: SafeInt(0),
      doctrineModifierBp: SafeInt(0),
      fatigueModifierBp: SafeInt(0),
      identificationQualityBp: SafeInt(10_000),
    });
    expect(result).toBe(0);
  });

  it("clamps to max 10_000 when sum exceeds", () => {
    const result = computeMisidentificationProbability({
      baseProbabilityBp: SafeInt(500),
      visibilityModifierBp: SafeInt(9_000),
      communicationModifierBp: SafeInt(1_000),
      doctrineModifierBp: SafeInt(500),
      fatigueModifierBp: SafeInt(500),
      identificationQualityBp: SafeInt(0),
    });
    expect(result).toBe(10_000);
  });

  it("applies modifiers correctly: 500 + 2000 - 1000 = 1500", () => {
    const result = computeMisidentificationProbability({
      baseProbabilityBp: SafeInt(500),
      visibilityModifierBp: SafeInt(1_000),
      communicationModifierBp: SafeInt(500),
      doctrineModifierBp: SafeInt(500),
      fatigueModifierBp: SafeInt(0),
      identificationQualityBp: SafeInt(1_000),
    });
    expect(result).toBe(1_500);
  });

  it("uses default base of 500 when not provided", () => {
    const result = computeMisidentificationProbability({
      visibilityModifierBp: SafeInt(0),
      communicationModifierBp: SafeInt(0),
      doctrineModifierBp: SafeInt(0),
      fatigueModifierBp: SafeInt(0),
      identificationQualityBp: SafeInt(0),
    });
    expect(result).toBe(500);
  });

  it("fails closed on out-of-range visibilityModifierBp", () => {
    expect(() =>
      computeMisidentificationProbability({
        visibilityModifierBp: SafeInt(25_000),
        communicationModifierBp: SafeInt(0),
        doctrineModifierBp: SafeInt(0),
        fatigueModifierBp: SafeInt(0),
        identificationQualityBp: SafeInt(0),
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on negative identificationQualityBp", () => {
    expect(() =>
      computeMisidentificationProbability({
        visibilityModifierBp: SafeInt(0),
        communicationModifierBp: SafeInt(0),
        doctrineModifierBp: SafeInt(0),
        fatigueModifierBp: SafeInt(0),
        identificationQualityBp: SafeInt(-1),
      }),
    ).toThrow(BluewaveError);
  });
});

describe("submarine_friendly_identification_v1 contract (AC-21)", () => {
  it("shipped contract matches expected values", () => {
    expect(SHIPPED_SUBMARINE_FRIENDLY_IDENTIFICATION_CONTRACT.policyId).toBe(
      submarineFriendlyIdentificationPolicyId,
    );
    expect(SHIPPED_SUBMARINE_FRIENDLY_IDENTIFICATION_CONTRACT.baseProbabilityBp).toBe(500);
    expect(SHIPPED_SUBMARINE_FRIENDLY_IDENTIFICATION_CONTRACT.clampMinBp).toBe(0);
    expect(SHIPPED_SUBMARINE_FRIENDLY_IDENTIFICATION_CONTRACT.clampMaxBp).toBe(10_000);
  });

  it("validate passes for the shipped contract", () => {
    expect(() =>
      validateSubmarineFriendlyIdentificationContract(
        SHIPPED_SUBMARINE_FRIENDLY_IDENTIFICATION_CONTRACT,
      ),
    ).not.toThrow();
  });

  it("validate fails on missing contract", () => {
    expect(() => validateSubmarineFriendlyIdentificationContract(null)).toThrow(BluewaveError);
  });

  it("validate fails on tampered base probability", () => {
    expect(() =>
      validateSubmarineFriendlyIdentificationContract({
        ...SHIPPED_SUBMARINE_FRIENDLY_IDENTIFICATION_CONTRACT,
        baseProbabilityBp: 600,
      }),
    ).toThrow(BluewaveError);
  });
});
