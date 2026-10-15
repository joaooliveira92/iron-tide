// DESIGN-43 §§11-12 private ventures.
// INC-4: typed event private_aircraft_venture_v1, 12-month cooldown,
// max 3 unexpired, PurchasePrivateAircraftProposalCommand, 12-month expiry.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import type { RandomStream } from "@bluewave/random";
import {
  AIRCRAFT_RULESET_VERSION,
  AIRCRAFT_FORMULA_VERSION,
  PRIVATE_VENTURE_COOLDOWN_MONTHS,
  PRIVATE_VENTURE_MAX_UNEXPIRED,
  type AircraftType,
} from "./constants.js";
import {
  AIRCRAFT_PRIVATE_PROPOSAL_EXPIRED,
  AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT,
} from "./reasonCodes.js";
import type { AircraftProposal } from "./state.js";
import type { AircraftModelDefinition } from "./model.js";
import { allocateAttributes } from "./attribute-allocation.js";
import { withAircraftModelDefinitionContentHash } from "./model.js";
import { createPrivateVentureEvent, type PrivateAircraftVenture_v1 } from "./event-types.js";

// Stream key for the private-venture RNG — DESIGN-43 §11.
export const PRIVATE_VENTURE_STREAM_KEY = "event/month/nation/private_aircraft_venture" as const;

// ---- Eligibility predicates (§11) ----

export interface PrivateVentureEligibilityInput {
  hasPrivateAviationIndustry: boolean;
  permittedRoles: readonly AircraftType[];
  hasNationalProhibition: boolean;
  lastVentureMonth: string | null;
  currentMonth: string;
  unexpiredPrivateProposalCount: number;
}

export function checkPrivateVentureEligibility(
  input: PrivateVentureEligibilityInput,
):
  | { eligible: true; eligibleRoles: readonly AircraftType[] }
  | { eligible: false; reason: string } {
  if (!input.hasPrivateAviationIndustry) {
    return { eligible: false, reason: "NO_PRIVATE_AVIATION_INDUSTRY" };
  }

  if (input.hasNationalProhibition) {
    return { eligible: false, reason: "NATIONAL_PROHIBITION_ACTIVE" };
  }

  if (input.permittedRoles.length === 0) {
    return { eligible: false, reason: "NO_PERMITTED_ROLES" };
  }

  if (input.lastVentureMonth !== null) {
    const lastYear = Number(input.lastVentureMonth.split("-")[0]);
    const lastMonth = Number(input.lastVentureMonth.split("-")[1]);
    const currentYear = Number(input.currentMonth.split("-")[0]);
    const currentMonth = Number(input.currentMonth.split("-")[1]);
    const monthsSince = (currentYear - lastYear) * 12 + (currentMonth - lastMonth);
    if (monthsSince < PRIVATE_VENTURE_COOLDOWN_MONTHS) {
      return { eligible: false, reason: "COOLDOWN_NOT_COMPLETE" };
    }
  }

  if (input.unexpiredPrivateProposalCount >= PRIVATE_VENTURE_MAX_UNEXPIRED) {
    return { eligible: false, reason: "MAX_UNEXPIRED_LIMIT_REACHED" };
  }

  // Eligible roles ordered by role identifier per §11.
  const sortedRoles = [...input.permittedRoles].sort((a, b) => a.localeCompare(b));
  return { eligible: true, eligibleRoles: sortedRoles };
}

// ---- Private venture proposal generation ----

export interface PrivateVentureProposalParams {
  nationId: string;
  role: AircraftType;
  currentMonth: string;
  rngStream: RandomStream;
}

export function generatePrivateVentureProposal(
  params: PrivateVentureProposalParams,
): AircraftProposal {
  const { nationId, role, currentMonth, rngStream } = params;

  // Use role baseline + RNG for attribute allocation. Private ventures use
  // a simplified attribute model compared to national development.
  const emphasizedTraits: [string, string] = ["SPEED", "FIREPOWER"];
  const [speed, firepower, maneuverability, toughness] = allocateAttributes(role, emphasizedTraits);

  // RNG-derived variation for production cost and work.
  const costVariation = Math.floor(rngStream.next() * 500);
  const workVariation = Math.floor(rngStream.next() * 300);

  const estimatedPerformance: Record<string, SafeInt> = {
    speed,
    firepower,
    maneuverability,
    toughness,
  };

  // Private proposal purchase price includes a premium (§11).
  const purchasePrice = SafeInt(1200 + costVariation);
  const productionWork = SafeInt(400 + workVariation);

  // Expiry is 12 months from current month.
  const expiryYear = Number(currentMonth.split("-")[0]) + 1;
  const expiryMonthPart = currentMonth.split("-")[1];
  const expiryMonth = `${expiryYear}-${expiryMonthPart}`;

  const proposalId = `private_${nationId}_${role}_${currentMonth}_${rngStream.next().toString(16)}`;

  const modelStub: AircraftModelDefinition = {
    aircraftModelId: "",
    aircraftType: role,
    ownerOrLicenseHolder: nationId,
    introductionMonth: "",
    speed,
    firepower,
    maneuverability,
    toughness,
    payloadCapacity: SafeInt(100),
    rangeClass: "MEDIUM",
    rangeDistance: SafeInt(300),
    eligibleRoleIds: [role],
    basingRequirementId: "LAND_BASED",
    carrierSuitable: false,
    technologyPrerequisiteIds: [],
    productionWork,
    unitCost: purchasePrice,
    maintenanceRequirement: SafeInt(50),
    crewRequirement: SafeInt(1),
    contentVersion: "aircraft_model_definition_v1",
    contentHash: "",
  };

  const proposal: AircraftProposal = {
    proposalId,
    sourceProjectId: "private_venture",
    proposedModel: modelStub,
    requestedRole: role,
    emphasizedTraits,
    developmentDurationMonths: SafeInt(0),
    developmentCost: SafeInt(0),
    productionCost: purchasePrice,
    productionWork,
    estimatedPerformance,
    expiryMonth,
    status: "PENDING",
    rulesetVersion: AIRCRAFT_RULESET_VERSION,
    formulaVersion: AIRCRAFT_FORMULA_VERSION,
    proposalHash: "",
  };

  proposal.proposalHash = computePrivateProposalHash(proposal);
  return proposal;
}

export function computePrivateProposalHash(proposal: AircraftProposal): string {
  const { proposalHash: _ph, ...rest } = proposal;
  const envelope = createEnvelope("private-aircraft-proposal", AIRCRAFT_RULESET_VERSION, rest);
  return envelope.bodyHash;
}

// ---- Monthly resolution ----

export interface ResolvePrivateVentureInput {
  nationId: string;
  currentMonth: string;
  hasPrivateAviationIndustry: boolean;
  permittedRoles: readonly AircraftType[];
  hasNationalProhibition: boolean;
  lastVentureMonth: string | null;
  privateProposals: readonly AircraftProposal[];
  rngStream: RandomStream;
}

export interface ResolvePrivateVentureOutput {
  event: PrivateAircraftVenture_v1;
  newProposal: AircraftProposal | null;
  updatedPrivateProposals: readonly AircraftProposal[];
}

export function resolvePrivateVenture(
  input: ResolvePrivateVentureInput,
): ResolvePrivateVentureOutput {
  const unexpiredCount = input.privateProposals.filter((p) => p.status === "PENDING").length;

  const eligibility = checkPrivateVentureEligibility({
    hasPrivateAviationIndustry: input.hasPrivateAviationIndustry,
    permittedRoles: input.permittedRoles,
    hasNationalProhibition: input.hasNationalProhibition,
    lastVentureMonth: input.lastVentureMonth,
    currentMonth: input.currentMonth,
    unexpiredPrivateProposalCount: unexpiredCount,
  });

  if (!eligibility.eligible) {
    return {
      event: createPrivateVentureEvent({
        nationId: input.nationId,
        month: input.currentMonth,
        role: null,
        result: "VENTURE_INELIGIBLE",
        proposalId: null,
        nextVentureMonth: null,
        reasonCode: eligibility.reason,
      }),
      newProposal: null,
      updatedPrivateProposals: input.privateProposals,
    };
  }

  // Use RNG to select a role from the sorted eligible roles.
  const roleIndex = Math.floor(input.rngStream.next() * eligibility.eligibleRoles.length);
  const selectedRole = eligibility.eligibleRoles[roleIndex]!;

  // Generate a private venture proposal.
  const proposal = generatePrivateVentureProposal({
    nationId: input.nationId,
    role: selectedRole,
    currentMonth: input.currentMonth,
    rngStream: input.rngStream,
  });

  // Compute the next eligible month (cooldown after current month).
  const nextYear = Number(input.currentMonth.split("-")[0]);
  const nextMonth = Number(input.currentMonth.split("-")[1]) + PRIVATE_VENTURE_COOLDOWN_MONTHS;
  const adjustedYear = nextYear + Math.floor((nextMonth - 1) / 12);
  const adjustedMonth = ((nextMonth - 1) % 12) + 1;
  const nextVentureMonth = `${adjustedYear}-${String(adjustedMonth).padStart(2, "0")}`;

  return {
    event: createPrivateVentureEvent({
      nationId: input.nationId,
      month: input.currentMonth,
      role: selectedRole,
      result: "VENTURE_GRANTED",
      proposalId: proposal.proposalId,
      nextVentureMonth,
      reasonCode: "VENTURE_GRANTED",
    }),
    newProposal: proposal,
    updatedPrivateProposals: [...input.privateProposals, proposal],
  };
}

// ---- Purchase command (§11) ----

export function purchasePrivateProposal(
  proposal: AircraftProposal,
  treasury: SafeInt,
  modelId: string,
  introductionMonth: string,
): { updatedProposal: AircraftProposal; model: AircraftModelDefinition; cost: SafeInt } {
  if (proposal.status !== "PENDING") {
    throw new BluewaveError(AIRCRAFT_PRIVATE_PROPOSAL_EXPIRED, {
      code: AIRCRAFT_PRIVATE_PROPOSAL_EXPIRED,
      proposalId: proposal.proposalId,
      status: proposal.status,
    });
  }

  if (treasury < proposal.productionCost) {
    throw new BluewaveError(AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT, {
      code: AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT,
      treasury: Number(treasury),
      cost: Number(proposal.productionCost),
    });
  }

  const def: AircraftModelDefinition = {
    aircraftModelId: modelId,
    aircraftType: proposal.requestedRole,
    ownerOrLicenseHolder: proposal.proposedModel.ownerOrLicenseHolder,
    introductionMonth,
    speed: proposal.estimatedPerformance.speed!,
    firepower: proposal.estimatedPerformance.firepower!,
    maneuverability: proposal.estimatedPerformance.maneuverability!,
    toughness: proposal.estimatedPerformance.toughness!,
    payloadCapacity: SafeInt(100),
    rangeClass: "MEDIUM",
    rangeDistance: SafeInt(300),
    eligibleRoleIds: [proposal.requestedRole],
    basingRequirementId: "LAND_BASED",
    carrierSuitable: false,
    technologyPrerequisiteIds: [],
    productionWork: proposal.productionWork,
    unitCost: proposal.productionCost,
    maintenanceRequirement: SafeInt(50),
    crewRequirement: SafeInt(1),
    contentVersion: "aircraft_model_definition_v1",
    contentHash: "",
  };

  return {
    updatedProposal: { ...proposal, status: "ACCEPTED" as const },
    model: withAircraftModelDefinitionContentHash(def),
    cost: proposal.productionCost,
  };
}

// ---- Expiry resolution (§12) ----

export function expirePrivateProposals(
  proposals: readonly AircraftProposal[],
  currentMonth: string,
): readonly AircraftProposal[] {
  return proposals.map((p) => {
    if (p.status !== "PENDING") {
      return p;
    }
    const expYear = Number(p.expiryMonth.split("-")[0]);
    const expMonth = Number(p.expiryMonth.split("-")[1]);
    const curYear = Number(currentMonth.split("-")[0]);
    const curMonth = Number(currentMonth.split("-")[1]);
    if (curYear > expYear || (curYear === expYear && curMonth >= expMonth)) {
      return { ...p, status: "EXPIRED" as const };
    }
    return p;
  });
}
