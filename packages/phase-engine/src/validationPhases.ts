import type { CampaignSnapshot } from "@bluewave/campaign";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { constructionPackageProblems } from "./constructionPackages.js";
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";
import { rebuildProjectProblems } from "./rebuildProjects.js";

export function runOpeningValidationPhase(
  snapshot: CampaignSnapshot,
  collector: DiagnosticCollector,
): boolean {
  let valid = true;

  for (const [nationId, nation] of snapshot["nations"]) {
    if ((nation["treasury"] as number) < 0) {
      collector.addError(
        "NEGATIVE_TREASURY",
        `Nation ${nationId} has negative treasury: ${String(nation["treasury"])}`,
        { stage: "opening-validation" },
      );
      valid = false;
    }

    for (const ship of nation["fleets"].flatMap((f) => f["ships"])) {
      if ((ship["constructionProgress"] as number) > (ship["constructionTotalWork"] as number)) {
        collector.addError(
          "CONSTRUCTION_OVERFLOW",
          `Ship ${ship["id"]} construction progress ${String(ship["constructionProgress"])} exceeds total work ${String(ship["constructionTotalWork"])}`,
          { stage: "opening-validation" },
        );
        valid = false;
      }
    }
  }

  const shipBattleMap = new Map<string, string>();
  for (const battle of snapshot["wars"]["battles"]) {
    const battleFleetIds = [...battle["attackerFleetIds"], ...battle["defenderFleetIds"]];
    for (const fleetId of battleFleetIds) {
      for (const nation of snapshot["nations"].values()) {
        for (const fleet of nation["fleets"]) {
          if (fleet["id"] !== fleetId) continue;
          for (const ship of fleet["ships"]) {
            if (!ship["inBattleId"]) continue;
            if (shipBattleMap.has(ship["id"])) {
              collector.addError(
                "SHIP_IN_MULTIPLE_BATTLES",
                `Ship ${ship["id"]} is assigned to multiple battles`,
                { stage: "opening-validation" },
              );
              valid = false;
            }
            shipBattleMap.set(ship["id"], battle["id"]);
          }
        }
      }
    }
  }

  return valid;
}

export function runClosingValidationPhase(
  snapshot: CampaignSnapshot,
  collector: DiagnosticCollector,
): boolean {
  let hasErrors = false;

  for (const [nationId, nation] of snapshot["nations"]) {
    if ((nation["treasury"] as number) < 0) {
      collector.addError(
        "NEGATIVE_TREASURY",
        `Nation ${nationId} has negative treasury at closing`,
        { stage: "closing-validation" },
      );
      hasErrors = true;
    }

    for (const problem of rebuildProjectProblems(nation)) {
      collector.addError("REBUILD_PROJECT_INCONSISTENT", `Nation ${nationId}: ${problem}`, {
        stage: "closing-validation",
      });
      hasErrors = true;
    }

    for (const project of nation["constructionProjects"]) {
      if ((project["completedWork"] as number) > (project["totalWork"] as number)) {
        collector.addError(
          "CONSTRUCTION_OVERFLOW",
          `Project ${project["id"]} completedWork ${String(project["completedWork"])} exceeds totalWork ${String(project["totalWork"])}`,
          { stage: "closing-validation" },
        );
        hasErrors = true;
      }
      for (const problem of constructionPackageProblems(project)) {
        collector.addError(
          "CONSTRUCTION_PACKAGE_INCONSISTENT",
          `Project ${project["id"]}: ${problem}`,
          { stage: "closing-validation" },
        );
        hasErrors = true;
      }
    }
  }

  return !(hasErrors || collector.errors.length > 0);
}

function runOpeningValidation(ctx: PhaseContext): PhaseRunOutcome {
  return runOpeningValidationPhase(ctx.snapshot.view(), ctx.collector)
    ? { status: "continue" }
    : { status: "finish", success: false };
}

function runClosingValidation(ctx: PhaseContext): PhaseRunOutcome {
  return {
    status: "finish",
    success: runClosingValidationPhase(ctx.snapshot.view(), ctx.collector),
  };
}

export const openingValidationPhase: MonthPhase = {
  id: "opening_validation",
  name: "Opening Validation",
  permissions: { reads: ["nations", "wars"], writes: [], rng: false },
  run: runOpeningValidation,
};

export const closingValidationPhase: MonthPhase = {
  id: "closing_validation",
  name: "Closing Validation",
  permissions: { reads: ["nations"], writes: [], rng: false },
  run: runClosingValidation,
};
