import { describe, expect, it } from "vite-plus/test";
import {
  SHIPPED_SUBMARINE_STRATEGIC_ASSET_CONTRACT,
  SHIPPED_SUBMARINE_TYPES_CONTRACT,
  SHIPPED_SUBMARINE_POLICIES_CONTRACT,
  SHIPPED_SUBMARINE_MISSIONS_CONTRACT,
  SHIPPED_SUBMARINE_RELIABILITY_CONTRACT,
  SHIPPED_SUBMARINE_PROXIMITY_CONTRACT,
  SHIPPED_SUBMARINE_REMOTE_EFFICIENCY_CONTRACT,
  SHIPPED_SUBMARINE_LONG_RANGE_ASW_VULNERABILITY_CONTRACT,
  SHIPPED_SUBMARINE_EFFECTIVENESS_CONTRACT,
  SHIPPED_SUBMARINE_SEA_STATE_CONTRACT,
  SHIPPED_SUBMARINE_SCREENING_BALANCE_CONTRACT,
  SHIPPED_SUBMARINE_MINE_LAYING_CONTRACT,
  SHIPPED_SUBMARINE_FRIENDLY_IDENTIFICATION_CONTRACT,
  validateSubmarineStrategicAssetContract,
  validateSubmarineTypesContract,
  validateSubmarinePoliciesContract,
  validateSubmarineMissionsContract,
  validateSubmarineReliabilityContract,
  validateSubmarineProximityContract,
  validateSubmarineRemoteEfficiencyContract,
  validateSubmarineLongRangeAswVulnerabilityContract,
  validateSubmarineEffectivenessContract,
  validateSubmarineSeaStateContract,
  validateSubmarineScreeningBalanceContract,
  validateSubmarineMineLayingContract,
  validateSubmarineFriendlyIdentificationContract,
} from "../../src/submarines/index.js";

describe("AC-21: contracts rollup — every shipped contract self-validates", () => {
  const contracts: [string, unknown, (c: never) => asserts c is never][] = [
    [
      "submarine_strategic_asset_v1",
      SHIPPED_SUBMARINE_STRATEGIC_ASSET_CONTRACT,
      validateSubmarineStrategicAssetContract,
    ],
    ["submarine_types_v1", SHIPPED_SUBMARINE_TYPES_CONTRACT, validateSubmarineTypesContract],
    [
      "submarine_policies_v1",
      SHIPPED_SUBMARINE_POLICIES_CONTRACT,
      validateSubmarinePoliciesContract,
    ],
    [
      "submarine_missions_v1",
      SHIPPED_SUBMARINE_MISSIONS_CONTRACT,
      validateSubmarineMissionsContract,
    ],
    [
      "submarine_reliability_v1",
      SHIPPED_SUBMARINE_RELIABILITY_CONTRACT,
      validateSubmarineReliabilityContract,
    ],
    [
      "submarine_proximity_v1",
      SHIPPED_SUBMARINE_PROXIMITY_CONTRACT,
      validateSubmarineProximityContract,
    ],
    [
      "submarine_remote_efficiency_v1",
      SHIPPED_SUBMARINE_REMOTE_EFFICIENCY_CONTRACT,
      validateSubmarineRemoteEfficiencyContract,
    ],
    [
      "submarine_long_range_asw_vulnerability_v1",
      SHIPPED_SUBMARINE_LONG_RANGE_ASW_VULNERABILITY_CONTRACT,
      validateSubmarineLongRangeAswVulnerabilityContract,
    ],
    [
      "submarine_effectiveness_v1",
      SHIPPED_SUBMARINE_EFFECTIVENESS_CONTRACT,
      validateSubmarineEffectivenessContract,
    ],
    [
      "submarine_sea_state_v1",
      SHIPPED_SUBMARINE_SEA_STATE_CONTRACT,
      validateSubmarineSeaStateContract,
    ],
    [
      "submarine_screening_balance_v1",
      SHIPPED_SUBMARINE_SCREENING_BALANCE_CONTRACT,
      validateSubmarineScreeningBalanceContract,
    ],
    [
      "submarine_mine_laying_v1",
      SHIPPED_SUBMARINE_MINE_LAYING_CONTRACT,
      validateSubmarineMineLayingContract,
    ],
    [
      "submarine_friendly_identification_v1",
      SHIPPED_SUBMARINE_FRIENDLY_IDENTIFICATION_CONTRACT,
      validateSubmarineFriendlyIdentificationContract,
    ],
  ];

  for (const [name, contract, validate] of contracts) {
    it(`${name} self-validates`, () => {
      expect(() => validate(contract as never)).not.toThrow();
    });
  }

  it("validateSubmarineStrategicAssetContract fails on null", () => {
    expect(() => validateSubmarineStrategicAssetContract(null)).toThrow();
  });
});
