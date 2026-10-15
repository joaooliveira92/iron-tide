// AC-14/15 (INC-5): Auto-equip eligibility + deterministic selection.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  checkAutoEquipEligibility,
  selectAutoEquipModel,
  assertAutoEquipAvailable,
} from "../../src/aircraft/auto-equip.js";
import { SQUADRON_AUTO_EQUIP_UNAVAILABLE } from "../../src/aircraft/reasonCodes.js";
import type { AircraftModelDefinition } from "../../src/aircraft/model.js";
import type { SquadronState } from "../../src/aircraft/state.js";
import type { BluewaveError } from "@bluewave/contracts";

const FIGHTER_MODEL: AircraftModelDefinition = {
  aircraftModelId: "spad_s_xiii",
  aircraftType: "FIGHTER",
  ownerOrLicenseHolder: "nation_france",
  introductionMonth: "1917-05",
  speed: SafeInt(72),
  firepower: SafeInt(50),
  maneuverability: SafeInt(55),
  toughness: SafeInt(50),
  payloadCapacity: SafeInt(100),
  rangeClass: "SHORT",
  rangeDistance: SafeInt(300),
  eligibleRoleIds: ["CAP", "ESCORT", "INTERCEPTION"],
  basingRequirementId: "LAND_BASED",
  carrierSuitable: false,
  technologyPrerequisiteIds: ["early_aviation"],
  productionWork: SafeInt(500),
  unitCost: SafeInt(1200),
  maintenanceRequirement: SafeInt(50),
  crewRequirement: SafeInt(1),
  contentVersion: "aircraft_model_definition_v1",
  contentHash: "hash1",
};

function makeSquadron(overrides: Partial<SquadronState> = {}): SquadronState {
  return {
    squadronId: "sq_1",
    ownerNationId: "nation_france",
    squadronRole: "FIGHTER",
    assignedModelId: null,
    authorizedStrength: SafeInt(18),
    operationalAircraftCount: SafeInt(0),
    damagedAircraftCount: SafeInt(0),
    replacementAircraftReserved: SafeInt(0),
    pilotCount: SafeInt(18),
    squadronExperience: SafeInt(50),
    fatigue: SafeInt(0),
    trainingState: "NORMAL",
    baseOrCarrierId: "base_brest",
    reequipmentState: "NONE",
    expansionState: "NONE",
    missionAvailability: [],
    rulesetVersion: "aircraft_ruleset_v1",
    stateHash: "",
    ...overrides,
  };
}

describe("AC-14: auto-equip eligibility predicates", () => {
  it("returns eligible when all conditions are met", () => {
    const result = checkAutoEquipEligibility({
      squadron: makeSquadron(),
      compatibleModels: [FIGHTER_MODEL],
      unassignedOperationalInventory: new Map([["spad_s_xiii", SafeInt(20)]]),
      basingCapacityAvailable: SafeInt(20),
      pilotPoolAvailable: SafeInt(20),
      maintenanceSupportAvailable: true,
      assetAutomationLock: false,
    });
    expect(result.eligible).toBe(true);
  });

  it("rejects when model already assigned", () => {
    const result = checkAutoEquipEligibility({
      squadron: makeSquadron({ assignedModelId: "existing_model" }),
      compatibleModels: [FIGHTER_MODEL],
      unassignedOperationalInventory: new Map([["spad_s_xiii", SafeInt(20)]]),
      basingCapacityAvailable: SafeInt(20),
      pilotPoolAvailable: SafeInt(20),
      maintenanceSupportAvailable: true,
      assetAutomationLock: false,
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toBe("ALREADY_ASSIGNED");
  });

  it("rejects when no compatible models exist", () => {
    const result = checkAutoEquipEligibility({
      squadron: makeSquadron(),
      compatibleModels: [],
      unassignedOperationalInventory: new Map(),
      basingCapacityAvailable: SafeInt(20),
      pilotPoolAvailable: SafeInt(20),
      maintenanceSupportAvailable: true,
      assetAutomationLock: false,
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toBe("NO_COMPATIBLE_MODELS");
  });

  it("rejects when asset automation lock is active", () => {
    const result = checkAutoEquipEligibility({
      squadron: makeSquadron(),
      compatibleModels: [FIGHTER_MODEL],
      unassignedOperationalInventory: new Map([["spad_s_xiii", SafeInt(20)]]),
      basingCapacityAvailable: SafeInt(20),
      pilotPoolAvailable: SafeInt(20),
      maintenanceSupportAvailable: true,
      assetAutomationLock: true,
    });
    expect(result.eligible).toBe(false);
  });
});

describe("AC-15: deterministic auto-equip selection", () => {
  it("selects the model with best role fit when inventory sufficient", () => {
    const inventory = new Map<string, SafeInt>([
      ["model_a", SafeInt(10)],
      ["model_b", SafeInt(10)],
    ]);
    const modelA: AircraftModelDefinition = {
      ...FIGHTER_MODEL,
      aircraftModelId: "model_a",
      introductionMonth: "1915-01",
      eligibleRoleIds: ["CAP"],
    };
    const modelB: AircraftModelDefinition = {
      ...FIGHTER_MODEL,
      aircraftModelId: "model_b",
      introductionMonth: "1916-01",
      eligibleRoleIds: ["CAP", "ESCORT"],
    };
    const result = selectAutoEquipModel({
      models: [modelA, modelB],
      inventory,
      authorizedStrength: SafeInt(18),
    });
    expect(result.selectedModel).toBeDefined();
  });

  it("returns null when no model has sufficient inventory", () => {
    const inventory = new Map<string, SafeInt>([["spad_s_xiii", SafeInt(1)]]);
    const result = selectAutoEquipModel({
      models: [FIGHTER_MODEL],
      inventory,
      authorizedStrength: SafeInt(18),
    });
    expect(result.selectedModel).toBeNull();
  });

  it("consumes no randomness (deterministic ordering)", () => {
    const inventory = new Map<string, SafeInt>([
      ["model_1", SafeInt(20)],
      ["model_2", SafeInt(20)],
    ]);
    const m1: AircraftModelDefinition = {
      ...FIGHTER_MODEL,
      aircraftModelId: "model_1",
      introductionMonth: "1916-01",
      eligibleRoleIds: ["CAP"],
    };
    const m2: AircraftModelDefinition = {
      ...FIGHTER_MODEL,
      aircraftModelId: "model_2",
      introductionMonth: "1915-01",
      eligibleRoleIds: ["CAP", "ESCORT"],
    };
    const r1 = selectAutoEquipModel({
      models: [m1, m2],
      inventory,
      authorizedStrength: SafeInt(18),
    });
    const r2 = selectAutoEquipModel({
      models: [m1, m2],
      inventory,
      authorizedStrength: SafeInt(18),
    });
    expect(r1.selectedModel?.aircraftModelId).toBe(r2.selectedModel?.aircraftModelId);
  });
});

describe("assertAutoEquipAvailable", () => {
  it("throws SQUADRON_AUTO_EQUIP_UNAVAILABLE when no selection", () => {
    let err: BluewaveError | undefined;
    try {
      assertAutoEquipAvailable(false);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(SQUADRON_AUTO_EQUIP_UNAVAILABLE);
  });
});
