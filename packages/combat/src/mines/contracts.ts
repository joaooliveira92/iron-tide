// INC-8 AC-24 — the full `*_v1` contracts rollup for the mine subsystem.
// DESIGN-35's content deliverable (spec §1.3) is the ENGINE-VERSIONED constant
// set: every shipped `*_v1` policy id + `SHIPPED_*_CONTRACT` + a fail-closed
// `validate*Contract` guard. This module REGISTERS all of them and proves
// `validateAllMineContracts()` passes on the shipped set (and only that) —
// additive (INC-8) — nothing is reformatted or removed from the per-module
// contracts, which stay the single source of truth for each policy.
//
// The shipped policy ids (all *_v1, spec §1.3):
//   mine_type_definitions_v1                     (constants.ts)
//   mine_pressure_v1                             (pressure-record.ts)
//   mine_sweeping_v1                             (sweeping-base-values.ts)
//   dual_asw_mine_equipment_v1                   (dual-equipment.ts)
//   mine_defensive_standoff_v1                   (defensive-standoff.ts)
//   underwater_explosion_identification_v1       (misidentification.ts)
//   mine_decay_v1                                (decay.ts)
//
// NOTE: route-risk carries mine_route_risk_v1 (route-risk.ts) as an ADDITIONAL
// shipped contract (its §13 value is part of this slice's ACC-11/ACC-12 proof);
// it ships on the registry as a bonus even though spec §1.3 lists only the seven
// above — the registry is additive and the route contract already shipped in
// INC-5 with its own SHIPPED_MINE_ROUTE_RISK_CONTRACT + guard.
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
  /** Fail-closed guard; accepts unknown so the rollup can prove tamper-rejection
   *  (a concrete callsite passes its typed SHIPPED_*_CONTRACT for narrowing). */
  validate: (c: unknown) => asserts c is C;
}

/** The full additive rollup of every shipped mine `*_v1` contract (AC-24). */
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
  // Bonus (shipped in INC-5; §13 value-only proof lives in route-risk.ts).
  {
    policyId: routeRiskPolicyId,
    shippedContract: SHIPPED_MINE_ROUTE_RISK_CONTRACT,
    validate: validateMineRouteRiskContract as (
      c: unknown,
    ) => asserts c is typeof SHIPPED_MINE_ROUTE_RISK_CONTRACT,
  },
];

/** The 7 spec-§1.3 REQUIRED policy ids (the rollup contract of record for
 *  AC-24's "every *_v1 policy id exists with SHIPPED + validate guard"). */
export const REQUIRED_MINE_CONTRACT_POLICY_IDS: readonly string[] = [
  "mine_type_definitions_v1",
  "mine_pressure_v1",
  "mine_sweeping_v1",
  "dual_asw_mine_equipment_v1",
  "mine_defensive_standoff_v1",
  "underwater_explosion_identification_v1",
  "mine_decay_v1",
];

// AC-24: fail-closed proof that every shipped contract validates against its
// own guard. A tampered contract fails its own guard (throws `BluewaveError`);
// a registry missing a required policy, or a guard that accepts tampering,
// throws `CombatInvariantError`.
export function validateAllMineContracts(): void {
  const shippedIds = new Set(SHIPPED_MINE_CONTRACTS.map((entry) => entry.policyId));
  // every REQUIRED id must be present on the registry (nothing forgotten)
  for (const required of REQUIRED_MINE_CONTRACT_POLICY_IDS) {
    if (!shippedIds.has(required)) {
      throw new CombatInvariantError({
        message: `validateAllMineContracts: missing required contract policy ${required}`,
        context: { requiredPolicyId: required },
      });
    }
  }
  for (const entry of SHIPPED_MINE_CONTRACTS) {
    // guard 1: the shipped contract itself passes its own guard
    entry.validate(entry.shippedContract);
    // guard 2: a tampered policy id fails the guard (fail-closed proof)
    expectContractRejects(entry, { ...(entry.shippedContract as object), policyId: "tampered" });
  }
}

function expectContractRejects<C>(entry: MineContractEntry<C>, tampered: unknown): void {
  try {
    entry.validate(tampered);
  } catch {
    return; // fail-closed: the tampered contract threw
  }
  throw new CombatInvariantError({
    message: `validateAllMineContracts: contract ${String(entry.policyId)} accepted tampering`,
    context: { policyId: entry.policyId },
  });
}
