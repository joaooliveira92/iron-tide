import { AiPhaseExecutor } from "@bluewave/ai";
import { researchPriorityAllocation } from "@bluewave/ship-design";
import { TENSION_ALLIANCE, TENSION_PEACE } from "@bluewave/campaign";
import {
  type AcceptPeaceCommand,
  type AssignOfficerCommand,
  type AuthorizeDockExpansionCommand,
  type BreakAllianceCommand,
  type BreakNonAggressionPactCommand,
  type BudgetProjectCommand,
  type CancelConstructionProjectCommand,
  type CommandBody,
  CommandIdempotencyMap,
  type DeclareBlockadeCommand,
  type DeclareWarCommand,
  type FormAllianceCommand,
  type FormNonAggressionPactCommand,
  type HaltConstructionCommand,
  type MoveFleetCommand,
  type OrderConstructionCommand,
  type OrderForeignConstructionCommand,
  type RelieveOfficerCommand,
  type ResumeConstructionCommand,
  type SetAccelerationCommand,
  type SetBudgetAllocationCommand,
  type SetResearchPriorityCommand,
  type ReviseProjectCommand,
  type StartRebuildCommand,
  type SubmitDesignCommand,
} from "@bluewave/commands";
import {
  applyAuthorizeDockExpansion,
  applyBudgetProject,
  applyDivisionCommandMonth,
  applyHaltConstruction,
  applyMoveFleet,
  applyOfficerCommand,
  applyOrderConstruction,
  applyOrderForeignConstruction,
  applyResumeConstruction,
  applySetAcceleration,
  applySetBudgetAllocation,
  applySetResearchPriority,
  applySubmitDesign,
} from "./commands.js";
import {
  applyAcceptPeace,
  applyDeclareBlockade,
  applyDeclareWar,
  applySetNap,
  applySetRelation,
} from "./diplomacy.js";
import type { MonthContext } from "./monthContext.js";
import type { PhaseDescriptor } from "./registry.js";
import { PhaseResource } from "./phase-resource.js";
import { applyReviseProject } from "./reviseProject.js";
import { applyStartRebuild } from "./startRebuild.js";
import { applyStationAssignmentCommand } from "./stationAssignment.js";
import { applyCancelConstructionProject } from "./cancelConstructionProject.js";
import { constructionProjectCancelledEvent } from "./events.js";

export function runCommandCollectionPhase(ctx: MonthContext): void {
  const slot = ctx.slots[0];
  if (!slot) return;

  for (const cmd of ctx.commands) {
    const outcome = ctx.lifecycle.process(
      cmd,
      ctx.sourceSnapshot,
      slot,
      new CommandIdempotencyMap(),
    );
    ctx.commandLedger.add(outcome);

    if (outcome["type"] !== "success") continue;
    applyPlayerCommand(ctx, cmd["body"], cmd["commandId"]);
  }
}

function applyPlayerCommand(ctx: MonthContext, body: CommandBody, commandId: string): void {
  if (applyAdministrativeCommand(ctx, body)) return;
  if (applyDiplomacyCommand(ctx, body)) return;
  if (applyDivisionCommand(ctx, body)) return;
  if (applyStationAssignmentCommand(ctx, body)) return;
  applyConstructionCommand(ctx, body, commandId);
}

function applyAdministrativeCommand(ctx: MonthContext, body: CommandBody): boolean {
  const { campaignMonth, collector } = ctx;

  if (body["type"] === "SetResearchPriority") {
    const priorityBody = body as SetResearchPriorityCommand;
    ctx.currentSnapshot = applySetResearchPriority(
      ctx.currentSnapshot,
      priorityBody["nationId"],
      priorityBody["fieldPriorities"],
      collector,
    );
    return true;
  }

  if (body["type"] === "AssignOfficer" || body["type"] === "RelieveOfficer") {
    ctx.currentSnapshot = applyOfficerCommand(
      ctx.currentSnapshot,
      body as AssignOfficerCommand | RelieveOfficerCommand,
      campaignMonth,
      collector,
    );
    return true;
  }

  if (body["type"] === "SubmitDesign") {
    ctx.currentSnapshot = applySubmitDesign(
      ctx.currentSnapshot,
      body as SubmitDesignCommand,
      ctx.engineOptions?.shipBuilding,
      campaignMonth,
      collector,
    );
    return true;
  }

  if (body["type"] === "ReviseProject") {
    ctx.currentSnapshot = applyReviseProject(
      ctx.currentSnapshot,
      body as ReviseProjectCommand,
      ctx.engineOptions?.shipBuilding,
      campaignMonth,
      collector,
    );
    return true;
  }

  if (body["type"] === "StartRebuild") {
    ctx.currentSnapshot = applyStartRebuild(
      ctx.currentSnapshot,
      body as StartRebuildCommand,
      ctx.engineOptions?.shipBuilding,
      campaignMonth,
      collector,
    );
    return true;
  }

  if (body["type"] === "MoveFleet") {
    ctx.currentSnapshot = applyMoveFleet(ctx.currentSnapshot, body as MoveFleetCommand, collector);
    return true;
  }

  if (body["type"] === "SetBudgetAllocation") {
    ctx.currentSnapshot = applySetBudgetAllocation(
      ctx.currentSnapshot,
      body as SetBudgetAllocationCommand,
      collector,
    );
    return true;
  }

  return false;
}

function applyDiplomacyCommand(ctx: MonthContext, body: CommandBody): boolean {
  const { campaignMonth } = ctx;

  if (body["type"] === "DeclareWar") {
    ctx.currentSnapshot = applyDeclareWar(
      ctx.currentSnapshot,
      body as DeclareWarCommand,
      campaignMonth,
    );
    return true;
  }

  if (body["type"] === "AcceptPeace") {
    ctx.currentSnapshot = applyAcceptPeace(
      ctx.currentSnapshot,
      body as AcceptPeaceCommand,
      campaignMonth,
    );
    return true;
  }

  if (body["type"] === "FormAlliance") {
    ctx.currentSnapshot = applySetRelation(
      ctx.currentSnapshot,
      (body as FormAllianceCommand)["nationId"],
      (body as FormAllianceCommand)["partnerNationId"],
      "allied",
      TENSION_ALLIANCE,
    );
    return true;
  }

  if (body["type"] === "BreakAlliance") {
    ctx.currentSnapshot = applySetRelation(
      ctx.currentSnapshot,
      (body as BreakAllianceCommand)["nationId"],
      (body as BreakAllianceCommand)["partnerNationId"],
      "neutral",
      TENSION_PEACE,
    );
    return true;
  }

  if (body["type"] === "FormNonAggressionPact") {
    ctx.currentSnapshot = applySetNap(
      ctx.currentSnapshot,
      (body as FormNonAggressionPactCommand)["nationId"],
      (body as FormNonAggressionPactCommand)["partnerNationId"],
      true,
    );
    return true;
  }

  if (body["type"] === "BreakNonAggressionPact") {
    ctx.currentSnapshot = applySetNap(
      ctx.currentSnapshot,
      (body as BreakNonAggressionPactCommand)["nationId"],
      (body as BreakNonAggressionPactCommand)["partnerNationId"],
      false,
    );
    return true;
  }

  if (body["type"] === "DeclareBlockade") {
    ctx.currentSnapshot = applyDeclareBlockade(
      ctx.currentSnapshot,
      body as DeclareBlockadeCommand,
      campaignMonth,
    );
    return true;
  }

  return false;
}

function applyDivisionCommand(ctx: MonthContext, body: CommandBody): boolean {
  if (
    body["type"] === "CreateDivision" ||
    body["type"] === "AddShipToDivision" ||
    body["type"] === "RemoveShipFromDivision" ||
    body["type"] === "DissolveDivision" ||
    body["type"] === "ChangeDivisionFlagship" ||
    body["type"] === "ReorderDivisionShips"
  ) {
    ctx.currentSnapshot = applyDivisionCommandMonth(
      ctx.currentSnapshot,
      body,
      ctx.campaignMonth,
      ctx.collector,
    );
    return true;
  }
  return false;
}

function applyConstructionCommand(ctx: MonthContext, body: CommandBody, commandId: string): void {
  const { campaignMonth, turnNumber, financialLedger, eventLedger, collector } = ctx;

  if (body["type"] === "OrderConstruction") {
    ctx.currentSnapshot = applyOrderConstruction(
      ctx.currentSnapshot,
      body as OrderConstructionCommand,
      commandId,
      ctx.engineOptions?.shipBuilding,
      campaignMonth,
      collector,
    );
    return;
  }

  if (body["type"] === "AuthorizeDockExpansion") {
    ctx.currentSnapshot = applyAuthorizeDockExpansion(
      ctx.currentSnapshot,
      body as AuthorizeDockExpansionCommand,
      campaignMonth,
      collector,
    );
    return;
  }

  if (body["type"] === "OrderForeignConstruction") {
    ctx.currentSnapshot = applyOrderForeignConstruction(
      ctx.currentSnapshot,
      body as OrderForeignConstructionCommand,
      commandId,
      ctx.engineOptions?.shipBuilding,
      campaignMonth,
      collector,
    );
    return;
  }

  if (body["type"] === "HaltConstruction") {
    ctx.currentSnapshot = applyHaltConstruction(
      ctx.currentSnapshot,
      body as HaltConstructionCommand,
      collector,
    );
    return;
  }

  if (body["type"] === "ResumeConstruction") {
    ctx.currentSnapshot = applyResumeConstruction(
      ctx.currentSnapshot,
      body as ResumeConstructionCommand,
      collector,
    );
    return;
  }

  if (body["type"] === "SetAcceleration") {
    ctx.currentSnapshot = applySetAcceleration(
      ctx.currentSnapshot,
      body as SetAccelerationCommand,
      collector,
    );
    return;
  }

  if (body["type"] === "CancelConstructionProject") {
    const outcome = applyCancelConstructionProject(
      ctx.currentSnapshot,
      body as CancelConstructionProjectCommand,
      collector,
    );
    ctx.currentSnapshot = outcome.snapshot;
    if (outcome.cancelled !== null && outcome.projectType !== null) {
      const settlement = outcome.cancelled;
      eventLedger.append(
        constructionProjectCancelledEvent(
          (body as CancelConstructionProjectCommand)["projectId"],
          (body as CancelConstructionProjectCommand)["nationId"],
          outcome.projectType,
          settlement.consumedWork,
          settlement.refundedAmount,
          settlement.lostAmount,
          settlement.salvageableAmount,
          settlement.reason,
          ctx.nextSeq(),
          campaignMonth,
        ),
      );
    }
    return;
  }

  if (body["type"] !== "budget_project") {
    collector.addError("UNKNOWN_COMMAND_TYPE", `Unknown command type: ${String(body["type"])}`, {
      stage: "command-collection",
    });
    return;
  }

  const nation = ctx.currentSnapshot["nations"].get(body["nationId"]);
  if (!nation) {
    collector.addError("NATION_NOT_FOUND", `Nation ${body["nationId"]} not found`, {
      stage: "command-collection",
    });
    return;
  }

  const project = nation["constructionProjects"].find((p) => p["id"] === body["projectId"]);
  if (!project) {
    collector.addError("PROJECT_NOT_FOUND", `Project ${body["projectId"]} not found`, {
      stage: "command-collection",
    });
    return;
  }

  ctx.currentSnapshot = applyBudgetProject(
    ctx.currentSnapshot,
    body,
    campaignMonth,
    turnNumber,
    ctx.nextSeq,
    financialLedger,
    eventLedger,
    collector,
  );
}

export function runAiPlanningPhase(ctx: MonthContext): void {
  const { campaignMonth, turnNumber, financialLedger, eventLedger, collector } = ctx;

  const idempotencyMap = new CommandIdempotencyMap();
  const aiExecutor = new AiPhaseExecutor();
  const aiEngine = ctx.phaseGuard.rng("ai_planning", ctx.randomSeed)!;
  const shipBuilding = ctx.engineOptions?.shipBuilding;
  for (const slot of ctx.slots) {
    if (slot["type"] !== "ai") continue;
    const nationId = slot["nationId"];
    let researchAllocation: Record<string, number> | undefined;
    const profile = shipBuilding?.navalProfileFor(nationId, ctx.campaignMonth) ?? null;
    if (profile !== null) {
      researchAllocation = {
        ...researchPriorityAllocation(profile, {}, `${ctx.randomSeed}:research:${nationId}`)
          .fieldPriorities,
      };
    }
    const { commands, diagnostics } = aiExecutor.run(
      slot,
      ctx.currentSnapshot,
      aiEngine,
      ctx.lifecycle,
      idempotencyMap,
      researchAllocation,
    );
    for (const diagnostic of diagnostics) {
      collector.addError(diagnostic.code, diagnostic.message, {
        stage: diagnostic.stage ?? "ai_planning",
        entityId: diagnostic.entityId,
      });
    }
    for (const cmd of commands) {
      const body = cmd["body"];
      if (body["type"] === "SetResearchPriority") {
        const priorityBody = body as SetResearchPriorityCommand;
        ctx.currentSnapshot = applySetResearchPriority(
          ctx.currentSnapshot,
          priorityBody["nationId"],
          priorityBody["fieldPriorities"],
          collector,
        );
      } else if (body["type"] === "budget_project") {
        ctx.currentSnapshot = applyBudgetProject(
          ctx.currentSnapshot,
          body as BudgetProjectCommand,
          campaignMonth,
          turnNumber,
          ctx.nextSeq,
          financialLedger,
          eventLedger,
          collector,
        );
      }
    }
  }
}

export const commandCollectionPhase: PhaseDescriptor = {
  id: "command_collection",
  name: "Command Collection",
  order: 15,
  readPermissions: ["all"],
  writePermissions: ["treasury", "constructions", "research", "wars", "politics", "fleets"],
  rngAllowed: false,
  footprint: {
    reads: [PhaseResource.ALL],
    writes: [
      PhaseResource.TREASURY,
      PhaseResource.CONSTRUCTIONS,
      PhaseResource.RESEARCH,
      PhaseResource.WARS,
      PhaseResource.POLITICS,
      PhaseResource.FLEETS,
    ],
    usesRng: false,
  },
  run: (ctx) => {
    runCommandCollectionPhase(ctx);
    return { status: "continue" };
  },
};

export const aiPlanningPhase: PhaseDescriptor = {
  id: "ai_planning",
  name: "AI Planning",
  order: 16,
  readPermissions: ["nations", "constructions", "research", "treasury"],
  writePermissions: ["research", "treasury", "constructions"],
  rngAllowed: true,
  footprint: {
    reads: [PhaseResource.RESEARCH, PhaseResource.CONSTRUCTIONS, PhaseResource.TREASURY],
    writes: [PhaseResource.RESEARCH, PhaseResource.TREASURY, PhaseResource.CONSTRUCTIONS],
    usesRng: true,
  },
  run: (ctx) => {
    runAiPlanningPhase(ctx);
    return { status: "continue" };
  },
};
