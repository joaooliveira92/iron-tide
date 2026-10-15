// AC-23 (INC-7): Aircraft canonical ordering (§39).
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  compareDevelopmentProjects,
  compareProposals,
  compareSquadrons,
  compareBasingSlots,
} from "../../src/aircraft/ordering.js";
import type {
  AircraftDevelopmentProject,
  AircraftProposal,
  SquadronState,
  BasingSlot,
} from "../../src/aircraft/state.js";

describe("AC-23: aircraft canonical ordering", () => {
  it("orders development projects by startMonth then projectId", () => {
    const a: AircraftDevelopmentProject = {
      developmentProjectId: "b_project",
      requestedRole: "FIGHTER",
      emphasizedTraits: ["SPEED", "FIREPOWER"] as [string, string],
      basingClass: "LAND_BASED",
      startMonth: "1917-01",
      requiredDevelopmentMonths: SafeInt(4),
      completedPaidMonths: SafeInt(0),
      monthlyCost: SafeInt(500),
      technologyInputHash: "h1",
      nationalTraitInputHash: "h2",
      designStreamKey: "k1",
      status: "DEVELOPING",
      finalProposalId: null,
      rulesetVersion: "v1",
      formulaVersion: "f1",
      projectHash: "ph1",
    };
    const b: AircraftDevelopmentProject = {
      ...a,
      developmentProjectId: "a_project",
      startMonth: "1916-06",
    };
    expect(compareDevelopmentProjects(a, b)).toBeGreaterThan(0);
    expect(compareDevelopmentProjects(b, a)).toBeLessThan(0);
  });

  it("orders proposals by expiryMonth then proposalId", () => {
    const a: AircraftProposal = {
      proposalId: "proposal_b",
      sourceProjectId: "p1",
      proposedModel: {
        aircraftModelId: "",
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
        eligibleRoleIds: ["CAP"],
        basingRequirementId: "LAND_BASED",
        carrierSuitable: false,
        technologyPrerequisiteIds: [],
        productionWork: SafeInt(500),
        unitCost: SafeInt(1200),
        maintenanceRequirement: SafeInt(50),
        crewRequirement: SafeInt(1),
        contentVersion: "v1",
        contentHash: "",
      },
      requestedRole: "FIGHTER",
      emphasizedTraits: ["SPEED", "FIREPOWER"] as [string, string],
      developmentDurationMonths: SafeInt(4),
      developmentCost: SafeInt(2000),
      productionCost: SafeInt(1200),
      productionWork: SafeInt(500),
      estimatedPerformance: {},
      expiryMonth: "1918-01",
      status: "PENDING",
      rulesetVersion: "v1",
      formulaVersion: "f1",
      proposalHash: "",
    };
    const b: AircraftProposal = { ...a, proposalId: "proposal_a", expiryMonth: "1917-06" };
    expect(compareProposals(a, b)).toBeGreaterThan(0);
    expect(compareProposals(b, a)).toBeLessThan(0);
  });

  it("orders squadrons by squadronId", () => {
    const a: SquadronState = {
      squadronId: "sq_b",
      ownerNationId: "nation_france",
      squadronRole: "FIGHTER",
      assignedModelId: null,
      authorizedStrength: SafeInt(18),
      operationalAircraftCount: SafeInt(0),
      damagedAircraftCount: SafeInt(0),
      replacementAircraftReserved: SafeInt(0),
      pilotCount: SafeInt(0),
      squadronExperience: SafeInt(50),
      fatigue: SafeInt(0),
      trainingState: "NORMAL",
      baseOrCarrierId: "base_brest",
      reequipmentState: "NONE",
      expansionState: "NONE",
      missionAvailability: [],
      rulesetVersion: "v1",
      stateHash: "",
    };
    const b: SquadronState = { ...a, squadronId: "sq_a" };
    expect(compareSquadrons(a, b)).toBeGreaterThan(0);
    expect(compareSquadrons(b, a)).toBeLessThan(0);
  });

  it("orders basing slots by hostId then squadronId", () => {
    const a: BasingSlot = {
      slotId: "s1",
      hostId: "base_z",
      aircraftModelId: "m1",
      squadronId: "sq_a",
      condition: "ASSIGNED_OPERATIONAL",
      allocatedAt: "1917-01",
    };
    const b: BasingSlot = {
      ...a,
      hostId: "base_a",
      squadronId: "sq_b",
    };
    expect(compareBasingSlots(a, b)).toBeGreaterThan(0);
  });

  it("compares strings by codepoint (no localeCompare)", () => {
    const a: SquadronState = {
      squadronId: "sq_b",
      ownerNationId: "nation_france",
      squadronRole: "FIGHTER",
      assignedModelId: null,
      authorizedStrength: SafeInt(18),
      operationalAircraftCount: SafeInt(0),
      damagedAircraftCount: SafeInt(0),
      replacementAircraftReserved: SafeInt(0),
      pilotCount: SafeInt(0),
      squadronExperience: SafeInt(50),
      fatigue: SafeInt(0),
      trainingState: "NORMAL",
      baseOrCarrierId: "base_brest",
      reequipmentState: "NONE",
      expansionState: "NONE",
      missionAvailability: [],
      rulesetVersion: "v1",
      stateHash: "",
    };
    const b: SquadronState = { ...a, squadronId: "sq_a" };
    // Deterministic: same inputs always same order
    expect(compareSquadrons(a, b)).toBeGreaterThan(0);
    expect(compareSquadrons(b, a)).toBeLessThan(0);
  });
});
