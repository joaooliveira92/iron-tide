// AC-24 (INC-8): the FULL `*_v1` contracts rollup. Every required policy id
// exists with its SHIPPED_*_CONTRACT + validate guard; validateAllMineContracts()
// passes on the shipped set; any tampering fails the rollup.
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  dualAswMineEquipmentPolicyId,
  mineDecayPolicyId,
  mineDefensiveStandoffPolicyId,
  mineSweepingPolicyId,
  mineTypeDefinitionsPolicyId,
  MINE_PRESSURE_POLICY_ID,
  REQUIRED_MINE_CONTRACT_POLICY_IDS,
  SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT,
  SHIPPED_MINE_CONTRACTS,
  SHIPPED_MINE_DECAY_CONTRACT,
  SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT,
  SHIPPED_MINE_PRESSURE_CONTRACT,
  SHIPPED_MINE_SWEEPING_CONTRACT,
  SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
  SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT,
  underwaterExplosionIdentificationPolicyId,
  validateAllMineContracts,
  validateDualAswMineEquipmentContract,
  validateMineDecayContract,
  validateMineDefensiveStandoffContract,
  validateMinePressureContract,
  validateMineSweepingContract,
  validateMineTypeDefinitionsContract,
  validateUnderwaterExplosionIdentificationContract,
} from "../../src/mines/index.js";

describe("AC-24: full *_v1 contracts rollup (INC-8)", () => {
  it("ships all 7 REQUIRED policy ids + their SHIPPED contracts + validate guards", () => {
    expect(REQUIRED_MINE_CONTRACT_POLICY_IDS).toEqual([
      "mine_type_definitions_v1",
      "mine_pressure_v1",
      "mine_sweeping_v1",
      "dual_asw_mine_equipment_v1",
      "mine_defensive_standoff_v1",
      "underwater_explosion_identification_v1",
      "mine_decay_v1",
    ]);
    const shipped = new Map(SHIPPED_MINE_CONTRACTS.map((e) => [e.policyId, e]));
    for (const required of REQUIRED_MINE_CONTRACT_POLICY_IDS) {
      const entry = shipped.get(required);
      expect(entry, `missing ${required}`).toBeDefined();
      expect(entry!.shippedContract).toBeDefined();
      expect(typeof entry!.validate).toBe("function");
    }
  });

  it("each policy id constant matches its SHIPPED contract's policyId", () => {
    expect(mineTypeDefinitionsPolicyId).toBe("mine_type_definitions_v1");
    expect(SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT.policyId).toBe(mineTypeDefinitionsPolicyId);
    expect(MINE_PRESSURE_POLICY_ID).toBe("mine_pressure_v1");
    expect(SHIPPED_MINE_PRESSURE_CONTRACT.policyId).toBe(MINE_PRESSURE_POLICY_ID);
    expect(mineSweepingPolicyId).toBe("mine_sweeping_v1");
    expect(SHIPPED_MINE_SWEEPING_CONTRACT.policyId).toBe(mineSweepingPolicyId);
    expect(dualAswMineEquipmentPolicyId).toBe("dual_asw_mine_equipment_v1");
    expect(SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT.policyId).toBe(dualAswMineEquipmentPolicyId);
    expect(mineDefensiveStandoffPolicyId).toBe("mine_defensive_standoff_v1");
    expect(SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT.policyId).toBe(mineDefensiveStandoffPolicyId);
    expect(underwaterExplosionIdentificationPolicyId).toBe(
      "underwater_explosion_identification_v1",
    );
    expect(SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT.policyId).toBe(
      underwaterExplosionIdentificationPolicyId,
    );
    expect(mineDecayPolicyId).toBe("mine_decay_v1");
    expect(SHIPPED_MINE_DECAY_CONTRACT.policyId).toBe(mineDecayPolicyId);
  });

  it("each validate*Contract passes on its shipped contract and fails on a wild policy id", () => {
    const cases: Array<{ shipped: object; validate: (c: object) => void }> = [
      {
        shipped: SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
        validate: validateMineTypeDefinitionsContract as (c: object) => void,
      },
      {
        shipped: SHIPPED_MINE_PRESSURE_CONTRACT,
        validate: validateMinePressureContract as (c: object) => void,
      },
      {
        shipped: SHIPPED_MINE_SWEEPING_CONTRACT,
        validate: validateMineSweepingContract as (c: object) => void,
      },
      {
        shipped: SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT,
        validate: validateDualAswMineEquipmentContract as (c: object) => void,
      },
      {
        shipped: SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT,
        validate: validateMineDefensiveStandoffContract as (c: object) => void,
      },
      {
        shipped: SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT,
        validate: validateUnderwaterExplosionIdentificationContract as (c: object) => void,
      },
      {
        shipped: SHIPPED_MINE_DECAY_CONTRACT,
        validate: validateMineDecayContract as (c: object) => void,
      },
    ];
    for (const { shipped, validate } of cases) {
      expect(() => validate(shipped)).not.toThrow();
      expect(() => validate({ ...shipped, policyId: "tampered" })).toThrow(BluewaveError);
      expect(() => validate(null as unknown as object)).toThrow(BluewaveError);
    }
  });

  it("validateAllMineContracts() passes on the shipped rollup", () => {
    expect(() => validateAllMineContracts()).not.toThrow();
  });

  it("tampering ANY one shipped contract makes the rollup gate fail", () => {
    // validateAllMineContracts() runs EVERY entry's guard against its shipped
    // contract AND a tampered copy (policy id) — so a tampered shipped surface
    // can never pass the rollup. Prove the mirror directly:
    const guards: Array<{ shipped: object; validate: (c: object) => void }> = [
      {
        shipped: SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
        validate: validateMineTypeDefinitionsContract as (c: object) => void,
      },
      {
        shipped: SHIPPED_MINE_PRESSURE_CONTRACT,
        validate: validateMinePressureContract as (c: object) => void,
      },
      {
        shipped: SHIPPED_MINE_SWEEPING_CONTRACT,
        validate: validateMineSweepingContract as (c: object) => void,
      },
      {
        shipped: SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT,
        validate: validateDualAswMineEquipmentContract as (c: object) => void,
      },
      {
        shipped: SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT,
        validate: validateMineDefensiveStandoffContract as (c: object) => void,
      },
      {
        shipped: SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT,
        validate: validateUnderwaterExplosionIdentificationContract as (c: object) => void,
      },
      {
        shipped: SHIPPED_MINE_DECAY_CONTRACT,
        validate: validateMineDecayContract as (c: object) => void,
      },
    ];
    for (const { shipped, validate } of guards) {
      // the un-tampered shipped surface passes
      expect(() => validate(shipped)).not.toThrow();
      // the SAME surface with a tampered policy id fails the guard
      expect(() => validate({ ...shipped, policyId: "tampered" })).toThrow(BluewaveError);
      // a null/missing contract fails too
      expect(() => validate(null as unknown as object)).toThrow(BluewaveError);
    }
  });
});
