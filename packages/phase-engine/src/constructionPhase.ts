// Phase 7: construction_processing — advance construction projects, complete
// finished projects into fleet ships, and emit construction-progressed events.
import {
  KNOTS_TO_UMS,
  LAID_UP_CREW_CEILING,
  MM_TO_UM,
  transitionConstructionProject,
} from "@bluewave/campaign";
import type {
  CompiledDesignVersion,
  FleetState,
  NationDockState,
  NationState,
  Ship,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { raiseDockLimitsByStep } from "@bluewave/ship-design";
import {
  dockExpansionCompletes,
  dockExpansionMonthIsActive,
  isDockExpansionProject,
} from "./dockExpansion.js";
import { constructionProgressedEvent, shipRebuiltEvent } from "./events.js";
import type { MonthContext } from "./monthContext.js";
import { checkRebuildClassification } from "./rebuildClassification.js";

export function runConstructionProcessingPhase(ctx: MonthContext): void {
  for (const [nationId, nation] of ctx.currentSnapshot["nations"]) {
    if (!nation["isPlayable"] && !nation["isAI"]) continue;
    applyConstructionToNation(ctx, nationId, nation);
  }
}

function applyConstructionToNation(ctx: MonthContext, nationId: string, nation: NationState): void {
  const { campaignMonth, eventLedger, collector, nextSeq } = ctx;

  let updatedProjects = [...nation["constructionProjects"]];
  let updatedFleets = [...nation["fleets"]];
  let updatedDock: NationDockState | undefined = nation["dock"];
  let dockChanged = false;
  let hasChanges = false;

  for (const project of nation["constructionProjects"]) {
    if ((project["completedWork"] as number) > (project["totalWork"] as number)) {
      collector.addError(
        "CONSTRUCTION_OVERFLOW",
        `Project ${project["id"]} completedWork exceeds totalWork`,
        { stage: "construction-processing" },
      );
    }

    const clampedWork =
      project["completedWork"] > project["totalWork"]
        ? project["totalWork"]
        : project["completedWork"];

    if ((clampedWork as number) !== (project["completedWork"] as number)) {
      updatedProjects = updatedProjects.map((p) =>
        p["id"] === project["id"] ? { ...p, completedWork: clampedWork } : p,
      );
      hasChanges = true;
    }

    // Dock expansion (DESIGN-16 section 5, SB3-R16): an ACTIVE month advances the elapsed-active-month counter; a
    // halted or delayed month contributes zero. The project completes only when BOTH that counter reaches the stored
    // duration AND paid work reaches total work, and only then does it raise the nation's dock limits by the locked
    // era step. It never spawns a ship and never increases dock size on elapsed time alone.
    if (
      isDockExpansionProject(project) &&
      project["status"] !== "COMPLETED" &&
      project["status"] !== "CANCELLED"
    ) {
      const elapsedBefore = project["elapsedActiveMonths"] ?? 0;
      const elapsedAfter = dockExpansionMonthIsActive(project["status"])
        ? elapsedBefore + 1
        : elapsedBefore;
      const withElapsed: NationState["constructionProjects"][number] =
        elapsedAfter === elapsedBefore
          ? project
          : { ...project, elapsedActiveMonths: elapsedAfter };
      if (elapsedAfter !== elapsedBefore) {
        updatedProjects = updatedProjects.map((p) => (p["id"] === project["id"] ? withElapsed : p));
        hasChanges = true;
      }
      if (dockExpansionCompletes(withElapsed)) {
        updatedProjects = updatedProjects.map((p) =>
          p["id"] === project["id"]
            ? {
                ...transitionConstructionProject(withElapsed, "COMPLETED"),
                paidWork: withElapsed["totalWork"],
                elapsedActiveMonths: elapsedAfter,
              }
            : p,
        );
        hasChanges = true;
        const stepKg = withElapsed["dockExpansionStepKg"];
        if (updatedDock !== undefined && stepKg !== undefined) {
          updatedDock = raiseDockLimitsByStep(updatedDock, stepKg);
          dockChanged = true;
        } else if (stepKg !== undefined) {
          collector.addError(
            "DOCK_EXPANSION_DOCK_MISSING",
            `Dock expansion ${project["id"]} completed but nation ${nationId} has no materialised dock; no limits raised`,
            { stage: "construction-processing" },
          );
        }
      }
    }

    // Check for completion. Only new construction completes into a new ship; a finished REBUILD is handled by the rebuild
    // completion step (ADR-0078), so it must not spawn a second ship here.
    if (
      project["projectType"] === "NEW_CONSTRUCTION" &&
      project["status"] !== "COMPLETED" &&
      (clampedWork as number) >= (project["totalWork"] as number) &&
      (project["totalWork"] as number) > 0
    ) {
      updatedProjects = updatedProjects.map((p) =>
        p["id"] === project["id"]
          ? {
              ...transitionConstructionProject(p, "COMPLETED"),
              completedWork: project["totalWork"],
            }
          : p,
      );
      hasChanges = true;

      const ensured = ensureNationFleet(updatedFleets, nationId, nation);
      updatedFleets = ensured.fleets;
      const newShip = buildCompletedShip(ctx, project, ensured.fleet);
      updatedFleets = updatedFleets.map((f) =>
        f["id"] === ensured.fleet["id"] ? { ...f, ships: [...f["ships"], newShip] } : f,
      );
    }

    if (
      project["projectType"] === "REBUILD" &&
      project["status"] !== "COMPLETED" &&
      (clampedWork as number) >= (project["totalWork"] as number) &&
      (project["totalWork"] as number) > 0
    ) {
      // DESIGN-22 section 22 / DESIGN-23 section 22: re-run intended/natural classification on the rebuilt design
      // BEFORE any mutation. A failure leaves the project unfinished, the ship on its old design and no ShipRebuilt
      // event; because nothing in `updatedProjects`/`updatedFleets` is touched, the whole completion is atomic.
      const classification = checkRebuildClassification(
        ctx.currentSnapshot["designs"]?.get(project["designVersionId"]),
        ctx.engineOptions?.shipBuilding,
        campaignMonth,
      );
      if (!classification.ok) {
        collector.addError(
          "REBUILD_CLASSIFICATION_INVALID",
          `Rebuild ${project["id"]} cannot complete: the rebuilt design ${project["designVersionId"]} fails classification (${classification.reasons.join(", ")})`,
          { stage: "construction-processing" },
        );
      } else {
        updatedProjects = updatedProjects.map((p) =>
          p["id"] === project["id"]
            ? {
                ...transitionConstructionProject(p, "COMPLETED"),
                completedWork: project["totalWork"],
              }
            : p,
        );
        hasChanges = true;
        const done = completeRebuild(ctx, project, updatedFleets);
        if (done === null || !done.rebuilt) {
          collector.addError(
            "REBUILD_TARGET_MISSING",
            `Rebuild ${project["id"]} finished but its ship or design is missing`,
            { stage: "construction-processing" },
          );
        }
        if (done !== null) {
          updatedFleets = done.fleets;
        }
        if (done !== null && done.rebuilt) {
          eventLedger.append(
            shipRebuiltEvent(
              project["id"],
              nationId,
              done.shipId,
              done.fromDesignVersionId,
              project["designVersionId"],
              nextSeq(),
              campaignMonth,
            ),
          );
        }
      }
    }

    eventLedger.append(
      constructionProgressedEvent(
        project["id"],
        nationId,
        project["completedWork"],
        clampedWork,
        SafeInt.sub(clampedWork, project["completedWork"]),
        nextSeq(),
        campaignMonth,
      ),
    );
  }

  if (hasChanges) {
    const updatedNation: NationState = {
      ...nation,
      constructionProjects: updatedProjects,
      fleets: updatedFleets,
      ...(dockChanged ? { dock: updatedDock } : {}),
    };
    const updatedNations = new Map(ctx.currentSnapshot["nations"]);
    updatedNations.set(nationId, updatedNation);
    ctx.currentSnapshot = { ...ctx.currentSnapshot, nations: updatedNations };
  }
}

// Find the nation's fleet, creating a placeholder fleet when it has none.
function ensureNationFleet(
  fleets: FleetState[],
  nationId: string,
  nation: NationState,
): { fleet: FleetState; fleets: FleetState[] } {
  const existing = fleets.find((f) => f["nationId"] === nationId);
  if (existing) return { fleet: existing, fleets };
  const newFleet: FleetState = {
    id: `fleet-${nationId}`,
    nationId,
    name: `${nation["name"]} Fleet`,
    ships: [],
    locationAreaId: "unknown",
  };
  return { fleet: newFleet, fleets: [...fleets, newFleet] };
}

/** The abstracted Ship stats a compiled design resolves to (ADR-0037): shared by new construction and a finished rebuild. */
function shipStatsFromDesign(design: CompiledDesignVersion) {
  return {
    hitPoints: design["hitPoints"],
    maxHitPoints: design["hitPoints"],
    // ADR-0037: compiled design fields are canonical µm / µm·s⁻¹; the abstracted Ship stats are knots / mm (+ a coarse
    // firepower heuristic).
    speed: SafeInt.div(design["normalizedSpeedUms"], SafeInt(KNOTS_TO_UMS), "floor"),
    firepower: SafeInt.mul(
      design["mainGunsCount"],
      SafeInt.div(design["mainGunsCaliber"], SafeInt(100_000), "floor"),
    ),
    armor: SafeInt.div(design["normalizedArmorUm"], SafeInt(MM_TO_UM), "floor"),
    className: design["className"],
  };
}

// Build the commissioned ship for a completed project, resolving compiled design
// stats back to the abstracted Ship units (ADR-0037).
function buildCompletedShip(
  ctx: MonthContext,
  project: NationState["constructionProjects"][number],
  fleet: FleetState,
): Ship {
  const nationId = fleet["nationId"];
  const designVersionId = project["designVersionId"] ?? "";
  let stats: ReturnType<typeof shipStatsFromDesign> = {
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    speed: SafeInt(10),
    firepower: SafeInt(10),
    armor: SafeInt(10),
    className: project["targetId"],
  };
  if (designVersionId) {
    const design = ctx.currentSnapshot["designs"]?.get(designVersionId);
    if (design) stats = shipStatsFromDesign(design);
  }

  // A batch lays down several ships of one design; two completing in the same month would otherwise share
  // `ship-<design>-<turn>` (SB3-R11 "stable ship identifiers"). A batch project's stable, ordinaled id keeps each hull
  // distinct; a single order keeps the historical id so existing save hashes and replays do not move.
  const shipId =
    project["batchOrdinal"] !== undefined
      ? `ship-${project["id"]}`
      : `ship-${project["targetId"]}-${String(ctx.turnNumber)}`;

  return {
    id: shipId,
    name: project["shipName"] ?? `Ship ${stats.className}`,
    classId: stats.className,
    nationId,
    locationAreaId: fleet["locationAreaId"],
    designVersionId,
    hitPoints: stats.hitPoints,
    maxHitPoints: stats.maxHitPoints,
    speed: stats.speed,
    firepower: stats.firepower,
    armor: stats.armor,
    isUnderConstruction: false,
    constructionProgress: project["totalWork"],
    constructionTotalWork: project["totalWork"],
    // S-1: a hull leaving the slipway launches into working up (manual p.51).
    readiness: "WORKING_UP",
    crewQuality: LAID_UP_CREW_CEILING,
  };
}

/**
 * A finished rebuild (ADR-0078, DESIGN-23 section 22): the target ship atomically becomes the new design version, with the
 * new design's stats and full hit points (the rebuild repairs it), and is released (no longer unavailable). The old design
 * version stays in the snapshot. Returns the updated fleets and the transition, or null if the ship or design is missing.
 */
function completeRebuild(
  ctx: MonthContext,
  project: NationState["constructionProjects"][number],
  fleets: FleetState[],
): {
  fleets: FleetState[];
  shipId: string;
  fromDesignVersionId: string;
  /** False when the new design is missing: the ship is released unchanged and the caller reports it. */
  rebuilt: boolean;
} | null {
  const targetId = project["targetShipId"];
  if (targetId === undefined) return null;
  const fleet = fleets.find((f) => f["ships"].some((s) => s["id"] === targetId));
  const ship = fleet?.["ships"].find((s) => s["id"] === targetId);
  if (!fleet || !ship) return null;
  const design = ctx.currentSnapshot["designs"]?.get(project["designVersionId"]);
  // A ship must never stay unavailable for a project that is over: without the design it is released as it was.
  const { availability: _availability, availabilityProjectId: _reason, ...rest } = ship;
  const stats = design ? shipStatsFromDesign(design) : undefined;
  const rebuilt: Ship =
    design && stats
      ? {
          ...rest,
          classId: stats.className,
          designVersionId: design["designVersionId"],
          hitPoints: stats.hitPoints,
          maxHitPoints: stats.maxHitPoints,
          speed: stats.speed,
          firepower: stats.firepower,
          armor: stats.armor,
        }
      : rest;
  return {
    shipId: targetId,
    fromDesignVersionId: ship["designVersionId"],
    rebuilt: design !== undefined,
    fleets: fleets.map((f) =>
      f["id"] === fleet["id"]
        ? { ...f, ships: f["ships"].map((s) => (s["id"] === targetId ? rebuilt : s)) }
        : f,
    ),
  };
}
