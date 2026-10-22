import {
  umsToKnots,
  type CampaignSnapshot,
  type CompiledDesignVersion as CompiledEngineDesignVersion,
  type ConstructionProject,
  type ConstructionProjectStatus,
} from "@bluewave/campaign";
import type { CompiledDesignVersion } from "./design.js";

const CONSTRUCTION_SHIP_TYPE_LABELS: Readonly<Record<string, string>> = {
  battleship: "battleship",
  dreadnought: "battleship",
  super_dreadnought: "battleship",
  battlecruiser: "battlecruiser",
  heavy_cruiser: "cruiser",
  light_cruiser: "cruiser",
  destroyer: "destroyer",
  pre_dreadnought: "pre-dreadnought",
  armoured_cruiser: "armoured cruiser",
  protected_cruiser: "protected cruiser",
  corvette: "corvette",
  armed_merchant_cruiser: "armed merchant cruiser",
  monitor: "monitor",
  coast_defense_ship: "coast defense",
  central_battery_ship: "central battery",
  ironclad_turret_ship: "ironclad",
  submarine: "submarine",
  carrier: "carrier",
};

export function constructionShipTypeLabel(hullType: string): string {
  return CONSTRUCTION_SHIP_TYPE_LABELS[hullType] ?? hullType;
}

export const CONSTRUCTION_ORDER_FORMULA_ID = "construction_order_v1";
export const CONSTRUCTION_ORDER_FORMULA_VERSION = "1.0.0";
const KILOGRAMS_PER_TON = 1_000;
const KILOGRAMS_PER_KILOTON = 1_000_000;
const KILOGRAMS_PER_COST_UNIT = 100_000;

export interface ConstructionOrderCosts {
  readonly projectedCost: number;
  readonly projectedCapacityUnits: number;
}

export function projectedConstructionOrderCosts(
  design: CompiledEngineDesignVersion,
  costMultiplierBp = 10_000,
): ConstructionOrderCosts {
  const kilograms = Number(design.normalizedDisplacementKg);
  const base =
    design.constructionCostUnits !== undefined
      ? Number(design.constructionCostUnits)
      : Math.round(kilograms / KILOGRAMS_PER_COST_UNIT);
  const projectedCost =
    costMultiplierBp === 10_000 ? base : Math.ceil((base * costMultiplierBp) / 10_000);
  return {
    projectedCost,
    projectedCapacityUnits: Math.round(kilograms / KILOGRAMS_PER_KILOTON),
  };
}

export function designFamilyYear(familyCreationMonth: string | undefined): number {
  const year = parseInt((familyCreationMonth ?? "").slice(0, 4), 10);
  return Number.isNaN(year) ? 0 : year;
}

export function isDesignBuildableByYear(designYear: number, campaignYear: number): boolean {
  return designYear === 0 || designYear <= campaignYear;
}

export function buildConstructionDesignCatalog(
  snapshot: CampaignSnapshot,
  nationId: string,
  campaignYear: number,
): CompiledDesignVersion[] {
  const families = snapshot.designFamilies;
  const designs: CompiledDesignVersion[] = [];
  for (const design of snapshot.designs.values()) {
    if (design.nationId !== nationId) continue;
    const family = design.designFamilyId !== "" ? families.get(design.designFamilyId) : undefined;
    const year = designFamilyYear(family?.familyCreationMonth);
    designs.push({
      designId: design.designVersionId,
      className: design.className,
      shipType: constructionShipTypeLabel(design.hullType),
      nationId: design.nationId,
      year,
      available: isDesignBuildableByYear(year, campaignYear),
      mass: Math.round(Number(design.normalizedDisplacementKg) / KILOGRAMS_PER_TON),
      speed: Math.round(umsToKnots(Number(design.normalizedSpeedUms))),
      machineryType: design.machineryType,
      requiredTechnologyIds: [],
      ...projectedConstructionOrderCosts(design),
      costBasis:
        design.constructionCostUnits !== undefined ? "design_cost_model" : "displacement_formula",
    });
  }
  designs.sort((a, b) => a.designId.localeCompare(b.designId));
  return designs;
}

export const CONSTRUCTION_PROJECT_ID_PREFIX = "project-";

export function constructionCommandIdForProject(projectId: string): string | null {
  return projectId.startsWith(CONSTRUCTION_PROJECT_ID_PREFIX)
    ? `cmd-${projectId.slice(CONSTRUCTION_PROJECT_ID_PREFIX.length)}`
    : null;
}

export function constructionProjectIdForCommand(commandId: string): string {
  return `${CONSTRUCTION_PROJECT_ID_PREFIX}${commandId.replace(/^cmd-/, "")}`;
}

export function constructionBatchProjectIdForCommand(commandId: string, ordinal: number): string {
  return `${constructionProjectIdForCommand(commandId)}-${String(ordinal)}`;
}

export type ConstructionScheduleBasis = "YARD_CAPACITY" | "FOREIGN_CONTRACT" | "UNAVAILABLE";

export type ConstructionScheduleUnavailableReason =
  | ConstructionProjectStatus
  | "REVISION_HOLD"
  | "FOREIGN_CONTRACT_MISSING";

export interface ConstructionProjectReadoutView {
  readonly totalCostUnits: number;
  readonly monthlyInstalmentUnits: number;
  readonly remainingMonths: number;
  readonly launchMonth: string | null;
  readonly scheduleBasis: ConstructionScheduleBasis;
  readonly scheduleUnavailableReason: ConstructionScheduleUnavailableReason | null;
  readonly delayReasonCode?: string;
  readonly haltedCarryingCostUnits: number | null;
}

export interface ConstructionProjectQueueEntry {
  readonly projectId: string;
  readonly designVersionId: string;
  readonly className: string;
  readonly shipType: string;
  readonly status: ConstructionProject["status"];
  readonly totalWork: number;
  readonly completedWork: number;
  readonly paidWork: number;
  readonly startedAt: string;
  readonly commandId: string | null;
  readonly revisable: boolean;
  readonly holdUntilMonth: string | null;
  readonly packages?: readonly ConstructionProjectPackageView[];
  readonly yardId?: string;
  readonly isForeign: boolean;
  readonly readout?: ConstructionProjectReadoutView;
}

export interface ConstructionProjectPackageView {
  readonly id: string;
  readonly kind: string;
  readonly line: string;
  readonly totalWork: number;
  readonly doneWork: number;
  readonly dependsOn: readonly string[];
}

export function buildConstructionProjectQueue(
  snapshot: CampaignSnapshot,
  nationId: string,
): ConstructionProjectQueueEntry[] {
  const nation = snapshot.nations.get(nationId);
  if (!nation) return [];
  const entries = nation.constructionProjects.map((project) => {
    const design = snapshot.designs.get(project.designVersionId);
    return {
      projectId: project.id,
      designVersionId: project.designVersionId,
      className: design?.className ?? project.designVersionId,
      shipType: design ? constructionShipTypeLabel(design.hullType) : "unknown",
      status: project.status,
      totalWork: Number(project.totalWork),
      completedWork: Number(project.completedWork),
      paidWork: Number(project.paidWork),
      startedAt: project.startedAt,
      commandId: constructionCommandIdForProject(project.id),
      revisable: design?.sourceDraft !== undefined && project.status !== "COMPLETED",
      holdUntilMonth: project.holdUntilMonth ?? null,
      isForeign: project.foreignContractId !== undefined,
      ...(project.packages
        ? {
            packages: project.packages.map((pk) => ({
              id: pk.id,
              kind: pk.kind,
              line: pk.line,
              totalWork: Number(pk.totalWork),
              doneWork: Number(pk.doneWork),
              dependsOn: [...pk.dependsOn],
            })),
          }
        : {}),
      ...(project.yardId !== undefined ? { yardId: project.yardId } : {}),
    };
  });
  entries.sort((a, b) => a.projectId.localeCompare(b.projectId));
  return entries;
}
