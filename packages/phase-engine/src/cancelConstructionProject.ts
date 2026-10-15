// DESIGN-23 section 23 (project cancellation) with the DESIGN-11 settlement contract. Stops a dockyard project,
// releases future capacity, settles the work already done explicitly, resolves a rebuild target ship's availability
// and custody, and leaves an explicit cancellation record (the `ConstructionProjectCancelled` event, emitted by the
// caller). Nothing is silently restored and no value is created or destroyed silently.
import type { CampaignSnapshot, ConstructionProject, NationState, Ship } from "@bluewave/campaign";
import {
  ConstructionProjectTransitionError,
  isTerminalConstructionProjectStatus,
  transitionConstructionProject,
} from "@bluewave/campaign";
import type { CancelConstructionProjectCommand } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

/** The stable settlement reason: work already completed and paid is consumed by stopping, and is not refunded. */
export const CANCELLATION_WORK_CONSUMED = "CANCELLATION_WORK_CONSUMED" as const;

/**
 * The explicit settlement of one cancelled project (DESIGN-23 section 23; DESIGN-11 section 15). Every field is stated,
 * never inferred: `consumedWork` is the work already completed and paid; `refundedAmount` is what returns to the
 * nation; `lostAmount` is the value the nation forfeits by stopping; `salvageableAmount` is what could be recovered
 * from the partial work. `reason` is the stable settlement reason code.
 */
export interface CancellationSettlement {
  readonly consumedWork: SafeInt;
  readonly refundedAmount: SafeInt;
  readonly lostAmount: SafeInt;
  readonly salvageableAmount: SafeInt;
  readonly reason: string;
}

export interface CancelConstructionProjectOutcome {
  /** The snapshot after the cancellation (the input unchanged when the cancellation was refused). */
  readonly snapshot: CampaignSnapshot;
  /** The settlement applied, or `null` when the cancellation was refused and nothing changed. */
  readonly cancelled: CancellationSettlement | null;
  /** The cancelled project's type, for the cancellation record; `null` when nothing was cancelled. */
  readonly projectType: string | null;
}

/**
 * Settle a cancelled dockyard project (DESIGN-23 section 23; DESIGN-11 section 15). Funding is pay-as-you-go: work is
 * charged to the treasury as it is completed and no future instalment is reserved, so cancelling releases the whole
 * future commitment and refunds nothing. Work already completed and paid is forfeited — `consumedWork` = `paidWork`,
 * `lostAmount` = `paidWork`, `refundedAmount` = 0. Partial-hull salvage is part of the unimplemented scrapping
 * subsystem (DESIGN-23 section 26, recorded as deferred), so `salvageableAmount` is an explicit 0 rather than a
 * fabricated credit. Pure and deterministic.
 */
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

/** Releases a ship from the project's unavailability, preserving every other field (custody resolved, DESIGN-23 section 20). */
function releaseShip(ship: Ship): Ship {
  const { availability: _availability, availabilityProjectId: _project, ...rest } = ship;
  return rest;
}

function noop(snapshot: CampaignSnapshot): CancelConstructionProjectOutcome {
  return { snapshot, cancelled: null, projectType: null };
}

/**
 * Canonical application of a `CancelConstructionProject` command (DESIGN-23 section 23; DESIGN-11 settlement contract).
 * The project moves to the terminal `CANCELLED` status (it receives no further work); its settlement is computed and
 * returned for the cancellation record; a `REBUILD`'s target ship is released from this project's unavailability and
 * keeps its old compiled design version (no design change is applied on cancellation, DESIGN-23 section 22). A terminal
 * project, a project that is not the nation's, or a foreign-contract project (its cancellation is a contract outcome)
 * is refused and changes nothing. Pure except for the diagnostic collector.
 */
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

  // Resolve a rebuild's target-ship custody (DESIGN-23 sections 20/23): release only the ship this project made
  // unavailable, so an unrelated availability is never cleared. The ship keeps its old design version; no ship is spawned.
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
