import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  AUTO_RESOLUTION_MAX_MINUTES,
  battleAutoResolutionPolicyId,
  BATTLE_AUTO_RESOLUTION_RULESET_VERSION,
  GUNNERY_ACCURACY_BASE_BP,
  GUNNERY_BASE_RELOAD_MS,
  SHIPPED_BATTLE_AUTO_RESOLUTION_V1,
  validateBattleAutoResolutionContract,
} from "../../src/battleResolution/constants.js";
import { DEFAULT_MAX_BATTLE_MINUTES } from "../../src/battleEnd.js";

describe("AC-13: battle_auto_resolution_v1 contract + validate guard (fail-closed)", () => {
  it("ships *_v1 policy id and validates", () => {
    expect(battleAutoResolutionPolicyId).toBe("battle_auto_resolution_v1");
    expect(SHIPPED_BATTLE_AUTO_RESOLUTION_V1.policyId).toBe("battle_auto_resolution_v1");
    expect(SHIPPED_BATTLE_AUTO_RESOLUTION_V1.defaultMaxBattleMinutes).toBe(
      DEFAULT_MAX_BATTLE_MINUTES,
    );
    expect(() =>
      validateBattleAutoResolutionContract(SHIPPED_BATTLE_AUTO_RESOLUTION_V1),
    ).not.toThrow();
  });

  it("null contract fails closed", () => {
    expect(() => validateBattleAutoResolutionContract(null)).toThrow(BluewaveError);
    expect(() => validateBattleAutoResolutionContract(undefined)).toThrow(BluewaveError);
  });

  it("drifted constants fail closed", () => {
    expect(() =>
      validateBattleAutoResolutionContract({ ...SHIPPED_BATTLE_AUTO_RESOLUTION_V1, policyId: "x" }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateBattleAutoResolutionContract({
        ...SHIPPED_BATTLE_AUTO_RESOLUTION_V1,
        defaultMaxBattleMinutes: 123,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateBattleAutoResolutionContract({
        ...SHIPPED_BATTLE_AUTO_RESOLUTION_V1,
        baseReloadMs: 1,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateBattleAutoResolutionContract({
        ...SHIPPED_BATTLE_AUTO_RESOLUTION_V1,
        zones: ["BOGUS"],
      }),
    ).toThrow(BluewaveError);
  });

  it("pins the shipped base constants (BALANCE TARGETs recorded in ADR-0026)", () => {
    expect(GUNNERY_BASE_RELOAD_MS).toBe(60_000);
    expect(GUNNERY_ACCURACY_BASE_BP).toBe(4_000);
    expect(AUTO_RESOLUTION_MAX_MINUTES).toBe(DEFAULT_MAX_BATTLE_MINUTES);
    expect(SHIPPED_BATTLE_AUTO_RESOLUTION_V1.rulesetVersion).toBe(
      BATTLE_AUTO_RESOLUTION_RULESET_VERSION,
    );
  });
});
