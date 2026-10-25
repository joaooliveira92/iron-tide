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
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";
import { applyReviseProject } from "./reviseProject.js";
import { applyStartRebuild } from "./startRebuild.js";
import { applyShipReadinessCommand, applyStationAssignmentCommand } from "./stationAssignment.js";
import { applyCancelConstructionProject } from "./cancelConstructionProject.js";
import { constructionProjectCancelledEvent } from "./events.js";

export function runCommandCollectionPhase(ctx: PhaseContext): PhaseRunOutcome {
  const slot = ctx.slots[0];
  if (!slot) return { status: "continue" };

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
  return { status: "continue" };
}

function applyPlayerCommand(ctx: PhaseContext, body: CommandBody, commandId: string): void {
  if (applyAdministrativeCommand(ctx, body)) return;
  if (applyDiplomacyCommand(ctx, body)) return;
  if (applyDivisionCommand(ctx, body)) return;
  if (applyStationAssignmentCommand(ctx, body)) return;
  if (applyShipReadinessCommand(ctx, body)) return;
  applyConstructionCommand(ctx, body, commandId);
}

function applyAdministrativeCommand(ctx: PhaseContext, body: CommandBody): boolean {
  const { campaignMonth, collector } = ctx;

  if (body["type"] === "SetResearchPriority") {
    const priorityBody = body as SetResearchPriorityCommand;
    ctx.snapshot.current = applySetResearchPriority(
      ctx.snapshot.current,
      priorityBody["nationId"],
      priorityBody["fieldPriorities"],
      collector,
    );
    return true;
  }

  if (body["type"] === "AssignOfficer" || body["type"] === "RelieveOfficer") {
    ctx.snapshot.current = applyOfficerCommand(
      ctx.snapshot.current,
      body as AssignOfficerCommand | RelieveOfficerCommand,
      campaignMonth,
      collector,
    );
    return true;
  }

  if (body["type"] === "SubmitDesign") {
    ctx.snapshot.current = applySubmitDesign(
      ctx.snapshot.current,
      body as SubmitDesignCommand,
      ctx.engineOptions?.shipBuilding,
      campaignMonth,
      collector,
    );
    return true;
  }

  if (body["type"] === "ReviseProject") {
    ctx.snapshot.current = applyReviseProject(
      ctx.snapshot.current,
      body as ReviseProjectCommand,
      ctx.engineOptions?.shipBuilding,
      campaignMonth,
      collector,
    );
    return true;
  }

  if (body["type"] === "StartRebuild") {
    ctx.snapshot.current = applyStartRebuild(
      ctx.snapshot.current,
      body as StartRebuildCommand,
      ctx.engineOptions?.shipBuilding,
      campaignMonth,
      collector,
    );
    return true;
  }

  if (body["type"] === "MoveFleet") {
    ctx.snapshot.current = applyMoveFleet(
      ctx.snapshot.current,
      body as MoveFleetCommand,
      collector,
    );
    return true;
  }

  if (body["type"] === "SetBudgetAllocation") {
    ctx.snapshot.current = applySetBudgetAllocation(
      ctx.snapshot.current,
      body as SetBudgetAllocationCommand,
      collector,
    );
    return true;
  }

  return false;
}

function applyDiplomacyCommand(ctx: PhaseContext, body: CommandBody): boolean {
  const { campaignMonth } = ctx;

  if (body["type"] === "DeclareWar") {
    ctx.snapshot.current = applyDeclareWar(
      ctx.snapshot.current,
      body as DeclareWarCommand,
      campaignMonth,
    );
    return true;
  }

  if (body["type"] === "AcceptPeace") {
    ctx.snapshot.current = applyAcceptPeace(
      ctx.snapshot.current,
      body as AcceptPeaceCommand,
      campaignMonth,
    );
    return true;
  }

  if (body["type"] === "FormAlliance") {
    ctx.snapshot.current = applySetRelation(
      ctx.snapshot.current,
      (body as FormAllianceCommand)["nationId"],
      (body as FormAllianceCommand)["partnerNationId"],
      "allied",
      TENSION_ALLIANCE,
    );
    return true;
  }

  if (body["type"] === "BreakAlliance") {
    ctx.snapshot.current = applySetRelation(
      ctx.snapshot.current,
      (body as BreakAllianceCommand)["nationId"],
      (body as BreakAllianceCommand)["partnerNationId"],
      "neutral",
      TENSION_PEACE,
    );
    return true;
  }

  if (body["type"] === "FormNonAggressionPact") {
    ctx.snapshot.current = applySetNap(
      ctx.snapshot.current,
      (body as FormNonAggressionPactCommand)["nationId"],
      (body as FormNonAggressionPactCommand)["partnerNationId"],
      true,
    );
    return true;
  }

  if (body["type"] === "BreakNonAggressionPact") {
    ctx.snapshot.current = applySetNap(
      ctx.snapshot.current,
      (body as BreakNonAggressionPactCommand)["nationId"],
      (body as BreakNonAggressionPactCommand)["partnerNationId"],
      false,
    );
    return true;
  }

  if (body["type"] === "DeclareBlockade") {
    ctx.snapshot.current = applyDeclareBlockade(
      ctx.snapshot.current,
      body as DeclareBlockadeCommand,
      campaignMonth,
    );
    return true;
  }

  return false;
}

function applyDivisionCommand(ctx: PhaseContext, body: CommandBody): boolean {
  if (
    body["type"] === "CreateDivision" ||
    body["type"] === "AddShipToDivision" ||
    body["type"] === "RemoveShipFromDivision" ||
    body["type"] === "DissolveDivision" ||
    body["type"] === "ChangeDivisionFlagship" ||
    body["type"] === "ReorderDivisionShips"
  ) {
    ctx.snapshot.current = applyDivisionCommandMonth(
      ctx.snapshot.current,
      body,
      ctx.campaignMonth,
      ctx.collector,
    );
    return true;
  }
  return false;
}

function applyConstructionCommand(ctx: PhaseContext, body: CommandBody, commandId: string): void {
  const { campaignMonth, turnNumber, financialLedger, eventLedger, collector } = ctx;

  if (body["type"] === "OrderConstruction") {
    ctx.snapshot.current = applyOrderConstruction(
      ctx.snapshot.current,
      body as OrderConstructionCommand,
      commandId,
      ctx.engineOptions?.shipBuilding,
      campaignMonth,
      collector,
    );
    return;
  }

  if (body["type"] === "AuthorizeDockExpansion") {
    ctx.snapshot.current = applyAuthorizeDockExpansion(
      ctx.snapshot.current,
      body as AuthorizeDockExpansionCommand,
      campaignMonth,
      collector,
    );
    return;
  }

  if (body["type"] === "OrderForeignConstruction") {
    ctx.snapshot.current = applyOrderForeignConstruction(
      ctx.snapshot.current,
      body as OrderForeignConstructionCommand,
      commandId,
      ctx.engineOptions?.shipBuilding,
      campaignMonth,
      collector,
    );
    return;
  }

  if (body["type"] === "HaltConstruction") {
    ctx.snapshot.current = applyHaltConstruction(
      ctx.snapshot.current,
      body as HaltConstructionCommand,
      collector,
    );
    return;
  }

  if (body["type"] === "ResumeConstruction") {
    ctx.snapshot.current = applyResumeConstruction(
      ctx.snapshot.current,
      body as ResumeConstructionCommand,
      collector,
    );
    return;
  }

  if (body["type"] === "SetAcceleration") {
    ctx.snapshot.current = applySetAcceleration(
      ctx.snapshot.current,
      body as SetAccelerationCommand,
      collector,
    );
    return;
  }

  if (body["type"] === "CancelConstructionProject") {
    const outcome = applyCancelConstructionProject(
      ctx.snapshot.current,
      body as CancelConstructionProjectCommand,
      collector,
    );
    ctx.snapshot.current = outcome.snapshot;
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

  const nation = ctx.snapshot.current["nations"].get(body["nationId"]);
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

  ctx.snapshot.current = applyBudgetProject(
    ctx.snapshot.current,
    body,
    campaignMonth,
    turnNumber,
    ctx.nextSeq,
    financialLedger,
    eventLedger,
    collector,
  );
}

export function runAiPlanningPhase(ctx: PhaseContext): PhaseRunOutcome {
  const { campaignMonth, turnNumber, financialLedger, eventLedger, collector } = ctx;

  const idempotencyMap = new CommandIdempotencyMap();
  const aiExecutor = new AiPhaseExecutor();
  const aiEngine = ctx.rng.engine();
  const shipBuilding = ctx.engineOptions?.shipBuilding;
  for (const slot of ctx.slots) {
    if (slot["type"] !== "ai") continue;
    const nationId = slot["nationId"];
    let researchAllocation: Record<string, number> | undefined;
    const profile = shipBuilding?.navalProfileFor(nationId, ctx.campaignMonth) ?? null;
    if (profile !== null) {
      researchAllocation = {
        ...researchPriorityAllocation(profile, {}, `${ctx.rng.seed()}:research:${nationId}`)
          .fieldPriorities,
      };
    }
    const { commands, diagnostics } = aiExecutor.run(
      slot,
      ctx.snapshot.current,
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
        ctx.snapshot.current = applySetResearchPriority(
          ctx.snapshot.current,
          priorityBody["nationId"],
          priorityBody["fieldPriorities"],
          collector,
        );
      } else if (body["type"] === "budget_project") {
        ctx.snapshot.current = applyBudgetProject(
          ctx.snapshot.current,
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
  return { status: "continue" };
}

export const commandCollectionPhase: MonthPhase = {
  id: "command_collection",
  name: "Command Collection",
  permissions: {
    reads: "all",
    writes: ["nations", "wars", "politics", "designs", "designFamilies"],
    rng: false,
  },
  run: runCommandCollectionPhase,
};

export const aiPlanningPhase: MonthPhase = {
  id: "ai_planning",
  name: "AI Planning",
  permissions: { reads: "all", writes: ["nations"], rng: true },
  run: runAiPlanningPhase,
};
