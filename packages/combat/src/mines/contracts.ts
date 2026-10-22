import { CombatInvariantError } from "../errors.js";
import {
  SHIPPED_MINE_DECAY_CONTRACT,
  mineDecayPolicyId,
  validateMineDecayContract,
} from "./decay.js";
import {
  SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT,
  mineDefensiveStandoffPolicyId,
  validateMineDefensiveStandoffContract,
} from "./defensive-standoff.js";
import {
  SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT,
  dualAswMineEquipmentPolicyId,
  validateDualAswMineEquipmentContract,
} from "./dual-equipment.js";
import {
  SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT,
  underwaterExplosionIdentificationPolicyId,
  validateUnderwaterExplosionIdentificationContract,
} from "./misidentification.js";
import {
  SHIPPED_MINE_PRESSURE_CONTRACT,
  MINE_PRESSURE_POLICY_ID,
  validateMinePressureContract,
} from "./pressure-record.js";
import {
  SHIPPED_MINE_ROUTE_RISK_CONTRACT,
  routeRiskPolicyId,
  validateMineRouteRiskContract,
} from "./route-risk.js";
import {
  SHIPPED_MINE_SWEEPING_CONTRACT,
  mineSweepingPolicyId,
  validateMineSweepingContract,
} from "./sweeping-base-values.js";
import {
  SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
  mineTypeDefinitionsPolicyId,
  validateMineTypeDefinitionsContract,
} from "./constants.js";

export interface MineContractEntry<C = unknown> {
  policyId: string;
  shippedContract: C;
  validate: (c: unknown) => asserts c is C;
}

export const SHIPPED_MINE_CONTRACTS: readonly MineContractEntry[] = [
  {
    policyId: mineTypeDefinitionsPolicyId,
    shippedContract: SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
    validate: validateMineTypeDefinitionsContract as (
      c: unknown,
    ) => asserts c is typeof SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
  },
  {
    policyId: MINE_PRESSURE_POLICY_ID,
    shippedContract: SHIPPED_MINE_PRESSURE_CONTRACT,
    validate: validateMinePressureContract as (
      c: unknown,
    ) => asserts c is typeof SHIPPED_MINE_PRESSURE_CONTRACT,
  },
  {
    policyId: mineSweepingPolicyId,
    shippedContract: SHIPPED_MINE_SWEEPING_CONTRACT,
    validate: validateMineSweepingContract as (
      c: unknown,
    ) => asserts c is typeof SHIPPED_MINE_SWEEPING_CONTRACT,
  },
  {
    policyId: dualAswMineEquipmentPolicyId,
    shippedContract: SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT,
    validate: validateDualAswMineEquipmentContract as (
      c: unknown,
    ) => asserts c is typeof SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT,
  },
  {
    policyId: mineDefensiveStandoffPolicyId,
    shippedContract: SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT,
    validate: validateMineDefensiveStandoffContract as (
      c: unknown,
    ) => asserts c is typeof SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT,
  },
  {
    policyId: underwaterExplosionIdentificationPolicyId,
    shippedContract: SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT,
    validate: validateUnderwaterExplosionIdentificationContract as (
      c: unknown,
    ) => asserts c is typeof SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT,
  },
  {
    policyId: mineDecayPolicyId,
    shippedContract: SHIPPED_MINE_DECAY_CONTRACT,
    validate: validateMineDecayContract as (
      c: unknown,
    ) => asserts c is typeof SHIPPED_MINE_DECAY_CONTRACT,
  },
  {
    policyId: routeRiskPolicyId,
    shippedContract: SHIPPED_MINE_ROUTE_RISK_CONTRACT,
    validate: validateMineRouteRiskContract as (
      c: unknown,
    ) => asserts c is typeof SHIPPED_MINE_ROUTE_RISK_CONTRACT,
  },
];

export const REQUIRED_MINE_CONTRACT_POLICY_IDS: readonly string[] = [
  "mine_type_definitions_v1",
  "mine_pressure_v1",
  "mine_sweeping_v1",
  "dual_asw_mine_equipment_v1",
  "mine_defensive_standoff_v1",
  "underwater_explosion_identification_v1",
  "mine_decay_v1",
];

export function validateAllMineContracts(): void {
  const shippedIds = new Set(SHIPPED_MINE_CONTRACTS.map((entry) => entry.policyId));
  for (const required of REQUIRED_MINE_CONTRACT_POLICY_IDS) {
    if (!shippedIds.has(required)) {
      throw new CombatInvariantError({
        message: `validateAllMineContracts: missing required contract policy ${required}`,
        context: { requiredPolicyId: required },
      });
    }
  }
  for (const entry of SHIPPED_MINE_CONTRACTS) {
    entry.validate(entry.shippedContract);
    expectContractRejects(entry, { ...(entry.shippedContract as object), policyId: "tampered" });
  }
}

function expectContractRejects<C>(entry: MineContractEntry<C>, tampered: unknown): void {
  try {
    entry.validate(tampered);
  } catch {
    return;
  }
  throw new CombatInvariantError({
    message: `validateAllMineContracts: contract ${String(entry.policyId)} accepted tampering`,
    context: { policyId: entry.policyId },
  });
}
