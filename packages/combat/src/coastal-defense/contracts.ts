import { BluewaveError } from "@bluewave/contracts";
import {
  COASTAL_DEFENSE_BASIS_POINTS_PER_UNIT,
  COASTAL_DEFENSE_FORMULA_VERSION,
  COASTAL_DEFENSE_RULESET_VERSION,
  LAND_TARGET_DAMAGE_STATES,
  LAND_TARGET_TYPES,
  COASTAL_BATTERY_ERA_BANDS,
  COASTAL_DEFENSE_BATTERY_MODELS,
  PER_BATTERY_MINE_PRESSURE_INCREMENT,
  BASE_EFFECTIVENESS_BP,
  MIN_CALIBER_MM,
  MAX_CALIBER_MM,
  coastalBatteryPolicyId,
  landTargetTypePolicyId,
  landTargetDamageStatePolicyId,
} from "./constants.js";
import { COASTAL_DEFENSE_INVARIANT_FAILED } from "./reasonCodes.js";

function guardFailed(constantId: string, detail: string): never {
  throw new BluewaveError(COASTAL_DEFENSE_INVARIANT_FAILED, {
    code: COASTAL_DEFENSE_INVARIANT_FAILED,
    constantId,
    detail,
  });
}

export interface CoastalBatteryContract {
  readonly policyId: string;
  readonly rulesetVersion: string;
  readonly formulaVersion: string;
  readonly basisPointsPerUnit: number;
  readonly perBatteryMinePressureIncrement: number;
  readonly baseEffectivenessBp: number;
  readonly minCaliberMm: number;
  readonly maxCaliberMm: number;
  readonly models: readonly string[];
  readonly eraBands: readonly string[];
}

export const SHIPPED_COASTAL_BATTERY_CONTRACT: CoastalBatteryContract = {
  policyId: coastalBatteryPolicyId,
  rulesetVersion: COASTAL_DEFENSE_RULESET_VERSION,
  formulaVersion: COASTAL_DEFENSE_FORMULA_VERSION,
  basisPointsPerUnit: COASTAL_DEFENSE_BASIS_POINTS_PER_UNIT,
  perBatteryMinePressureIncrement: PER_BATTERY_MINE_PRESSURE_INCREMENT,
  baseEffectivenessBp: BASE_EFFECTIVENESS_BP,
  minCaliberMm: MIN_CALIBER_MM,
  maxCaliberMm: MAX_CALIBER_MM,
  models: [...COASTAL_DEFENSE_BATTERY_MODELS],
  eraBands: [...COASTAL_BATTERY_ERA_BANDS],
};

export function validateCoastalBatteryContract(contract: CoastalBatteryContract): void {
  if (contract.policyId !== coastalBatteryPolicyId) {
    guardFailed("policyId", `expected ${coastalBatteryPolicyId}, got ${contract.policyId}`);
  }
  if (contract.rulesetVersion !== COASTAL_DEFENSE_RULESET_VERSION) {
    guardFailed(
      "rulesetVersion",
      `expected ${COASTAL_DEFENSE_RULESET_VERSION}, got ${contract.rulesetVersion}`,
    );
  }
  if (contract.basisPointsPerUnit !== COASTAL_DEFENSE_BASIS_POINTS_PER_UNIT) {
    guardFailed("basisPointsPerUnit", `expected ${COASTAL_DEFENSE_BASIS_POINTS_PER_UNIT}`);
  }
}

export interface LandTargetTypesContract {
  readonly policyId: string;
  readonly rulesetVersion: string;
  readonly types: readonly string[];
}

export const SHIPPED_LAND_TARGET_TYPES_CONTRACT: LandTargetTypesContract = {
  policyId: landTargetTypePolicyId,
  rulesetVersion: COASTAL_DEFENSE_RULESET_VERSION,
  types: [...LAND_TARGET_TYPES],
};

export function validateLandTargetTypesContract(contract: LandTargetTypesContract): void {
  if (contract.policyId !== landTargetTypePolicyId) {
    guardFailed("policyId", `expected ${landTargetTypePolicyId}, got ${contract.policyId}`);
  }
  if (contract.rulesetVersion !== COASTAL_DEFENSE_RULESET_VERSION) {
    guardFailed("rulesetVersion", `expected ${COASTAL_DEFENSE_RULESET_VERSION}`);
  }
}

export interface LandTargetDamageStatesContract {
  readonly policyId: string;
  readonly rulesetVersion: string;
  readonly states: readonly string[];
}

export const SHIPPED_LAND_TARGET_DAMAGE_STATES_CONTRACT: LandTargetDamageStatesContract = {
  policyId: landTargetDamageStatePolicyId,
  rulesetVersion: COASTAL_DEFENSE_RULESET_VERSION,
  states: [...LAND_TARGET_DAMAGE_STATES],
};

export function validateLandTargetDamageStatesContract(
  contract: LandTargetDamageStatesContract,
): void {
  if (contract.policyId !== landTargetDamageStatePolicyId) {
    guardFailed("policyId", `expected ${landTargetDamageStatePolicyId}, got ${contract.policyId}`);
  }
  if (contract.rulesetVersion !== COASTAL_DEFENSE_RULESET_VERSION) {
    guardFailed("rulesetVersion", `expected ${COASTAL_DEFENSE_RULESET_VERSION}`);
  }
}

export function validateAllCoastalDefenseContracts(): void {
  validateCoastalBatteryContract(SHIPPED_COASTAL_BATTERY_CONTRACT);
  validateLandTargetTypesContract(SHIPPED_LAND_TARGET_TYPES_CONTRACT);
  validateLandTargetDamageStatesContract(SHIPPED_LAND_TARGET_DAMAGE_STATES_CONTRACT);
}
