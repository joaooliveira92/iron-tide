//packages/combat/src/smoke/contracts.ts
import { BluewaveError } from "@bluewave/contracts";
import {
  smokePolicyId,
  SMOKE_RULESET_VERSION,
  SMOKE_FORMULA_VERSION,
  SMOKE_SOURCE_TYPES,
  WIND_RETENTION_LT_5_BP,
  WIND_RETENTION_5_TO_15_BP,
  WIND_RETENTION_15_TO_25_BP,
  WIND_RETENTION_GE_25_BP,
  FUNNEL_FUEL_MULTIPLIERS,
  FUNNEL_POWER_MULTIPLIERS,
  SMOKE_REFERENCE_PATH_LENGTH,
  SMOKE_OPTICAL_NUMERATOR,
  SMOKE_OPTICAL_DENOMINATOR,
  SMOKE_OPTICAL_MIN,
  FUNNEL_SMOKE_BASE_DENSITY,
  SMOKESCREEN_INITIAL_DENSITY,
  SMOKESCREEN_REFERENCE_WIDTH_M,
  SMOKESCREEN_VERTICAL_EXTENT_M,
  SMOKESCREEN_GENERATION_DURATION_MINUTES,
  SMOKESCREEN_COOLDOWN_MINUTES,
  SMOKE_FLOAT_CAPACITY,
  SMOKE_FLOAT_INITIAL_DENSITY,
  SMOKE_FLOAT_REFERENCE_WIDTH_M,
  SMOKE_FLOAT_EMISSION_DURATION_MINUTES,
  SMOKE_FLOAT_MAX_DEPLOYMENT_SPEED_KT,
  SMOKE_GENERATOR_DURATION_MINUTES,
  SMOKE_GENERATOR_COOLDOWN_MINUTES,
  SMOKE_GENERATOR_CHARGES,
  SMOKE_GENERATOR_INITIAL_DENSITY,
  SMOKE_GENERATOR_REFERENCE_WIDTH_M,
  SMOKE_DOCTRINE_ADOPTION_MONTHS,
} from "./constants.js";
import { WEATHER_SMOKE_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

function guardFailed(constantId: string, detail: string): never {
  throw new BluewaveError(WEATHER_SMOKE_STATE_INVARIANT_FAILED, {
    code: WEATHER_SMOKE_STATE_INVARIANT_FAILED,
    constantId,
    detail,
  });
}

export interface SmokeCloudContract {
  readonly policyId: string;
  readonly rulesetVersion: string;
  readonly formulaVersion: string;
  readonly sourceTypes: readonly string[];
}

export const SHIPPED_SMOKE_CLOUD_CONTRACT: SmokeCloudContract = {
  policyId: smokePolicyId,
  rulesetVersion: SMOKE_RULESET_VERSION,
  formulaVersion: SMOKE_FORMULA_VERSION,
  sourceTypes: [...SMOKE_SOURCE_TYPES],
};

export function validateSmokeCloudContract(contract: SmokeCloudContract): void {
  if (contract.policyId !== smokePolicyId) {
    guardFailed("policyId", `expected ${smokePolicyId}, got ${contract.policyId}`);
  }
  if (contract.rulesetVersion !== SMOKE_RULESET_VERSION) {
    guardFailed(
      "rulesetVersion",
      `expected ${SMOKE_RULESET_VERSION}, got ${contract.rulesetVersion}`,
    );
  }
  if (contract.formulaVersion !== SMOKE_FORMULA_VERSION) {
    guardFailed(
      "formulaVersion",
      `expected ${SMOKE_FORMULA_VERSION}, got ${contract.formulaVersion}`,
    );
  }
  if (!contract.sourceTypes || contract.sourceTypes.length !== SMOKE_SOURCE_TYPES.length) {
    guardFailed(
      "sourceTypes",
      `expected ${SMOKE_SOURCE_TYPES.length} source types, got ${contract.sourceTypes?.length}`,
    );
  }
}

export interface FunnelSmokeProfileContract {
  readonly policyId: string;
  readonly rulesetVersion: string;
  readonly formulaVersion: string;
  readonly baseDensityBp: number;
  readonly fuelMultipliers: Record<string, number>;
  readonly powerMultipliers: readonly {
    readonly minBp: number;
    readonly maxBp: number;
    readonly multiplier: number;
  }[];
}

export const SHIPPED_FUNNEL_SMOKE_PROFILE_CONTRACT: FunnelSmokeProfileContract = {
  policyId: smokePolicyId,
  rulesetVersion: SMOKE_RULESET_VERSION,
  formulaVersion: SMOKE_FORMULA_VERSION,
  baseDensityBp: FUNNEL_SMOKE_BASE_DENSITY,
  fuelMultipliers: { ...FUNNEL_FUEL_MULTIPLIERS },
  powerMultipliers: [...FUNNEL_POWER_MULTIPLIERS],
};

export function validateFunnelSmokeProfileContract(contract: FunnelSmokeProfileContract): void {
  if (contract.policyId !== smokePolicyId) {
    guardFailed("policyId", `expected ${smokePolicyId}, got ${contract.policyId}`);
  }
  if (contract.rulesetVersion !== SMOKE_RULESET_VERSION) {
    guardFailed(
      "rulesetVersion",
      `expected ${SMOKE_RULESET_VERSION}, got ${contract.rulesetVersion}`,
    );
  }
  if (contract.baseDensityBp !== FUNNEL_SMOKE_BASE_DENSITY) {
    guardFailed(
      "baseDensityBp",
      `expected ${FUNNEL_SMOKE_BASE_DENSITY}, got ${contract.baseDensityBp}`,
    );
  }
}

export interface SmokeConstantsContract {
  readonly policyId: string;
  readonly rulesetVersion: string;
  readonly formulaVersion: string;
  readonly windRetentionLt5Bp: number;
  readonly windRetention5to15Bp: number;
  readonly windRetention15to25Bp: number;
  readonly windRetentionGe25Bp: number;
  readonly referencePathLength: number;
  readonly opticalNumerator: number;
  readonly opticalDenominator: number;
  readonly opticalMin: number;
  readonly funnelBaseDensity: number;
  readonly smokescreenInitialDensity: number;
  readonly smokescreenReferenceWidthM: number;
  readonly smokescreenVerticalExtentM: number;
  readonly smokescreenGenerationDurationMinutes: number;
  readonly smokescreenCooldownMinutes: number;
  readonly floatCapacity: number;
  readonly floatInitialDensity: number;
  readonly floatReferenceWidthM: number;
  readonly floatEmissionDurationMinutes: number;
  readonly floatMaxDeploymentSpeedKt: number;
  readonly generatorDurationMinutes: number;
  readonly generatorCooldownMinutes: number;
  readonly generatorCharges: number;
  readonly generatorInitialDensity: number;
  readonly generatorReferenceWidthM: number;
  readonly doctrineAdoptionMonths: number;
}

export const SHIPPED_SMOKE_CONSTANTS_CONTRACT: SmokeConstantsContract = {
  policyId: smokePolicyId,
  rulesetVersion: SMOKE_RULESET_VERSION,
  formulaVersion: SMOKE_FORMULA_VERSION,
  windRetentionLt5Bp: WIND_RETENTION_LT_5_BP,
  windRetention5to15Bp: WIND_RETENTION_5_TO_15_BP,
  windRetention15to25Bp: WIND_RETENTION_15_TO_25_BP,
  windRetentionGe25Bp: WIND_RETENTION_GE_25_BP,
  referencePathLength: SMOKE_REFERENCE_PATH_LENGTH,
  opticalNumerator: SMOKE_OPTICAL_NUMERATOR,
  opticalDenominator: SMOKE_OPTICAL_DENOMINATOR,
  opticalMin: SMOKE_OPTICAL_MIN,
  funnelBaseDensity: FUNNEL_SMOKE_BASE_DENSITY,
  smokescreenInitialDensity: SMOKESCREEN_INITIAL_DENSITY,
  smokescreenReferenceWidthM: SMOKESCREEN_REFERENCE_WIDTH_M,
  smokescreenVerticalExtentM: SMOKESCREEN_VERTICAL_EXTENT_M,
  smokescreenGenerationDurationMinutes: SMOKESCREEN_GENERATION_DURATION_MINUTES,
  smokescreenCooldownMinutes: SMOKESCREEN_COOLDOWN_MINUTES,
  floatCapacity: SMOKE_FLOAT_CAPACITY,
  floatInitialDensity: SMOKE_FLOAT_INITIAL_DENSITY,
  floatReferenceWidthM: SMOKE_FLOAT_REFERENCE_WIDTH_M,
  floatEmissionDurationMinutes: SMOKE_FLOAT_EMISSION_DURATION_MINUTES,
  floatMaxDeploymentSpeedKt: SMOKE_FLOAT_MAX_DEPLOYMENT_SPEED_KT,
  generatorDurationMinutes: SMOKE_GENERATOR_DURATION_MINUTES,
  generatorCooldownMinutes: SMOKE_GENERATOR_COOLDOWN_MINUTES,
  generatorCharges: SMOKE_GENERATOR_CHARGES,
  generatorInitialDensity: SMOKE_GENERATOR_INITIAL_DENSITY,
  generatorReferenceWidthM: SMOKE_GENERATOR_REFERENCE_WIDTH_M,
  doctrineAdoptionMonths: SMOKE_DOCTRINE_ADOPTION_MONTHS,
};

export function validateSmokeConstantsContract(contract: SmokeConstantsContract): void {
  if (contract.policyId !== smokePolicyId) {
    guardFailed("policyId", `expected ${smokePolicyId}, got ${contract.policyId}`);
  }
  if (contract.rulesetVersion !== SMOKE_RULESET_VERSION) {
    guardFailed("rulesetVersion", `expected ${SMOKE_RULESET_VERSION}`);
  }
}

export function validateAllSmokeContracts(): void {
  validateSmokeCloudContract(SHIPPED_SMOKE_CLOUD_CONTRACT);
  validateFunnelSmokeProfileContract(SHIPPED_FUNNEL_SMOKE_PROFILE_CONTRACT);
  validateSmokeConstantsContract(SHIPPED_SMOKE_CONSTANTS_CONTRACT);
}
