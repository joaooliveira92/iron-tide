import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  SHIPPED_COASTAL_BATTERY_CONTRACT,
  SHIPPED_LAND_TARGET_TYPES_CONTRACT,
  SHIPPED_LAND_TARGET_DAMAGE_STATES_CONTRACT,
  validateCoastalBatteryContract,
  validateLandTargetTypesContract,
  validateLandTargetDamageStatesContract,
  validateAllCoastalDefenseContracts,
  coastalBatteryPolicyId,
  landTargetTypePolicyId,
  landTargetDamageStatePolicyId,
} from "@bluewave/combat/coastal-defense";

describe("Contracts (INC-1 seed)", () => {
  it("coastal battery contract has correct policy id", () => {
    expect(SHIPPED_COASTAL_BATTERY_CONTRACT.policyId).toBe(coastalBatteryPolicyId);
  });

  it("land target types contract has correct policy id", () => {
    expect(SHIPPED_LAND_TARGET_TYPES_CONTRACT.policyId).toBe(landTargetTypePolicyId);
  });

  it("damage states contract has correct policy id", () => {
    expect(SHIPPED_LAND_TARGET_DAMAGE_STATES_CONTRACT.policyId).toBe(landTargetDamageStatePolicyId);
  });

  it("validateCoastalBatteryContract passes on shipped contract", () => {
    expect(() => validateCoastalBatteryContract(SHIPPED_COASTAL_BATTERY_CONTRACT)).not.toThrow();
  });

  it("validateCoastalBatteryContract rejects tampered policy id", () => {
    expect(() =>
      validateCoastalBatteryContract({ ...SHIPPED_COASTAL_BATTERY_CONTRACT, policyId: "wrong" }),
    ).toThrowError(BluewaveError);
  });

  it("validateLandTargetTypesContract passes on shipped contract", () => {
    expect(() => validateLandTargetTypesContract(SHIPPED_LAND_TARGET_TYPES_CONTRACT)).not.toThrow();
  });

  it("validateLandTargetDamageStatesContract passes on shipped contract", () => {
    expect(() =>
      validateLandTargetDamageStatesContract(SHIPPED_LAND_TARGET_DAMAGE_STATES_CONTRACT),
    ).not.toThrow();
  });

  it("validateAllCoastalDefenseContracts passes", () => {
    expect(() => validateAllCoastalDefenseContracts()).not.toThrow();
  });
});
