import { BluewaveError } from "@bluewave/contracts";
import {
  SUBMARINE_BASIS_POINTS_PER_UNIT,
  SUBMARINE_FORMULA_VERSION,
  SUBMARINE_RULESET_VERSION,
  submarineEffectivenessPolicyId,
  submarineFriendlyIdentificationPolicyId,
  submarineMineLayingPolicyId,
  submarineScreeningBalancePolicyId,
  submarineSeaStatePolicyId,
  SUBMARINE_SEA_STATE_CATEGORIES,
} from "../constants.js";
import { SUBMARINE_STATE_INVARIANT_FAILED } from "../reasonCodes.js";
import {
  SUBMARINE_BASE_SUPPORT_MULTIPLIER_BP,
  SUBMARINE_POLICY_MULTIPLIER_BP,
  SUBMARINE_INTELLIGENCE_MULTIPLIER_BP,
  SUBMARINE_ENEMY_PROTECTION_MULTIPLIER_BP,
  SUBMARINE_BLOCKADE_MULTIPLIER_BP,
} from "../effectiveness.js";
import {
  SHIPPED_SEA_STATE_DETECTION_TABLE_BP,
  SHIPPED_SEA_STATE_OBSERVATION_TABLE_BP,
  SHIPPED_SEA_STATE_ATTACK_TABLE_BP,
  SUBMARINE_SNORKEL_MACHINERY_MULTIPLIER_BP,
  SUBMARINE_SURFACED_TRANSIT_SPEED_BP,
  SUBMARINE_SURFACED_DETECTION_ADDITION_BP,
  SUBMARINE_SEA_STATE_MIN,
  SUBMARINE_SEA_STATE_MAX,
  SUBMARINE_SEA_STATE_OPTIMUM_MIN,
  SUBMARINE_SEA_STATE_OPTIMUM_MAX,
} from "../seaStateProfile.js";
import {
  SUBMARINE_HEAVY_SHIP_TYPES,
  SUBMARINE_ELIGIBLE_ESCORT_TYPES,
  SHIPPED_SCREENING_OPPORTUNITY_BANDS,
} from "../screeningBalance.js";
import {
  SUBMARINE_MINE_LAYING_RELIABILITY_FLOOR,
  SUBMARINE_MINE_LAYING_READINESS_FLOOR,
  SUBMARINE_MINE_LAYING_FUEL_FLOOR_BP,
} from "../mineLaying.js";
import {
  SUBMARINE_FRIENDLY_IDENTIFICATION_BASE_BP,
  SUBMARINE_FRIENDLY_IDENTIFICATION_MIN_BP,
  SUBMARINE_FRIENDLY_IDENTIFICATION_MAX_BP,
} from "../friendlyIdentification.js";
import { arrayEquals } from "./shared.js";

export interface SubmarineEffectivenessContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  denominator: number;
  baseSupportMultiplierBp: number;
  policyMultiplierBp: number;
  intelligenceMultiplierBp: number;
  enemyProtectionMultiplierBp: number;
  blockadeMultiplierBp: number;
}

export const SHIPPED_SUBMARINE_EFFECTIVENESS_CONTRACT: SubmarineEffectivenessContract = {
  policyId: submarineEffectivenessPolicyId,
  rulesetVersion: SUBMARINE_RULESET_VERSION,
  formulaVersion: SUBMARINE_FORMULA_VERSION,
  basisPointsPerUnit: SUBMARINE_BASIS_POINTS_PER_UNIT,
  denominator: 10_000 ** 7,
  baseSupportMultiplierBp: SUBMARINE_BASE_SUPPORT_MULTIPLIER_BP,
  policyMultiplierBp: SUBMARINE_POLICY_MULTIPLIER_BP,
  intelligenceMultiplierBp: SUBMARINE_INTELLIGENCE_MULTIPLIER_BP,
  enemyProtectionMultiplierBp: SUBMARINE_ENEMY_PROTECTION_MULTIPLIER_BP,
  blockadeMultiplierBp: SUBMARINE_BLOCKADE_MULTIPLIER_BP,
};

export function validateSubmarineEffectivenessContract(
  c: Partial<SubmarineEffectivenessContract> | null | undefined,
): asserts c is SubmarineEffectivenessContract {
  function mismatch(contract: unknown, reason: string): never {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason,
      contract,
    });
  }
  if (!c) mismatch(c, "submarine_effectiveness_v1 missing contract");
  if (c.policyId !== submarineEffectivenessPolicyId)
    mismatch(c, "submarine_effectiveness_v1 expected policy id");
  if (
    c.rulesetVersion !== SUBMARINE_RULESET_VERSION ||
    c.formulaVersion !== SUBMARINE_FORMULA_VERSION
  )
    mismatch(c, "submarine_effectiveness_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    mismatch(c, "submarine_effectiveness_v1 basis-point scale");
  if (c.denominator !== 10_000 ** 7)
    mismatch(c, "submarine_effectiveness_v1 §11 denominator 10_000^7");
  if (c.baseSupportMultiplierBp !== SUBMARINE_BASE_SUPPORT_MULTIPLIER_BP)
    mismatch(c, "submarine_effectiveness_v1 §11 base-support multiplier");
  if (c.policyMultiplierBp !== SUBMARINE_POLICY_MULTIPLIER_BP)
    mismatch(c, "submarine_effectiveness_v1 §11 policy multiplier");
  if (c.intelligenceMultiplierBp !== SUBMARINE_INTELLIGENCE_MULTIPLIER_BP)
    mismatch(c, "submarine_effectiveness_v1 §11 intelligence multiplier");
  if (c.enemyProtectionMultiplierBp !== SUBMARINE_ENEMY_PROTECTION_MULTIPLIER_BP)
    mismatch(c, "submarine_effectiveness_v1 §11 enemy-protection multiplier");
  if (c.blockadeMultiplierBp !== SUBMARINE_BLOCKADE_MULTIPLIER_BP)
    mismatch(c, "submarine_effectiveness_v1 §11 blockade multiplier");
  void c;
}

export interface SubmarineSeaStateContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  seaStateRangeMin: number;
  seaStateRangeMax: number;
  optimumBandMin: number;
  optimumBandMax: number;
  categories: readonly string[];
  detectionTableBp: Record<string, number>;
  observationTableBp: Record<string, number>;
  attackTableBp: Record<string, number>;
  surfacedDetectionAdditionBp: number;
  snorkelMachineryMultiplierBp: number;
  surfacedTransitSpeedBp: number;
}

export const SHIPPED_SUBMARINE_SEA_STATE_CONTRACT: SubmarineSeaStateContract = {
  policyId: submarineSeaStatePolicyId,
  rulesetVersion: SUBMARINE_RULESET_VERSION,
  formulaVersion: SUBMARINE_FORMULA_VERSION,
  basisPointsPerUnit: SUBMARINE_BASIS_POINTS_PER_UNIT,
  seaStateRangeMin: SUBMARINE_SEA_STATE_MIN,
  seaStateRangeMax: SUBMARINE_SEA_STATE_MAX,
  optimumBandMin: SUBMARINE_SEA_STATE_OPTIMUM_MIN,
  optimumBandMax: SUBMARINE_SEA_STATE_OPTIMUM_MAX,
  categories: SUBMARINE_SEA_STATE_CATEGORIES,
  detectionTableBp: { ...SHIPPED_SEA_STATE_DETECTION_TABLE_BP },
  observationTableBp: { ...SHIPPED_SEA_STATE_OBSERVATION_TABLE_BP },
  attackTableBp: { ...SHIPPED_SEA_STATE_ATTACK_TABLE_BP },
  surfacedDetectionAdditionBp: SUBMARINE_SURFACED_DETECTION_ADDITION_BP,
  snorkelMachineryMultiplierBp: SUBMARINE_SNORKEL_MACHINERY_MULTIPLIER_BP,
  surfacedTransitSpeedBp: SUBMARINE_SURFACED_TRANSIT_SPEED_BP,
};

export function validateSubmarineSeaStateContract(
  c: Partial<SubmarineSeaStateContract> | null | undefined,
): asserts c is SubmarineSeaStateContract {
  function mismatch(contract: unknown, reason: string): never {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason,
      contract,
    });
  }
  if (!c) mismatch(c, "submarine_sea_state_v1 missing contract");
  if (c.policyId !== submarineSeaStatePolicyId)
    mismatch(c, "submarine_sea_state_v1 expected policy id");
  if (
    c.rulesetVersion !== SUBMARINE_RULESET_VERSION ||
    c.formulaVersion !== SUBMARINE_FORMULA_VERSION
  )
    mismatch(c, "submarine_sea_state_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    mismatch(c, "submarine_sea_state_v1 basis-point scale");
  if (c.seaStateRangeMin !== SUBMARINE_SEA_STATE_MIN)
    mismatch(c, "submarine_sea_state_v1 §13 range min 0");
  if (c.seaStateRangeMax !== SUBMARINE_SEA_STATE_MAX)
    mismatch(c, "submarine_sea_state_v1 §13 range max 9");
  if (c.optimumBandMin !== SUBMARINE_SEA_STATE_OPTIMUM_MIN)
    mismatch(c, "submarine_sea_state_v1 §13 optimum band min 2");
  if (c.optimumBandMax !== SUBMARINE_SEA_STATE_OPTIMUM_MAX)
    mismatch(c, "submarine_sea_state_v1 §13 optimum band max 5");
  if (!c.categories || c.categories.length !== 4)
    mismatch(c, "submarine_sea_state_v1 §13 four categories");
  const expectedCategories = ["CALM", "OPTIMAL", "HEAVY", "SEVERE"];
  for (let i = 0; i < expectedCategories.length; i++) {
    if (c.categories[i] !== expectedCategories[i])
      mismatch(c, `submarine_sea_state_v1 §13 category at index ${i}`);
  }
  if (!c.detectionTableBp || Object.keys(c.detectionTableBp).length !== 10)
    mismatch(c, "submarine_sea_state_v1 §14 detection table must have 10 entries");
  for (let ss = 0; ss <= 9; ss++) {
    const k = String(ss);
    if (c.detectionTableBp[k] !== SHIPPED_SEA_STATE_DETECTION_TABLE_BP[ss])
      mismatch(c, `submarine_sea_state_v1 §14 detection multiplier for sea state ${ss}`);
  }
  if (!c.observationTableBp || Object.keys(c.observationTableBp).length !== 10)
    mismatch(c, "submarine_sea_state_v1 §15 observation table must have 10 entries");
  for (let ss = 0; ss <= 9; ss++) {
    const k = String(ss);
    if (c.observationTableBp[k] !== SHIPPED_SEA_STATE_OBSERVATION_TABLE_BP[ss])
      mismatch(c, `submarine_sea_state_v1 §15 observation multiplier for sea state ${ss}`);
  }
  if (!c.attackTableBp || Object.keys(c.attackTableBp).length !== 10)
    mismatch(c, "submarine_sea_state_v1 §16 attack table must have 10 entries");
  for (let ss = 0; ss <= 9; ss++) {
    const k = String(ss);
    if (c.attackTableBp[k] !== SHIPPED_SEA_STATE_ATTACK_TABLE_BP[ss])
      mismatch(c, `submarine_sea_state_v1 §16 attack multiplier for sea state ${ss}`);
  }
  if (c.surfacedDetectionAdditionBp !== SUBMARINE_SURFACED_DETECTION_ADDITION_BP)
    mismatch(c, "submarine_sea_state_v1 §17 surfaced detection addition 12_500");
  if (c.snorkelMachineryMultiplierBp !== SUBMARINE_SNORKEL_MACHINERY_MULTIPLIER_BP)
    mismatch(c, "submarine_sea_state_v1 §17 snorkel machinery multiplier 7_500");
  if (c.surfacedTransitSpeedBp !== SUBMARINE_SURFACED_TRANSIT_SPEED_BP)
    mismatch(c, "submarine_sea_state_v1 §17 surfaced transit speed 7_500");
  void c;
}

export interface SubmarineScreeningBalanceContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  heavyShipTypes: readonly string[];
  eligibleEscortTypes: readonly string[];
  opportunityBands: ReadonlyArray<{ minRatio: number; maxRatio: number; multiplierBp: number }>;
}

export const SHIPPED_SUBMARINE_SCREENING_BALANCE_CONTRACT: SubmarineScreeningBalanceContract = {
  policyId: submarineScreeningBalancePolicyId,
  rulesetVersion: SUBMARINE_RULESET_VERSION,
  formulaVersion: SUBMARINE_FORMULA_VERSION,
  basisPointsPerUnit: SUBMARINE_BASIS_POINTS_PER_UNIT,
  heavyShipTypes: SUBMARINE_HEAVY_SHIP_TYPES,
  eligibleEscortTypes: SUBMARINE_ELIGIBLE_ESCORT_TYPES,
  opportunityBands: SHIPPED_SCREENING_OPPORTUNITY_BANDS,
};

export function validateSubmarineScreeningBalanceContract(
  c: Partial<SubmarineScreeningBalanceContract> | null | undefined,
): asserts c is SubmarineScreeningBalanceContract {
  function mismatch(contract: unknown, reason: string): never {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason,
      contract,
    });
  }
  if (!c) mismatch(c, "submarine_screening_balance_v1 missing contract");
  if (c.policyId !== submarineScreeningBalancePolicyId)
    mismatch(c, "submarine_screening_balance_v1 expected policy id");
  if (
    c.rulesetVersion !== SUBMARINE_RULESET_VERSION ||
    c.formulaVersion !== SUBMARINE_FORMULA_VERSION
  )
    mismatch(c, "submarine_screening_balance_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    mismatch(c, "submarine_screening_balance_v1 basis-point scale");
  if (!c.heavyShipTypes || !arrayEquals(c.heavyShipTypes, SUBMARINE_HEAVY_SHIP_TYPES))
    mismatch(c, "submarine_screening_balance_v1 §18 heavy ship types");
  if (
    !c.eligibleEscortTypes ||
    !arrayEquals(c.eligibleEscortTypes, SUBMARINE_ELIGIBLE_ESCORT_TYPES)
  )
    mismatch(c, "submarine_screening_balance_v1 §18 eligible escort types");
  if (!c.opportunityBands || c.opportunityBands.length !== 5)
    mismatch(c, "submarine_screening_balance_v1 §18 five opportunity bands");
  for (let i = 0; i < SHIPPED_SCREENING_OPPORTUNITY_BANDS.length; i++) {
    const s = SHIPPED_SCREENING_OPPORTUNITY_BANDS[i];
    const t = c.opportunityBands[i];
    if (!s || !t) mismatch(c, `submarine_screening_balance_v1 band missing at index ${i}`);
    if (t.minRatio !== s.minRatio || t.maxRatio !== s.maxRatio || t.multiplierBp !== s.multiplierBp)
      mismatch(c, `submarine_screening_balance_v1 §18 band at index ${i}`);
  }
  void c;
}

export interface SubmarineMineLayingContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  reliabilityFloor: number;
  readinessFloor: number;
  fuelFloorBp: number;
}

export const SHIPPED_SUBMARINE_MINE_LAYING_CONTRACT: SubmarineMineLayingContract = {
  policyId: submarineMineLayingPolicyId,
  rulesetVersion: SUBMARINE_RULESET_VERSION,
  formulaVersion: SUBMARINE_FORMULA_VERSION,
  basisPointsPerUnit: SUBMARINE_BASIS_POINTS_PER_UNIT,
  reliabilityFloor: SUBMARINE_MINE_LAYING_RELIABILITY_FLOOR,
  readinessFloor: SUBMARINE_MINE_LAYING_READINESS_FLOOR,
  fuelFloorBp: SUBMARINE_MINE_LAYING_FUEL_FLOOR_BP,
};

export function validateSubmarineMineLayingContract(
  c: Partial<SubmarineMineLayingContract> | null | undefined,
): asserts c is SubmarineMineLayingContract {
  function mismatch(contract: unknown, reason: string): never {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason,
      contract,
    });
  }
  if (!c) mismatch(c, "submarine_mine_laying_v1 missing contract");
  if (c.policyId !== submarineMineLayingPolicyId)
    mismatch(c, "submarine_mine_laying_v1 expected policy id");
  if (
    c.rulesetVersion !== SUBMARINE_RULESET_VERSION ||
    c.formulaVersion !== SUBMARINE_FORMULA_VERSION
  )
    mismatch(c, "submarine_mine_laying_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    mismatch(c, "submarine_mine_laying_v1 basis-point scale");
  if (c.reliabilityFloor !== SUBMARINE_MINE_LAYING_RELIABILITY_FLOOR)
    mismatch(c, "submarine_mine_laying_v1 §20 reliability floor 40");
  if (c.readinessFloor !== SUBMARINE_MINE_LAYING_READINESS_FLOOR)
    mismatch(c, "submarine_mine_laying_v1 §20 readiness floor 50");
  if (c.fuelFloorBp !== SUBMARINE_MINE_LAYING_FUEL_FLOOR_BP)
    mismatch(c, "submarine_mine_laying_v1 §20 fuel floor 3_000 bp");
  void c;
}

export interface SubmarineFriendlyIdentificationContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  baseProbabilityBp: number;
  clampMinBp: number;
  clampMaxBp: number;
}

export const SHIPPED_SUBMARINE_FRIENDLY_IDENTIFICATION_CONTRACT: SubmarineFriendlyIdentificationContract =
  {
    policyId: submarineFriendlyIdentificationPolicyId,
    rulesetVersion: SUBMARINE_RULESET_VERSION,
    formulaVersion: SUBMARINE_FORMULA_VERSION,
    basisPointsPerUnit: SUBMARINE_BASIS_POINTS_PER_UNIT,
    baseProbabilityBp: SUBMARINE_FRIENDLY_IDENTIFICATION_BASE_BP,
    clampMinBp: SUBMARINE_FRIENDLY_IDENTIFICATION_MIN_BP,
    clampMaxBp: SUBMARINE_FRIENDLY_IDENTIFICATION_MAX_BP,
  };

export function validateSubmarineFriendlyIdentificationContract(
  c: Partial<SubmarineFriendlyIdentificationContract> | null | undefined,
): asserts c is SubmarineFriendlyIdentificationContract {
  function mismatch(contract: unknown, reason: string): never {
    throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
      code: SUBMARINE_STATE_INVARIANT_FAILED,
      reason,
      contract,
    });
  }
  if (!c) mismatch(c, "submarine_friendly_identification_v1 missing contract");
  if (c.policyId !== submarineFriendlyIdentificationPolicyId)
    mismatch(c, "submarine_friendly_identification_v1 expected policy id");
  if (
    c.rulesetVersion !== SUBMARINE_RULESET_VERSION ||
    c.formulaVersion !== SUBMARINE_FORMULA_VERSION
  )
    mismatch(c, "submarine_friendly_identification_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== SUBMARINE_BASIS_POINTS_PER_UNIT)
    mismatch(c, "submarine_friendly_identification_v1 basis-point scale");
  if (c.baseProbabilityBp !== SUBMARINE_FRIENDLY_IDENTIFICATION_BASE_BP)
    mismatch(c, "submarine_friendly_identification_v1 §23 base 500 bp");
  if (c.clampMinBp !== SUBMARINE_FRIENDLY_IDENTIFICATION_MIN_BP)
    mismatch(c, "submarine_friendly_identification_v1 §23 clamp min 0");
  if (c.clampMaxBp !== SUBMARINE_FRIENDLY_IDENTIFICATION_MAX_BP)
    mismatch(c, "submarine_friendly_identification_v1 §23 clamp max 10_000");
  void c;
}
