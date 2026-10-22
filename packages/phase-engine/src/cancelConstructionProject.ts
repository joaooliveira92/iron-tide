import type { CampaignSnapshot, ConstructionProject, NationState, Ship } from "@bluewave/campaign";
import {
  ConstructionProjectTransitionError,
  isTerminalConstructionProjectStatus,
  transitionConstructionProject,
} from "@bluewave/campaign";
import type { CancelConstructionProjectCommand } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

export const CANCELLATION_WORK_CONSUMED = "CANCELLATION_WORK_CONSUMED" as const;

export interface CancellationSettlement {
  readonly consumedWork: SafeInt;
  readonly refundedAmount: SafeInt;
  readonly lostAmount: SafeInt;
  readonly salvageableAmount: SafeInt;
  readonly reason: string;
}

export interface CancelConstructionProjectOutcome {
  readonly snapshot: CampaignSnapshot;
  readonly cancelled: CancellationSettlement | null;
  readonly projectType: string | null;
}

export function cancellationSettlement(project: ConstructionProject): CancellationSettlement {
  const consumed = Math.max(0, Math.floor(Number(project["paidWork"]) || 0));
  return {
    consumedWork: SafeInt(consumed),
    refundedAmount: SafeInt(0),
    lostAmount: SafeInt(consumed),
    salvageableAmount: SafeInt(0),
    reason: CANCELLATION_WORK_CONSUMED,
  };
}

function releaseShip(ship: Ship): Ship {
  const { availability: _availability, availabilityProjectId: _project, ...rest } = ship;
  return rest;
}

function noop(snapshot: CampaignSnapshot): CancelConstructionProjectOutcome {
  return { snapshot, cancelled: null, projectType: null };
}

export function applyCancelConstructionProject(
  currentSnapshot: CampaignSnapshot,
  body: CancelConstructionProjectCommand,
  collector: DiagnosticCollector,
): CancelConstructionProjectOutcome {
  const nation = currentSnapshot["nations"].get(body["nationId"]);
  if (!nation) {
    collector.addError("INVALID_NATION_ID", `Nation ${body["nationId"]} not found`, {
      stage: "command_collection",
    });
    return noop(currentSnapshot);
  }
  const project = nation["constructionProjects"].find((p) => p["id"] === body["projectId"]);
  if (!project) {
    collector.addError(
      "INVALID_DOCKYARD_PROJECT",
      `Project ${body["projectId"]} is not ${body["nationId"]}'s`,
      { stage: "command_collection", entityId: body["projectId"] },
    );
    return noop(currentSnapshot);
  }
  if (isTerminalConstructionProjectStatus(project["status"])) {
    collector.addError(
      "INVALID_DOCKYARD_PROJECT_TRANSITION",
      `Project ${body["projectId"]} is ${project["status"]} and cannot be cancelled`,
      { stage: "command_collection", entityId: body["projectId"] },
    );
    return noop(currentSnapshot);
  }
  if (project["foreignContractId"] !== undefined) {
    collector.addError(
      "FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE",
      `Project ${body["projectId"]} is a foreign contract order; its cancellation is a contract outcome`,
      { stage: "command_collection", entityId: body["projectId"] },
    );
    return noop(currentSnapshot);
  }

  let cancelledProject: ConstructionProject;
  try {
    cancelledProject = transitionConstructionProject(project, "CANCELLED");
  } catch (error) {
    if (ConstructionProjectTransitionError.is(error)) {
      collector.addError("INVALID_DOCKYARD_PROJECT_TRANSITION", error.message, {
        stage: "command_collection",
        entityId: project["id"],
      });
      return noop(currentSnapshot);
    }
    throw error;
  }

  const settlement = cancellationSettlement(project);

  const targetShipId = project["targetShipId"];
  const releasesShip =
    project["projectType"] === "REBUILD" &&
    targetShipId !== undefined &&
    nation["fleets"].some((f) =>
      f["ships"].some(
        (s) => s["id"] === targetShipId && s["availabilityProjectId"] === project["id"],
      ),
    );
  const fleets = releasesShip
    ? nation["fleets"].map((f) => ({
        ...f,
        ships: f["ships"].map((s) =>
          s["id"] === targetShipId && s["availabilityProjectId"] === project["id"]
            ? releaseShip(s)
            : s,
        ),
      }))
    : nation["fleets"];

  const updatedNation: NationState = {
    ...nation,
    constructionProjects: nation["constructionProjects"].map((p) =>
      p["id"] === project["id"] ? cancelledProject : p,
    ),
    fleets,
  };
  const nations = new Map(currentSnapshot["nations"]);
  nations.set(body["nationId"], updatedNation);
  collector.addInfo(
    CANCELLATION_WORK_CONSUMED,
    `Project ${body["projectId"]} cancelled: ${String(settlement.consumedWork)} work consumed, ${String(settlement.refundedAmount)} refunded, ${String(settlement.lostAmount)} lost`,
    { stage: "command_collection", entityId: project["id"] },
  );
  return {
    snapshot: { ...currentSnapshot, nations },
    cancelled: settlement,
    projectType: project["projectType"],
  };
}
