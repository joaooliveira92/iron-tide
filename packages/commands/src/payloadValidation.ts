import type { CampaignSnapshot } from "@bluewave/campaign";
import {
  APPROPRIATION_RATE_MAX_BP,
  APPROPRIATION_RATE_MIN_BP,
  RESEARCH_BUDGET_MAX,
  RESEARCH_BUDGET_MIN,
  canTransitionConstructionProject,
  constructionAccelerationAllowed,
  fleetMoveProblem,
  isTerminalConstructionProjectStatus,
  isShipOperational,
  monthlyRevenue,
  researchCap,
} from "@bluewave/campaign";
import {
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/content-schema";
import { validateDraftShape } from "@bluewave/ship-design";
import {
  validateAcceptPeace,
  validateBreakAlliance,
  validateBreakNap,
  validateDeclareBlockade,
  validateDeclareWar,
  validateFormAlliance,
  validateFormNap,
} from "./diplomacyValidation.js";
import {
  validateAddShipToDivision,
  validateAssignOfficer,
  validateChangeDivisionFlagship,
  validateCreateDivision,
  validateDissolveDivision,
  validateRelieveOfficer,
  validateRemoveShipFromDivision,
  validateChangeDivisionDoctrine,
  validateReorderDivisionShips,
} from "./divisionValidation.js";
import type { BudgetProjectCommand, CommandBody, CommandEnvelope } from "./envelope.js";
import { validateShipReadinessCommand } from "./readinessCommandValidation.js";
import { validateStationAssignment } from "./stationAssignmentValidation.js";
import type { LifecycleStepResult } from "./types.js";
import { rejectValidation } from "./validation.js";

export function validatePayloadRules(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  if (envelope.body.type === "SetResearchPriority")
    return validateSetResearchPriority(envelope, snapshot);
  if (envelope.body.type === "SetBudgetAllocation")
    return validateSetBudgetAllocation(envelope, snapshot);
  if (envelope.body.type === "AssignOfficer") return validateAssignOfficer(envelope, snapshot);
  if (envelope.body.type === "RelieveOfficer") return validateRelieveOfficer(envelope, snapshot);
  if (envelope.body.type === "SubmitDesign") return validateSubmitDesign(envelope, snapshot);
  if (envelope.body.type === "ReviseProject") return validateReviseProject(envelope, snapshot);
  if (envelope.body.type === "StartRebuild") return validateStartRebuild(envelope, snapshot);
  if (envelope.body.type === "MoveFleet") {
    const move = envelope.body;
    const problem = fleetMoveProblem(snapshot, move.nationId, move.fleetId, move.toAreaId);
    return problem === null
      ? { ok: true }
      : rejectValidation(envelope, snapshot, problem.code, problem.message);
  }
  if (envelope.body.type === "DeclareWar") return validateDeclareWar(envelope, snapshot);
  if (envelope.body.type === "AcceptPeace") return validateAcceptPeace(envelope, snapshot);
  if (envelope.body.type === "FormAlliance") return validateFormAlliance(envelope, snapshot);
  if (envelope.body.type === "BreakAlliance") return validateBreakAlliance(envelope, snapshot);
  if (envelope.body.type === "FormNonAggressionPact") return validateFormNap(envelope, snapshot);
  if (envelope.body.type === "BreakNonAggressionPact") return validateBreakNap(envelope, snapshot);
  if (envelope.body.type === "DeclareBlockade") return validateDeclareBlockade(envelope, snapshot);
  if (envelope.body.type === "CreateDivision") return validateCreateDivision(envelope, snapshot);
  if (envelope.body.type === "AddShipToDivision")
    return validateAddShipToDivision(envelope, snapshot);
  if (envelope.body.type === "RemoveShipFromDivision")
    return validateRemoveShipFromDivision(envelope, snapshot);
  if (envelope.body.type === "DissolveDivision")
    return validateDissolveDivision(envelope, snapshot);
  if (envelope.body.type === "ChangeDivisionFlagship")
    return validateChangeDivisionFlagship(envelope, snapshot);
  if (envelope.body.type === "ReorderDivisionShips")
    return validateReorderDivisionShips(envelope, snapshot);
  if (envelope.body.type === "ChangeDivisionDoctrine")
    return validateChangeDivisionDoctrine(envelope, snapshot);
  if (envelope.body.type === "AssignForeignStation")
    return validateStationAssignment(envelope, snapshot, "assign");
  if (envelope.body.type === "ClearForeignStation")
    return validateStationAssignment(envelope, snapshot, "clear");
  if (envelope.body.type === "SetShipReadiness")
    return validateShipReadinessCommand(envelope, snapshot);
  if (envelope.body.type === "HaltConstruction")
    return validateDockyardStatusCommand(envelope, snapshot, "HaltConstruction");
  if (envelope.body.type === "ResumeConstruction")
    return validateDockyardStatusCommand(envelope, snapshot, "ResumeConstruction");
  if (envelope.body.type === "SetAcceleration") return validateSetAcceleration(envelope, snapshot);
  if (envelope.body.type === "CancelConstructionProject")
    return validateCancelConstructionProject(envelope, snapshot);
  if (envelope.body.type === "OrderConstruction")
    return validateOrderConstruction(envelope, snapshot);
  if (envelope.body.type === "AuthorizeDockExpansion")
    return validateAuthorizeDockExpansion(envelope, snapshot);
  if (envelope.body.type === "OrderForeignConstruction")
    return validateOrderForeignConstruction(envelope, snapshot);
  if (envelope.body.type !== "budget_project") {
    return rejectValidation(
      envelope,
      snapshot,
      "UNKNOWN_COMMAND_TYPE",
      `Unknown command type: ${String((envelope.body as CommandBody).type)}`,
    );
  }
  const body = envelope.body as BudgetProjectCommand;
  if (typeof body.nationId !== "string" || body.nationId.length === 0)
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_NATION_ID",
      "nationId must be a non-empty string",
    );
  if (typeof body.projectId !== "string" || body.projectId.length === 0)
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_PROJECT_ID",
      "projectId must be a non-empty string",
    );
  return { ok: true };
}

const DOCKYARD_STATUS_TRANSITION_REJECTION = "INVALID_DOCKYARD_PROJECT_TRANSITION";
const DOCKYARD_PROJECT_REJECTION = "INVALID_DOCKYARD_PROJECT";
const FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE = "FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE";

function validateDockyardStatusCommand(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
  kind: "HaltConstruction" | "ResumeConstruction",
): LifecycleStepResult {
  const body = envelope.body as Extract<
    CommandBody,
    { type: "HaltConstruction" | "ResumeConstruction" }
  >;
  const reject = (code: string, message: string): LifecycleStepResult =>
    rejectValidation(envelope, snapshot, code, message);
  const nation = snapshot.nations.get(body.nationId);
  if (!nation) return reject("INVALID_NATION_ID", `Nation ${body.nationId} not found`);
  const project = nation.constructionProjects.find((p) => p.id === body.projectId);
  if (!project)
    return reject(
      DOCKYARD_PROJECT_REJECTION,
      `Project ${body.projectId} is not ${body.nationId}'s`,
    );
  if (isTerminalConstructionProjectStatus(project.status))
    return reject(
      DOCKYARD_STATUS_TRANSITION_REJECTION,
      `Project ${body.projectId} is ${project.status} and cannot be steered`,
    );
  if (kind === "HaltConstruction") {
    if (project.status !== "HALTED" && !canTransitionConstructionProject(project.status, "HALTED"))
      return reject(
        DOCKYARD_STATUS_TRANSITION_REJECTION,
        `Project ${body.projectId} cannot be halted from ${project.status}`,
      );
  } else if (
    project.status !== "ACTIVE" &&
    !canTransitionConstructionProject(project.status, "ACTIVE") &&
    !canTransitionConstructionProject(project.status, "AWAITING_CAPACITY")
  )
    return reject(
      DOCKYARD_STATUS_TRANSITION_REJECTION,
      `Project ${body.projectId} cannot be resumed from ${project.status}`,
    );
  return { ok: true };
}

const ACCELERATION_NOT_ALLOWED = "ACCELERATION_NOT_ALLOWED";

function validateSetAcceleration(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as Extract<CommandBody, { type: "SetAcceleration" }>;
  const reject = (code: string, message: string): LifecycleStepResult =>
    rejectValidation(envelope, snapshot, code, message);
  if (typeof body.accelerated !== "boolean")
    return reject("INVALID_COMMAND_PAYLOAD", "accelerated must be a boolean");
  const nation = snapshot.nations.get(body.nationId);
  if (!nation) return reject("INVALID_NATION_ID", `Nation ${body.nationId} not found`);
  const project = nation.constructionProjects.find((p) => p.id === body.projectId);
  if (!project)
    return reject(
      DOCKYARD_PROJECT_REJECTION,
      `Project ${body.projectId} is not ${body.nationId}'s`,
    );
  if (isTerminalConstructionProjectStatus(project.status))
    return reject(
      DOCKYARD_STATUS_TRANSITION_REJECTION,
      `Project ${body.projectId} is ${project.status} and cannot be steered`,
    );
  if (project.foreignContractId !== undefined)
    return reject(
      FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE,
      `Project ${body.projectId} is a foreign contract order funded by its instalment schedule and cannot be accelerated`,
    );
  if (body.accelerated && !constructionAccelerationAllowed(project.projectType))
    return reject(
      ACCELERATION_NOT_ALLOWED,
      `Project ${body.projectId} is a ${project.projectType} project and cannot be accelerated`,
    );
  if (project.status !== "ACTIVE" && project.status !== "ACCELERATED")
    return reject(
      DOCKYARD_STATUS_TRANSITION_REJECTION,
      `Project ${body.projectId} cannot change acceleration from ${project.status}`,
    );
  return { ok: true };
}

const CONSTRUCTION_BATCH_MIN_QUANTITY = 1;
const CONSTRUCTION_BATCH_MAX_QUANTITY = 12;
const CONSTRUCTION_BATCH_LIMIT_EXCEEDED = "CONSTRUCTION_BATCH_LIMIT_EXCEEDED";

function validateCancelConstructionProject(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as Extract<CommandBody, { type: "CancelConstructionProject" }>;
  const reject = (code: string, message: string): LifecycleStepResult =>
    rejectValidation(envelope, snapshot, code, message);
  const nation = snapshot.nations.get(body.nationId);
  if (!nation) return reject("INVALID_NATION_ID", `Nation ${body.nationId} not found`);
  const project = nation.constructionProjects.find((p) => p.id === body.projectId);
  if (!project)
    return reject(
      DOCKYARD_PROJECT_REJECTION,
      `Project ${body.projectId} is not ${body.nationId}'s`,
    );
  if (isTerminalConstructionProjectStatus(project.status))
    return reject(
      DOCKYARD_STATUS_TRANSITION_REJECTION,
      `Project ${body.projectId} is ${project.status} and cannot be cancelled`,
    );
  if (project.foreignContractId !== undefined)
    return reject(
      FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE,
      `Project ${body.projectId} is a foreign contract order; its cancellation is a contract outcome`,
    );
  return { ok: true };
}

function validateOrderConstruction(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as Extract<CommandBody, { type: "OrderConstruction" }>;
  const reject = (code: string, message: string): LifecycleStepResult =>
    rejectValidation(envelope, snapshot, code, message);
  if (typeof body.nationId !== "string" || body.nationId.length === 0)
    return reject("INVALID_NATION_ID", "nationId must be a non-empty string");
  const nation = snapshot.nations.get(body.nationId);
  if (!nation) return reject("INVALID_NATION_ID", `Nation ${body.nationId} not found`);
  if (
    !Number.isInteger(body.quantity) ||
    body.quantity < 1 ||
    body.quantity > CONSTRUCTION_BATCH_MAX_QUANTITY
  )
    return reject(
      CONSTRUCTION_BATCH_LIMIT_EXCEEDED,
      `A class order is 1..${String(CONSTRUCTION_BATCH_MAX_QUANTITY)} ships; got ${String(body.quantity)}`,
    );
  const design = snapshot.designs.get(body.designVersionId);
  if (!design) return reject("UNKNOWN_DESIGN", `No design ${body.designVersionId} in the snapshot`);
  if (design.nationId !== body.nationId)
    return reject(
      "DESIGN_NOT_FOR_PLAYER",
      `Design ${body.designVersionId} belongs to ${design.nationId}, not ${body.nationId}`,
    );
  return { ok: true };
}

function validateAuthorizeDockExpansion(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as Extract<CommandBody, { type: "AuthorizeDockExpansion" }>;
  const reject = (code: string, message: string): LifecycleStepResult =>
    rejectValidation(envelope, snapshot, code, message);
  if (typeof body.nationId !== "string" || body.nationId.length === 0)
    return reject("INVALID_NATION_ID", "nationId must be a non-empty string");
  if (!snapshot.nations.has(body.nationId))
    return reject("INVALID_NATION_ID", `Nation ${body.nationId} not found`);
  if (typeof body.possessionId !== "string" || body.possessionId.length === 0)
    return reject("INVALID_COMMAND_PAYLOAD", "possessionId must be a non-empty string");
  return { ok: true };
}

function validateOrderForeignConstruction(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as Extract<CommandBody, { type: "OrderForeignConstruction" }>;
  const reject = (code: string, message: string): LifecycleStepResult =>
    rejectValidation(envelope, snapshot, code, message);
  if (typeof body.nationId !== "string" || body.nationId.length === 0)
    return reject("INVALID_NATION_ID", "nationId must be a non-empty string");
  if (!snapshot.nations.has(body.nationId))
    return reject("INVALID_NATION_ID", `Nation ${body.nationId} not found`);
  const design = snapshot.designs.get(body.designVersionId);
  if (!design) return reject("UNKNOWN_DESIGN", `No design ${body.designVersionId} in the snapshot`);
  if (design.nationId !== body.nationId)
    return reject(
      "DESIGN_NOT_FOR_PLAYER",
      `Design ${body.designVersionId} belongs to ${design.nationId}, not ${body.nationId}`,
    );
  if (
    typeof body.builderNationId !== "string" ||
    body.builderNationId === body.nationId ||
    !snapshot.nations.has(body.builderNationId)
  )
    return reject(
      "FOREIGN_BUILDER_NATION_INVALID",
      `Builder ${String(body.builderNationId)} is not a distinct nation in the campaign`,
    );
  if (
    !Number.isInteger(body.quantity) ||
    body.quantity < CONSTRUCTION_BATCH_MIN_QUANTITY ||
    body.quantity > CONSTRUCTION_BATCH_MAX_QUANTITY
  )
    return reject(
      "FOREIGN_CONSTRUCTION_QUANTITY_INVALID",
      `A foreign order is 1..${String(CONSTRUCTION_BATCH_MAX_QUANTITY)} ships; got ${String(body.quantity)}`,
    );
  return { ok: true };
}

function validateSetResearchPriority(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as Extract<CommandBody, { type: "SetResearchPriority" }>;
  if (typeof body.nationId !== "string" || body.nationId.length === 0)
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_NATION_ID",
      "nationId must be a non-empty string",
    );
  if (body.exactTechId !== undefined && typeof body.exactTechId === "string") {
    return rejectValidation(
      envelope,
      snapshot,
      "EXACT_TECHNOLOGY_SELECTION_PROHIBITED",
      `Exact technology selection is prohibited: ${body.exactTechId}`,
    );
  }
  const priorities = body.fieldPriorities ?? {};
  const missingFields = CANONICAL_RESEARCH_FIELD_IDS.filter((f) => priorities[f] === undefined);
  const validWeights = new Set<number>([
    RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
    RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM,
    RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW,
  ]);
  const invalidWeightFields = CANONICAL_RESEARCH_FIELD_IDS.filter(
    (f) => priorities[f] !== undefined && !validWeights.has(priorities[f] as number),
  );
  const highCount = CANONICAL_RESEARCH_FIELD_IDS.filter(
    (f) => priorities[f] === RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
  ).length;
  if (
    missingFields.length > 0 ||
    invalidWeightFields.length > 0 ||
    highCount < 1 ||
    highCount > MAX_HIGH_PRIORITY_FIELDS
  ) {
    return rejectValidation(
      envelope,
      snapshot,
      "RESEARCH_PRIORITY_CONSTRAINT_VIOLATED",
      `Invalid field priorities: missing=${missingFields.join(",")} invalidWeight=${invalidWeightFields.join(",")} highCount=${String(highCount)}`,
    );
  }
  return { ok: true };
}

function validateSetBudgetAllocation(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as Extract<CommandBody, { type: "SetBudgetAllocation" }>;
  const reject = (code: string, message: string): LifecycleStepResult =>
    rejectValidation(envelope, snapshot, code, message);
  if (typeof body.nationId !== "string" || body.nationId.length === 0)
    return reject("INVALID_NATION_ID", "nationId must be a non-empty string");
  if (!snapshot.nations.has(body.nationId))
    return reject("INVALID_NATION_ID", `Nation ${body.nationId} not found`);
  const rate = body.appropriationRateBp as number;
  if (
    !Number.isSafeInteger(rate) ||
    rate < APPROPRIATION_RATE_MIN_BP ||
    rate > APPROPRIATION_RATE_MAX_BP
  )
    return reject(
      "INVALID_COMMAND_PAYLOAD",
      `appropriationRateBp must be an integer in ${String(APPROPRIATION_RATE_MIN_BP)}..${String(APPROPRIATION_RATE_MAX_BP)}`,
    );
  const research = body.researchBudget as number;
  if (
    !Number.isSafeInteger(research) ||
    research < RESEARCH_BUDGET_MIN ||
    research > RESEARCH_BUDGET_MAX
  )
    return reject(
      "INVALID_COMMAND_PAYLOAD",
      `researchBudget must be an integer in ${String(RESEARCH_BUDGET_MIN)}..${String(RESEARCH_BUDGET_MAX)}`,
    );
  const cap = researchCap(
    monthlyRevenue(snapshot.nations.get(body.nationId)!.baseResources, body.appropriationRateBp),
  ) as number;
  if (research > cap)
    return reject(
      "RESEARCH_ABOVE_CAP",
      `researchBudget ${String(research)} exceeds the cap of ${String(cap)} (12% of the monthly appropriation at ${String(rate)} bp)`,
    );
  return { ok: true };
}

function validateStartRebuild(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as Extract<CommandBody, { type: "StartRebuild" }>;
  const reject = (code: string, message: string) =>
    rejectValidation(envelope, snapshot, code, message);
  const nation = snapshot.nations.get(body.nationId);
  if (!nation) return reject("INVALID_NATION_ID", `Nation ${body.nationId} not found`);
  const ship = nation.fleets.flatMap((f) => f.ships).find((s) => s.id === body.shipId);
  if (!ship)
    return reject("INVALID_COMMAND_PAYLOAD", `Ship ${body.shipId} is not ${body.nationId}'s`);
  if (!isShipOperational(ship))
    return reject(
      "SHIP_NOT_OPERATIONAL",
      `Ship ${body.shipId} is under construction or already unavailable and cannot be rebuilt`,
    );
  if (ship.inBattleId !== undefined)
    return reject(
      "INVALID_COMMAND_PAYLOAD",
      `Ship ${body.shipId} is in a battle and cannot be rebuilt`,
    );
  for (const [label, id] of [
    ["Design", body.newDesignVersionId],
    ["Project", body.projectId],
  ] as const)
    if (!/^[a-z][a-z0-9_-]{1,63}$/.test(id))
      return reject(
        "INVALID_COMMAND_PAYLOAD",
        `${label} id must be lower snake_case (2-64 characters)`,
      );
  if (snapshot.designs.has(body.newDesignVersionId))
    return reject("INVALID_COMMAND_PAYLOAD", `Design ${body.newDesignVersionId} already exists`);
  if (nation.constructionProjects.some((p) => p.id === body.projectId))
    return reject("INVALID_COMMAND_PAYLOAD", `Project ${body.projectId} already exists`);
  if (snapshot.designs.get(ship.designVersionId)?.sourceDraft === undefined)
    return reject(
      "INVALID_COMMAND_PAYLOAD",
      `Ship ${body.shipId} was built from an authored design with no source draft and cannot be rebuilt`,
    );
  const problems = validateDraftShape(body.draft);
  if (problems.length > 0)
    return reject("INVALID_COMMAND_PAYLOAD", `Design draft is malformed: ${problems.join("; ")}`);
  if ((body.draft as { nationId?: unknown }).nationId !== body.nationId)
    return reject("INVALID_COMMAND_PAYLOAD", "The draft belongs to a different nation");
  if (body.rebuildKind !== undefined && body.rebuildKind !== "BULGE")
    return reject("INVALID_COMMAND_PAYLOAD", "rebuildKind must be BULGE when given");
  return { ok: true };
}

function validateReviseProject(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as Extract<CommandBody, { type: "ReviseProject" }>;
  const nation = snapshot.nations.get(body.nationId);
  if (!nation)
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_NATION_ID",
      `Nation ${body.nationId} not found`,
    );
  const project = nation.constructionProjects.find((p) => p.id === body.projectId);
  if (!project)
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      `Project ${body.projectId} not found`,
    );
  if (project.foreignContractId !== undefined)
    return rejectValidation(
      envelope,
      snapshot,
      FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE,
      `Project ${body.projectId} is a foreign contract order funded by its instalment schedule and cannot be revised`,
    );
  if (project.status === "COMPLETED")
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      `Project ${body.projectId} is complete and cannot be revised`,
    );
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(body.newDesignVersionId))
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      "Design id must be lower snake_case (2-64 characters)",
    );
  if (snapshot.designs.has(body.newDesignVersionId))
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      `Design ${body.newDesignVersionId} already exists`,
    );
  if (snapshot.designs.get(project.designVersionId)?.sourceDraft === undefined)
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      `Project ${body.projectId} was built from an authored design with no source draft and cannot be revised`,
    );
  const problems = validateDraftShape(body.draft);
  if (problems.length > 0)
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      `Design draft is malformed: ${problems.join("; ")}`,
    );
  if ((body.draft as { nationId?: unknown }).nationId !== body.nationId)
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      "The draft belongs to a different nation",
    );
  return { ok: true };
}

function validateSubmitDesign(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as Extract<CommandBody, { type: "SubmitDesign" }>;
  if (!snapshot.nations.has(body.nationId))
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_NATION_ID",
      `Nation ${body.nationId} not found`,
    );
  const idPattern = /^[a-z][a-z0-9_]{1,63}$/;
  if (!idPattern.test(body.designVersionId) || !idPattern.test(body.designFamilyId))
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      "Design and family ids must be lower snake_case (2-64 characters)",
    );
  if (
    body.className.trim() === "" ||
    body.hullType.trim() === "" ||
    body.machineryType.trim() === ""
  )
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      "className, hullType and machineryType are required",
    );
  if (snapshot.designs.has(body.designVersionId))
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      `Design ${body.designVersionId} already exists`,
    );
  const problems = validateDraftShape(body.draft);
  if (problems.length > 0)
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      `Design draft is malformed: ${problems.join("; ")}`,
    );
  if ((body.draft as { nationId?: unknown }).nationId !== body.nationId)
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      "The draft belongs to a different nation",
    );
  return { ok: true };
}
