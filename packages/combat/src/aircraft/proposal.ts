// DESIGN-43 §§10-12 proposal model, acceptance/rejection, expiry.
// INC-3: AircraftProposal creation (from RNG-generated attributes),
// acceptance → model creation, rejection.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import type { RandomStream } from "@bluewave/random";
import type { AircraftDevelopmentProject, AircraftProposal } from "./state.js";
import type { AircraftModelDefinition, AircraftBasingClass } from "./index.js";
import { withAircraftModelDefinitionContentHash } from "./model.js";
import { AIRCRAFT_RULESET_VERSION, AIRCRAFT_FORMULA_VERSION } from "./constants.js";
import { allocateAttributes } from "./attribute-allocation.js";
import { computeMonthlyCost } from "./development-duration.js";
import { INVALID_AIRCRAFT_MODEL_DEFINITION } from "./reasonCodes.js";

export function generateAircraftProposal(
  project: AircraftDevelopmentProject,
  rngStream: RandomStream,
  currentMonth: string,
): AircraftProposal {
  const role = project.requestedRole;
  const emphasizedTraits = project.emphasizedTraits;

  const [speed, firepower, maneuverability, toughness] = allocateAttributes(role, emphasizedTraits);

  const duration = project.requiredDevelopmentMonths;
  const devCost = computeMonthlyCost(duration);

  const rngVariation = Math.floor(rngStream.next() * 200);
  const rawProductionWork = SafeInt(400 + rngVariation);
  const rngCostVariation = Math.floor(rngStream.next() * 400);
  const rawUnitCost = SafeInt(900 + rngCostVariation);

  const proposalId = `proposal_${project.developmentProjectId}`;

  const estimatedPerformance: Record<string, SafeInt> = {
    speed,
    firepower,
    maneuverability,
    toughness,
  };

  const expiryYear = Number(currentMonth.split("-")[0]) + 1;
  const expiryMonthVal = currentMonth.split("-")[1];
  const expiryMonth = `${expiryYear}-${expiryMonthVal}`;

  const modelStub: AircraftModelDefinition = {
    aircraftModelId: "",
    aircraftType: role,
    ownerOrLicenseHolder: "",
    introductionMonth: "",
    speed: SafeInt(0),
    firepower: SafeInt(0),
    maneuverability: SafeInt(0),
    toughness: SafeInt(0),
    payloadCapacity: SafeInt(0),
    rangeClass: "",
    rangeDistance: SafeInt(0),
    eligibleRoleIds: [],
    basingRequirementId: "LAND_BASED",
    carrierSuitable: false,
    technologyPrerequisiteIds: [],
    productionWork: SafeInt(0),
    unitCost: SafeInt(0),
    maintenanceRequirement: SafeInt(0),
    crewRequirement: SafeInt(0),
    contentVersion: "",
    contentHash: "",
  };

  const proposal: AircraftProposal = {
    proposalId,
    sourceProjectId: project.developmentProjectId,
    proposedModel: modelStub,
    requestedRole: role,
    emphasizedTraits,
    developmentDurationMonths: duration,
    developmentCost: devCost,
    productionCost: rawUnitCost,
    productionWork: rawProductionWork,
    estimatedPerformance,
    expiryMonth,
    status: "PENDING",
    rulesetVersion: AIRCRAFT_RULESET_VERSION,
    formulaVersion: AIRCRAFT_FORMULA_VERSION,
    proposalHash: "",
  };

  proposal.proposalHash = computeProposalHash(proposal);
  return proposal;
}

export function computeProposalHash(proposal: AircraftProposal): string {
  const { proposalHash: _proposalHash, ...rest } = proposal;
  const envelope = createEnvelope("aircraft-proposal", AIRCRAFT_RULESET_VERSION, rest);
  return envelope.bodyHash;
}

export function acceptAircraftProposal(
  proposal: AircraftProposal,
  modelId: string,
  ownerNationId: string,
  introductionMonth: string,
  basingRequirementId: AircraftBasingClass,
): { updatedProposal: AircraftProposal; model: AircraftModelDefinition } {
  if (proposal.status !== "PENDING") {
    throw new BluewaveError(INVALID_AIRCRAFT_MODEL_DEFINITION, {
      code: INVALID_AIRCRAFT_MODEL_DEFINITION,
      proposalId: proposal.proposalId,
      status: proposal.status,
    });
  }

  const def = buildModelFromProposal(
    proposal,
    modelId,
    ownerNationId,
    introductionMonth,
    basingRequirementId,
  );

  return {
    updatedProposal: { ...proposal, status: "ACCEPTED" as const },
    model: def,
  };
}

export function rejectAircraftProposal(proposal: AircraftProposal): AircraftProposal {
  if (proposal.status !== "PENDING") {
    throw new BluewaveError(INVALID_AIRCRAFT_MODEL_DEFINITION, {
      code: INVALID_AIRCRAFT_MODEL_DEFINITION,
      proposalId: proposal.proposalId,
      status: proposal.status,
    });
  }
  return { ...proposal, status: "REJECTED" as const };
}

export function expireAircraftProposal(proposal: AircraftProposal): AircraftProposal {
  return { ...proposal, status: "EXPIRED" as const };
}

function buildModelFromProposal(
  proposal: AircraftProposal,
  modelId: string,
  ownerNationId: string,
  introductionMonth: string,
  basingRequirementId: AircraftBasingClass,
): AircraftModelDefinition {
  const def: AircraftModelDefinition = {
    aircraftModelId: modelId,
    aircraftType: proposal.requestedRole,
    ownerOrLicenseHolder: ownerNationId,
    introductionMonth,
    speed: proposal.estimatedPerformance.speed!,
    firepower: proposal.estimatedPerformance.firepower!,
    maneuverability: proposal.estimatedPerformance.maneuverability!,
    toughness: proposal.estimatedPerformance.toughness!,
    payloadCapacity: SafeInt(100),
    rangeClass: "MEDIUM",
    rangeDistance: SafeInt(300),
    eligibleRoleIds: [proposal.requestedRole],
    basingRequirementId,
    carrierSuitable: false,
    technologyPrerequisiteIds: [],
    productionWork: proposal.productionWork,
    unitCost: proposal.productionCost,
    maintenanceRequirement: SafeInt(50),
    crewRequirement: SafeInt(1),
    contentVersion: "aircraft_model_definition_v1",
    contentHash: "",
  };
  return withAircraftModelDefinitionContentHash(def);
}
