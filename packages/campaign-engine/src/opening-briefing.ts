import type { CampaignState } from "@bluewave/campaign";
import { isShipOperational, scaleValue } from "@bluewave/campaign";
import { buildDiplomacyScreenProjection } from "./diplomacy.js";
import { constructionShipTypeLabel, projectedConstructionOrderCosts } from "./construction.js";
import type { PlayerProjectionMonth } from "./projection.js";

/**
 * Opening Strategic Briefing projection (game-onboarding INC-8, spec §8).
 *
 * The briefing runs once, immediately after world generation and before the
 * player reaches the Overview dashboard — that is, BEFORE any `commitMonth`
 * has run. `MonthReport`/`FinancialLedgerEntry` are produced only by
 * `commitMonth`, so they do not exist at this point; every field here is a
 * pure, deterministic derivation over the compiled `CampaignSnapshot`'s
 * `NationState` and `world`/`designs` — nothing fabricated and no new domain
 * concept introduced (the joins are exactly the ones spec §8 spells out,
 * projected onto the opening pre-first-month snapshot).
 *
 * Where the spec cites a `MonthReport` field that only exists after a month
 * commit, the equivalent is derived from the snapshot by replicating the
 * engine's own formula (see `fleetMaintenance` below) or by surfacing the
 * honest snapshot value (see `constructionCommitted`).
 *
 * Returns `undefined` when `playerSlotId` doesn't resolve to a nation — the
 * same convention as `buildPlayerProjection`; the desktop handler turns that
 * into a stable `UNKNOWN_PLAYER_SLOT` error result.
 */

/** One row of the "State of the Navy" ship-class inventory tally. */
export interface OpeningBriefingShipClassCount {
  readonly label: string;
  readonly count: number;
}

/** One rival's relations row on the "Foreign Intelligence" page. */
export interface OpeningBriefingRelationsRow {
  readonly nationId: string;
  readonly name: string;
  readonly relation: "neutral" | "allied" | "at_war" | "trade_agreement";
  readonly tension: number;
}

export type OpeningBriefingTreasuryStatus = "healthy" | "narrow" | "deficit" | "critical";

/** One "Immediate Concerns" category with its display message. */
export interface OpeningBriefingConcern {
  readonly category:
    | "obsolescence"
    | "budget_shortfall"
    | "near_complete_construction"
    | "low_research_spending";
  readonly message: string;
}

/** The Opening Strategic Briefing's full slice of the compiled snapshot. */
export interface OpeningBriefingProjection {
  readonly nationId: string;
  readonly nationName: string;
  readonly month: PlayerProjectionMonth;
  readonly stateOfTheNavy: {
    readonly shipClassCounts: readonly OpeningBriefingShipClassCount[];
    readonly shipsUnderConstruction: number;
    readonly mostExpensiveActiveClass: {
      readonly className: string;
      readonly projectedCost: number;
    } | null;
    readonly largestDockCapacity: number;
    readonly totalMaintenance: number;
    readonly constructionCommitted: number;
  };
  readonly treasury: {
    readonly governmentAllocation: number;
    readonly fleetMaintenance: number;
    readonly constructionCommitted: number;
    readonly researchExpenditure: number;
    readonly projectedSurplus: number;
    readonly status: OpeningBriefingTreasuryStatus;
  };
  readonly foreignIntelligence: {
    readonly relations: readonly OpeningBriefingRelationsRow[];
  };
  readonly immediateConcerns: readonly OpeningBriefingConcern[];
}

/**
 * Versioned replication of the engine's per-ship maintenance formula
 * (`packages/phase-engine/src/month.ts` `computeMaintenanceCost`: floor of
 * `hitPoints * 10 / 100`). `campaign-engine` cannot import `phase-engine`
 * (package boundary), so the formula is reproduced here, pinned by a test.
 * The compiled `NationState.maintenanceCost` is always 0 before the first
 * `commitMonth` (compiler sets it unconditionally and `commitMonth` is the
 * only place it is populated), so the briefing must derive it from ships.
 */
export const MAINTENANCE_FORMULA_ID = "maintenance_v1";
export const MAINTENANCE_FORMULA_VERSION = "1.0.0";

export function shipMaintenanceCost(hitPoints: number): number {
  return Math.floor((hitPoints * 10) / 100);
}

/**
 * Qualitative treasury status (spec §8 page 3): lightweight UI-only threshold
 * logic over the real projected-surplus number, relative to the government
 * allocation. Exact thresholds are an implementation detail (spec §8).
 * Guarded against a zero/negative allocation so a degenerate nation still
 * classifies deterministically rather than dividing by zero.
 */
function treasuryStatus(
  projectedSurplus: number,
  governmentAllocation: number,
): OpeningBriefingTreasuryStatus {
  const baseline = governmentAllocation > 0 ? governmentAllocation : 1;
  if (projectedSurplus >= 0.25 * baseline) return "healthy";
  if (projectedSurplus >= 0) return "narrow";
  if (projectedSurplus >= -0.1 * baseline) return "deficit";
  return "critical";
}

/** Total work the nation has already paid into its construction projects. */
export function totalPaidWork(nation: {
  readonly constructionProjects: readonly { readonly paidWork: unknown }[];
}): number {
  return nation.constructionProjects.reduce((sum, project) => sum + Number(project.paidWork), 0);
}

export function buildOpeningBriefingProjection(
  state: CampaignState,
  playerSlotId: string,
  month: PlayerProjectionMonth,
): OpeningBriefingProjection | undefined {
  const snapshot = state.snapshot;
  const nation = snapshot.nations.get(playerSlotId);
  if (nation === undefined) return undefined;

  // --- State of the Navy (spec §8 page 2) -----------------------------------
  // Ship-class inventory: every fleet ship's designVersionId -> design catalog
  // -> hullType -> constructionShipTypeLabel, tallied.
  const shipClassCounts = new Map<string, number>();
  for (const fleet of nation.fleets) {
    for (const ship of fleet.ships) {
      const design = snapshot.designs.get(ship.designVersionId);
      const label = design ? constructionShipTypeLabel(design.hullType) : "unknown";
      shipClassCounts.set(label, (shipClassCounts.get(label) ?? 0) + 1);
    }
  }
  const sortedShipClassCounts: OpeningBriefingShipClassCount[] = [...shipClassCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));

  // Ships under construction: authored + queued ship projects not yet complete.
  const shipsUnderConstruction = nation.constructionProjects.filter(
    (project) => project.type === "ship" && project.status !== "COMPLETED",
  ).length;

  // Most-expensive active class: the active fleet's design with the largest
  // projected order cost (the same derived cost the Construction screen uses).
  let mostExpensiveActiveClass: {
    readonly className: string;
    readonly projectedCost: number;
  } | null = null;
  for (const fleet of nation.fleets) {
    for (const ship of fleet.ships) {
      if (!isShipOperational(ship)) continue;
      const design = snapshot.designs.get(ship.designVersionId);
      if (design === undefined) continue;
      const cost = projectedConstructionOrderCosts(design).projectedCost;
      if (mostExpensiveActiveClass === null || cost > mostExpensiveActiveClass.projectedCost) {
        mostExpensiveActiveClass = { className: design.className, projectedCost: cost };
      }
    }
  }

  // Largest-available-dock: the nation's own largest port level (the same
  // documented-as-approximate port-level proxy buildPlayerProjection uses).
  const largestDockCapacity = snapshot.world.ports
    .filter((port) => port.nationId === playerSlotId)
    .reduce((max, port) => Math.max(max, Number(port.level)), 0);

  // Total maintenance: replicated from the engine's computeMaintenanceCost
  // over every fleet ship (see MAINTENANCE_FORMULA_ID). NOT
  // `nation.maintenanceCost`, which is always 0 before the first commitMonth.
  const fleetMaintenance = nation.fleets.reduce(
    (sum, fleet) =>
      sum + fleet.ships.reduce((s, ship) => s + shipMaintenanceCost(Number(ship.hitPoints)), 0),
    0,
  );

  // Construction committed: the nation's total paid work across all
  // construction projects — the honest snapshot value at opening time. The
  // spec's `MonthReport.newConstructionSpending` is a *monthly* figure that
  // only exists after a commitMonth; there is no pre-commit monthly datum, so
  // we surface the cumulative commitment instead of fabricating a monthly one.
  const constructionCommitted = totalPaidWork(nation);

  // --- Treasury (spec §8 page 3) --------------------------------------------
  // Government allocation reuses the engine's own basis-point scaling formula
  // (scaleValue) over income and navalAppropriationRateBp — identical to
  // PlayerProjectionEconomy.monthlyAppropriation.
  const governmentAllocation = Number(
    scaleValue(Number(nation.income), Number(nation.navalAppropriationRateBp)),
  );
  const researchExpenditure = Number(nation.research.researchBudget);
  const projectedSurplus =
    governmentAllocation - fleetMaintenance - constructionCommitted - researchExpenditure;

  // --- Foreign Intelligence (spec §8 page 4) --------------------------------
  // Relations label + tension score only — no ship counts, no intel-quality
  // tiering (both are out-of-scope fog-of-war concepts). Reuses the engine's
  // own diplomacy projection to avoid duplicating the relation-shaping logic.
  const relations: OpeningBriefingRelationsRow[] = (
    buildDiplomacyScreenProjection(state, playerSlotId, month)?.relations ?? []
  ).map((relation) => ({
    nationId: relation.partnerNationId,
    name: relation.partnerName,
    relation: relation.relation,
    tension: relation.tension,
  }));

  // --- Immediate Concerns (spec §8 page 5) ----------------------------------
  // Four categories only, each triggered by real snapshot data; exact
  // thresholds are this ticket's implementation detail.
  const hasCapitalShip = [...shipClassCounts.entries()].some(
    ([label, count]) => count > 0 && (label === "battleship" || label === "battlecruiser"),
  );
  const hasNearCompleteProject = nation.constructionProjects.some((project) => {
    const total = Number(project.totalWork);
    return (
      total > 0 && Number(project.completedWork) / total >= 0.9 && project.status !== "COMPLETED"
    );
  });

  const immediateConcerns: OpeningBriefingConcern[] = [];
  if (!hasCapitalShip) {
    immediateConcerns.push({
      category: "obsolescence",
      message:
        "Your battle line lacks a modern capital ship. Authorizing a new battleship class should be a priority.",
    });
  }
  if (projectedSurplus < 0) {
    immediateConcerns.push({
      category: "budget_shortfall",
      message:
        "The projected monthly budget runs a deficit. Review maintenance, construction, and research spending.",
    });
  }
  if (hasNearCompleteProject) {
    immediateConcerns.push({
      category: "near_complete_construction",
      message:
        "A hull is nearing completion and will soon demand crew, armament, and operating funds.",
    });
  }
  if (governmentAllocation <= 0 || researchExpenditure < 0.1 * governmentAllocation) {
    immediateConcerns.push({
      category: "low_research_spending",
      message:
        "Research spending is low relative to the naval budget. Investment here drives future ship classes.",
    });
  }

  return {
    nationId: playerSlotId,
    nationName: nation.name,
    month,
    stateOfTheNavy: {
      shipClassCounts: sortedShipClassCounts,
      shipsUnderConstruction,
      mostExpensiveActiveClass,
      largestDockCapacity,
      totalMaintenance: fleetMaintenance,
      constructionCommitted,
    },
    treasury: {
      governmentAllocation,
      fleetMaintenance,
      constructionCommitted,
      researchExpenditure,
      projectedSurplus,
      status: treasuryStatus(projectedSurplus, governmentAllocation),
    },
    foreignIntelligence: { relations },
    immediateConcerns,
  };
}
