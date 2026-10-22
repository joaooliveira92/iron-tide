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
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";
import { checkRebuildClassification } from "./rebuildClassification.js";

export function runConstructionProcessingPhase(ctx: PhaseContext): PhaseRunOutcome {
  for (const [nationId, nation] of ctx.snapshot.read("nations")) {
    if (!nation["isPlayable"] && !nation["isAI"]) continue;
    applyConstructionToNation(ctx, nationId, nation);
  }
  return { status: "continue" };
}

export const constructionProcessingPhase: MonthPhase = {
  id: "construction_processing",
  name: "Construction Processing",
  permissions: { reads: ["nations", "designs"], writes: ["nations"], rng: false },
  run: runConstructionProcessingPhase,
};

function applyConstructionToNation(ctx: PhaseContext, nationId: string, nation: NationState): void {
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
      const classification = checkRebuildClassification(
        ctx.snapshot.read("designs")?.get(project["designVersionId"]),
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
    const updatedNations = new Map(ctx.snapshot.read("nations"));
    updatedNations.set(nationId, updatedNation);
    ctx.snapshot.write("nations", updatedNations);
  }
}

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

function shipStatsFromDesign(design: CompiledDesignVersion) {
  return {
    hitPoints: design["hitPoints"],
    maxHitPoints: design["hitPoints"],
    speed: SafeInt.div(design["normalizedSpeedUms"], SafeInt(KNOTS_TO_UMS), "floor"),
    firepower: SafeInt.mul(
      design["mainGunsCount"],
      SafeInt.div(design["mainGunsCaliber"], SafeInt(100_000), "floor"),
    ),
    armor: SafeInt.div(design["normalizedArmorUm"], SafeInt(MM_TO_UM), "floor"),
    className: design["className"],
  };
}

function buildCompletedShip(
  ctx: PhaseContext,
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
    const design = ctx.snapshot.read("designs")?.get(designVersionId);
    if (design) stats = shipStatsFromDesign(design);
  }
  const fitted = designVersionId
    ? ctx.snapshot.read("designs")?.get(designVersionId)?.colonialServiceFitted === true
    : false;

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
    readiness: "WORKING_UP",
    crewQuality: LAID_UP_CREW_CEILING,
    ...(fitted ? { colonialServiceFitted: true as const } : {}),
  };
}

function completeRebuild(
  ctx: PhaseContext,
  project: NationState["constructionProjects"][number],
  fleets: FleetState[],
): {
  fleets: FleetState[];
  shipId: string;
  fromDesignVersionId: string;
  rebuilt: boolean;
} | null {
  const targetId = project["targetShipId"];
  if (targetId === undefined) return null;
  const fleet = fleets.find((f) => f["ships"].some((s) => s["id"] === targetId));
  const ship = fleet?.["ships"].find((s) => s["id"] === targetId);
  if (!fleet || !ship) return null;
  const design = ctx.snapshot.read("designs")?.get(project["designVersionId"]);
  const { availability: _availability, availabilityProjectId: _reason, ...rest } = ship;
  const { colonialServiceFitted: _oldFitting, ...restWithoutFitting } = rest;
  const stats = design ? shipStatsFromDesign(design) : undefined;
  const rebuilt: Ship =
    design && stats
      ? {
          ...restWithoutFitting,
          classId: stats.className,
          designVersionId: design["designVersionId"],
          hitPoints: stats.hitPoints,
          maxHitPoints: stats.maxHitPoints,
          speed: stats.speed,
          firepower: stats.firepower,
          armor: stats.armor,
          ...(design.colonialServiceFitted === true
            ? { colonialServiceFitted: true as const }
            : {}),
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
