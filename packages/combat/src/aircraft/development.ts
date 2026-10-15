// DESIGN-43 §§4-10 development pipeline.
// INC-3: request command, one-active-proposal slot, project lifecycle,
// proposal generation (keyed RNG), attribute allocation, acceptance/rejection.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  AIRCRAFT_FORMULA_VERSION,
  AIRCRAFT_RULESET_VERSION,
  AIRCRAFT_TYPES,
  type AircraftProjectStatus,
  type AircraftType,
} from "./constants.js";
import {
  AIRCRAFT_DEVELOPMENT_ROLE_INVALID,
  AIRCRAFT_PROPOSAL_ALREADY_ACTIVE,
} from "./reasonCodes.js";
import type { AircraftDevelopmentProject } from "./state.js";
import {
  computeDevelopmentDuration,
  computeMonthlyCost,
  designStreamKey,
} from "./development-duration.js";

export const ACTIVE_STATUSES: AircraftProjectStatus[] = [
  "REQUESTED",
  "DEVELOPING",
  "READY_FOR_REVIEW",
];

export function assertValidDevelopmentRole(role: string): asserts role is AircraftType {
  if (!(AIRCRAFT_TYPES as readonly string[]).includes(role)) {
    throw new BluewaveError(AIRCRAFT_DEVELOPMENT_ROLE_INVALID, {
      code: AIRCRAFT_DEVELOPMENT_ROLE_INVALID,
      role,
    });
  }
}

export function assertNoActiveProposal(projects: readonly AircraftDevelopmentProject[]): void {
  for (const p of projects) {
    if ((ACTIVE_STATUSES as readonly string[]).includes(p.status)) {
      throw new BluewaveError(AIRCRAFT_PROPOSAL_ALREADY_ACTIVE, {
        code: AIRCRAFT_PROPOSAL_ALREADY_ACTIVE,
        existingProjectId: p.developmentProjectId,
        existingStatus: p.status,
      });
    }
  }
}

export function createDevelopmentProject(
  nationId: string,
  role: AircraftType,
  emphasizedTraits: [string, string],
  basingClass: string,
  startMonth: string,
  techInputHash: string,
  nationalTraitInputHash: string,
  roleComplexity: number,
  technologyLevel: number,
  industryCapacity: number,
  treasury: SafeInt,
): { project: AircraftDevelopmentProject; monthlyCost: SafeInt } {
  assertValidDevelopmentRole(role);

  const duration = computeDevelopmentDuration({
    roleComplexity,
    technologyLevel,
    industryCapacity,
  });
  const monthlyCost = computeMonthlyCost(duration);
  if (treasury < monthlyCost) {
    throw new BluewaveError("AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT", {
      code: "AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT",
      treasury: Number(treasury),
      monthlyCost: Number(monthlyCost),
    });
  }

  const streamKey = designStreamKey(nationId, role);
  const developmentProjectId = `${nationId}_${role}_${startMonth}`;

  const project: AircraftDevelopmentProject = {
    developmentProjectId,
    requestedRole: role,
    emphasizedTraits,
    basingClass,
    startMonth,
    requiredDevelopmentMonths: duration,
    completedPaidMonths: SafeInt(0),
    monthlyCost,
    technologyInputHash: techInputHash,
    nationalTraitInputHash: nationalTraitInputHash,
    designStreamKey: streamKey,
    status: "REQUESTED",
    finalProposalId: null,
    rulesetVersion: AIRCRAFT_RULESET_VERSION,
    formulaVersion: AIRCRAFT_FORMULA_VERSION,
    projectHash: "",
  };

  project.projectHash = computeDevelopmentProjectHash(project);
  return { project, monthlyCost };
}

export function computeDevelopmentProjectHash(project: AircraftDevelopmentProject): string {
  const { projectHash: _projectHash, ...rest } = project;
  const envelope = createEnvelope("aircraft-development-project", AIRCRAFT_RULESET_VERSION, rest);
  return envelope.bodyHash;
}

export function advanceAircraftDevelopment(
  project: AircraftDevelopmentProject,
  paidThisMonth: boolean,
): AircraftDevelopmentProject {
  if (
    project.status === "CANCELLED" ||
    project.status === "ACCEPTED" ||
    project.status === "REJECTED"
  ) {
    return project;
  }

  const nextMonths = paidThisMonth
    ? SafeInt.add(project.completedPaidMonths, SafeInt.ONE)
    : project.completedPaidMonths;

  let newStatus: AircraftProjectStatus;
  if (nextMonths >= project.requiredDevelopmentMonths) {
    newStatus = "READY_FOR_REVIEW";
  } else if (paidThisMonth) {
    newStatus = "DEVELOPING";
  } else {
    newStatus = project.status === "REQUESTED" ? "REQUESTED" : "DELAYED";
  }

  return {
    ...project,
    completedPaidMonths: nextMonths,
    status: newStatus,
  };
}
