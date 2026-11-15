import type { ConstructionProject } from "./state.js";

export const DOCK_EXPANSION_PROJECT_TYPE = "INFRASTRUCTURE" as const;

export function isDockExpansionProject(project: ConstructionProject): boolean {
  return (
    project["projectType"] === DOCK_EXPANSION_PROJECT_TYPE &&
    project["dockExpansionStepKg"] !== undefined
  );
}

export function dockExpansionTotalUnits(project: ConstructionProject): number {
  return Number(project["totalWork"]);
}

export function dockExpansionInstalmentUnits(project: ConstructionProject): number {
  const duration = project["dockExpansionDurationMonths"];
  const total = dockExpansionTotalUnits(project);
  if (duration === undefined || !Number.isSafeInteger(duration) || duration <= 0) return total;
  return Math.ceil(total / duration);
}

export function dockExpansionDueUnits(project: ConstructionProject): number {
  if (!isDockExpansionProject(project)) return 0;
  if (project["status"] === "COMPLETED" || project["status"] === "CANCELLED") return 0;
  const total = dockExpansionTotalUnits(project);
  const paid = Number(project["paidWork"]);
  const elapsed = project["elapsedActiveMonths"] ?? 0;
  const cumulative = Math.min(total, dockExpansionInstalmentUnits(project) * (elapsed + 1));
  return Math.max(0, Math.min(total - paid, cumulative - paid));
}
