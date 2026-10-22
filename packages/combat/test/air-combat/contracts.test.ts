import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { Result, Schema } from "effect";
import {
  AirCombatPolicy_v1,
  validateAirCombatContract,
  validateAllAirCombatContracts,
} from "@bluewave/combat/air-combat";
import {
  AIR_COMBAT_BASIS_POINTS,
  AIR_COMBAT_EXCHANGE_FACTOR_KEYS,
  AIR_COMBAT_RULESET_VERSION,
  AIR_COMBAT_FORMULA_VERSION,
  AIR_COMBAT_DISRUPTION_MIN_BP,
  AIR_COMBAT_ALTITUDE_NEUTRAL_BP,
  AIR_COMBAT_ALTITUDE_ADVANTAGE_BP,
  AIR_COMBAT_ALTITUDE_DISADVANTAGE_BP,
  AIR_COMBAT_SURPRISE_FIRST_PASS_BP,
  AIR_COMBAT_SURPRISE_SUBSEQUENT_BP,
  AIR_COMBAT_NUMERICAL_MIN_BP,
  AIR_COMBAT_DESTROYED_DAMAGE_RATIO_BP,
} from "@bluewave/combat/air-combat";

function parses(schema: Schema.ConstraintDecoder<unknown, never>, value: unknown): boolean {
  return Result.isSuccess(Schema.decodeUnknownResult(schema)(value));
}

function makeValidPolicy() {
  return {
    rulesetVersion: AIR_COMBAT_RULESET_VERSION,
    formulaVersion: AIR_COMBAT_FORMULA_VERSION,
    basisPoints: AIR_COMBAT_BASIS_POINTS,
    factorKeys: [...AIR_COMBAT_EXCHANGE_FACTOR_KEYS],
    disruptionMinBp: AIR_COMBAT_DISRUPTION_MIN_BP,
    altitudeNeutralBp: AIR_COMBAT_ALTITUDE_NEUTRAL_BP,
    altitudeAdvantageBp: AIR_COMBAT_ALTITUDE_ADVANTAGE_BP,
    altitudeDisadvantageBp: AIR_COMBAT_ALTITUDE_DISADVANTAGE_BP,
    surpriseFirstPassBp: AIR_COMBAT_SURPRISE_FIRST_PASS_BP,
    surpriseSubsequentBp: AIR_COMBAT_SURPRISE_SUBSEQUENT_BP,
    numericalMinBp: AIR_COMBAT_NUMERICAL_MIN_BP,
    destroyedDamageRatioBp: AIR_COMBAT_DESTROYED_DAMAGE_RATIO_BP,
  };
}

describe("AC-20: air_combat_v1 contract", () => {
  it("validates a correct policy object", () => {
    expect(parses(AirCombatPolicy_v1, makeValidPolicy())).toBe(true);
  });

  it("rejects wrong rulesetVersion", () => {
    expect(
      parses(AirCombatPolicy_v1, {
        ...makeValidPolicy(),
        rulesetVersion: "wrong-version",
      }),
    ).toBe(false);
  });

  it("rejects wrong basisPoints", () => {
    expect(
      parses(AirCombatPolicy_v1, {
        ...makeValidPolicy(),
        basisPoints: 100,
      }),
    ).toBe(false);
  });

  it("rejects missing factor key", () => {
    expect(
      parses(AirCombatPolicy_v1, {
        ...makeValidPolicy(),
        factorKeys: ["quality", "numericalAdvantage", "altitude", "surprise", "defenderSurvival"],
      }),
    ).toBe(false);
  });

  it("rejects extra factors", () => {
    expect(
      parses(AirCombatPolicy_v1, {
        ...makeValidPolicy(),
        factorKeys: [...AIR_COMBAT_EXCHANGE_FACTOR_KEYS, "extra"],
      }),
    ).toBe(false);
  });

  it("validateAirCombatContract passes on valid input", () => {
    const result = validateAirCombatContract(makeValidPolicy());
    expect(result.rulesetVersion).toBe(AIR_COMBAT_RULESET_VERSION);
    expect(result.factorKeys).toEqual([...AIR_COMBAT_EXCHANGE_FACTOR_KEYS]);
  });

  it("validateAirCombatContract throws BluewaveError on invalid input", () => {
    expect(() => validateAirCombatContract({})).toThrow(BluewaveError);
  });

  it("validateAllAirCombatContracts passes (calls all registered validators)", () => {
    expect(() => validateAllAirCombatContracts()).not.toThrow();
  });
});
