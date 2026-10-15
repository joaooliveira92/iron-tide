import {
  umsToKnots,
  type CampaignSnapshot,
  type CompiledDesignVersion as CompiledEngineDesignVersion,
  type ConstructionProject,
  type ConstructionProjectStatus,
} from "@bluewave/campaign";
import type { CompiledDesignVersion } from "./design.js";

/**
 * Construction-screen projections (desktop-mvp ticket 14). Everything here is
 * a pure, deterministic derivation over the compiled `CampaignSnapshot` —
 * no session state, no I/O, no randomness — so the desktop bridge can build
 * the `ConstructionScreenProjection`'s `designs`/cost fields from the exact
 * same immutable snapshot every `inspectConstructionScreen` call, and tests
 * can pin the derivation against fixture data.
 */

/**
 * Display label for a compiled design's authored `hullType`, mapped onto the
 * ship-type vocabulary the construction screen's `DesignPicker` icons
 * understand (`battleship`, `battlecruiser`, `cruiser`, ...). Presentation
 * only (ENGINEERING-CONTRACT: rendering may derive display values; it never
 * alters authoritative state). Unknown hull types pass through verbatim so
 * nothing is ever mislabeled as something it is not.
 */
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

/**
 * Versioned judgment call, in the same class as ticket 12's documented
 * `shipyardCapacity = sum(port.level)` proxy: the engine has no authored
 * per-design construction cost, so the construction command's projected cost
 * is derived deterministically from the design's real bulk
 * (`normalizedDisplacementKg`, which the combat classifier also relies on).
 *
 * - `projectedCost` (treasury/work units): 1 unit per 100 metric tons —
 *   `round(kg / 100_000)`. Work and treasury are 1:1 in the engine
 *   (`applyBudgetProject` adds a command's `budget` straight onto a
 *   project's `completedWork`), so a 11 880 t Inflexible reserves ~119 of a
 *   starting 1 000 treasury, and a 64 000 t Yamato ~640 — real budget
 *   pressure, not a placeholder.
 * - `projectedCapacityUnits`: kilotons, `round(kg / 1_000_000)` — the same
 *   mass figure scaled to the shipyard-capacity units (port levels, single
 *   digits), so drydock commitments stay proportional to a nation's small
 *   number of large yard slots. Explicit rounding, matching every other
 *   derivation in `@bluewave/campaign-engine`.
 */
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
  // A design priced by the ship-design cost model carries its own cost (ADR-0074); authored designs use the formula.
  const base =
    design.constructionCostUnits !== undefined
      ? Number(design.constructionCostUnits)
      : Math.round(kilograms / KILOGRAMS_PER_COST_UNIT);
  // The national cost multiplier (ADR-0090) is applied once, rounding up so a ship is never under-costed.
  const projectedCost =
    costMultiplierBp === 10_000 ? base : Math.ceil((base * costMultiplierBp) / 10_000);
  return {
    projectedCost,
    projectedCapacityUnits: Math.round(kilograms / KILOGRAMS_PER_KILOTON),
  };
}

/**
 * The `CompiledDesignVersion[]` the Construction screen's `Design Catalog`
 * tab lists for `nationId` — the friendly-units shape
 * (`design.ts`, "ticket 14 (Construction Ordering) wires the real lookup").
 *
 * Every field is derived from the compiled snapshot / content catalog:
 * - `year`: the design family's authored `familyCreationMonth` year (the
 *   pack's closest real "vintage" datum; e.g. `des_gbr_inflexible` →
 *   `fam_gbr_inflexible` `1880-01` → 1880). 0 when no family is authored.
 * - `mass`: `normalizedDisplacementKg` in metric tons (rounded).
 * - `speed`: `normalizedSpeedUms` in knots (rounded; 1 kt = 0.514 444 m/s).
 * - `requiredTechnologyIds`: `[]` — nothing in the current content pack
 *   links designs to technology prerequisites, so the honest value is
 *   "no authored prerequisites" (the UI renders nothing for an empty list).
 * - `shipType`: see `shipTypeLabel`.
 *
 * Sorted by `designVersionId` for deterministic rendering, matching
 * `buildPlayerProjection`'s sort convention.
 */
export function buildConstructionDesignCatalog(
  snapshot: CampaignSnapshot,
  nationId: string,
): CompiledDesignVersion[] {
  const families = snapshot.designFamilies;
  const designs: CompiledDesignVersion[] = [];
  for (const design of snapshot.designs.values()) {
    if (design.nationId !== nationId) continue;
    const family = design.designFamilyId !== "" ? families.get(design.designFamilyId) : undefined;
    const familyMonth = family?.familyCreationMonth ?? "";
    designs.push({
      designId: design.designVersionId,
      className: design.className,
      shipType: constructionShipTypeLabel(design.hullType),
      nationId: design.nationId,
      year: parseInt(familyMonth.slice(0, 4), 10) || 0,
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

/**
 * The snapshot project-id prefix a desktop construction command's queued
 * order uses (`project-<commandId minus cmd->`). Authored starting projects
 * (`con_gbr_inflexible` etc.) never carry this prefix — they have no command
 * record behind them.
 */
export const CONSTRUCTION_PROJECT_ID_PREFIX = "project-";

/** The workspace `commandId` an order-queued project belongs to, or `null`
 * for authored starting projects (no command record exists for them). */
export function constructionCommandIdForProject(projectId: string): string | null {
  return projectId.startsWith(CONSTRUCTION_PROJECT_ID_PREFIX)
    ? `cmd-${projectId.slice(CONSTRUCTION_PROJECT_ID_PREFIX.length)}`
    : null;
}

/** The snapshot project id a construction command queues for `commandId`. */
export function constructionProjectIdForCommand(commandId: string): string {
  return `${CONSTRUCTION_PROJECT_ID_PREFIX}${commandId.replace(/^cmd-/, "")}`;
}

/**
 * The snapshot project id for ship `ordinal` (1-based) of a construction batch (DESIGN-23 section 4, SB3-R11). A batch
 * needs one stable id per ship, so the single-order id is suffixed with the ship's batch ordinal. Batch ids are always
 * ordinaled, even at quantity one, so a batch is never mistaken for a single order.
 */
export function constructionBatchProjectIdForCommand(commandId: string, ordinal: number): string {
  return `${constructionProjectIdForCommand(commandId)}-${String(ordinal)}`;
}

/**
 * Which funding path a project's readout describes (SB3-R31 / INC-3c):
 * - `YARD_CAPACITY`: an ordinary domestic project, funded by its yard's line capacity.
 * - `FOREIGN_CONTRACT`: a foreign order, funded by its contract's instalment schedule.
 * - `UNAVAILABLE`: the project is not accruing ordinary schedule work (halted, delayed, awaiting capacity,
 *   impounded, cancelled, or on a revision hold), so no instalment/launch is authored for it.
 */
export type ConstructionScheduleBasis = "YARD_CAPACITY" | "FOREIGN_CONTRACT" | "UNAVAILABLE";

/**
 * Why a project has no running readout schedule: one of the held/terminal DESIGN-23 section 2 statuses, a revision hold
 * (ADR-0070), or a foreign order whose contract the snapshot cannot resolve.
 */
export type ConstructionScheduleUnavailableReason =
  | ConstructionProjectStatus
  | "REVISION_HOLD"
  | "FOREIGN_CONTRACT_MISSING";

/**
 * Compiled display readouts for one construction project, projected into a queue entry so the renderer can show the
 * instalment, schedule and cost without deriving any figure itself (SB3-R31): the monthly instalment, remaining months,
 * total cost, launch month and — for a `HALTED` project only — the half-mothball carrying cost it pays each month
 * (DESIGN-23 section 7). The `scheduleBasis` says which funding path the figures describe and
 * `scheduleUnavailableReason` names the status/hold when there is no running schedule (INC-3c). Every value is compiled
 * by the engine; the UI renders them verbatim.
 */
export interface ConstructionProjectReadoutView {
  readonly totalCostUnits: number;
  readonly monthlyInstalmentUnits: number;
  readonly remainingMonths: number;
  readonly launchMonth: string | null;
  readonly scheduleBasis: ConstructionScheduleBasis;
  /** The held/terminal status, revision hold or missing contract that leaves no running schedule; null when one runs. */
  readonly scheduleUnavailableReason: ConstructionScheduleUnavailableReason | null;
  /**
   * The project's stable delay reason code when it is held by a specific cause (e.g. `PAYMENT_DEFAULT_DELAYED` for a
   * foreign contract in payment default, DESIGN-16 section 13.4); absent when the project carries none. Display only.
   */
  readonly delayReasonCode?: string;
  /** The half-mothball carrying cost a HALTED project pays each month; null for a non-halted project. */
  readonly haltedCarryingCostUnits: number | null;
}

/**
 * The Construction screen's "Projects in Yard" list — a deterministic,
 * keyed-by-project-id projection of `nation.constructionProjects` (authored
 * starting builds AND orders queued by the desktop construction commands)
 * over the compiled snapshot, in the same convention as
 * `buildConstructionDesignCatalog` (pure, sorted for stable rendering).
 * `commandId` carries the workspace command id when the project came from a
 * construction order (linking a project row to its Command Ledger entry) and
 * `null` for authored starts.
 */
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
  /** True when the project's design kept its source draft (ADR-0070), so a `ReviseProject` can apply to it. */
  readonly revisable: boolean;
  /** First month the project may be funded again after a revision, or null when it is not on hold. */
  readonly holdUntilMonth: string | null;
  /** Per-package progress (ADR-0077); absent for a project with one work figure. */
  readonly packages?: readonly ConstructionProjectPackageView[];
  /** Id of the yard building the ship, when one was chosen (ADR-0077). */
  readonly yardId?: string;
  /** True when the project is a foreign construction contract (DESIGN-16 section 13); it cannot be accelerated. */
  readonly isForeign: boolean;
  /**
   * The compiled cost/time readout (SB3-R31), when the caller projected one. Absent from
   * `buildConstructionProjectQueue`, which is a pure snapshot projection and does not need the campaign month or the
   * ship-building content; `constructionProjectQueueWithReadouts` fills it.
   */
  readonly readout?: ConstructionProjectReadoutView;
}

/** One work package of a project, in plain numbers (ADR-0077). */
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
