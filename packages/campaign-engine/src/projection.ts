import type { CampaignState } from "@bluewave/campaign";
import { scaleValue } from "@bluewave/campaign";
import { shipMaintenanceCost, totalPaidWork } from "./opening-briefing.js";

/**
 * One nation's slice of `CampaignSnapshot`, flattened for UI convenience.
 * Shape confirmed in the desktop-mvp map, ticket 07 (Q15), with fields
 * grounded in `overview-screen-state.test.ts` and `OverviewScreen.tsx`.
 */
export interface PlayerProjectionEconomy {
  readonly treasury: number;
  readonly monthlyAppropriation: number;
  readonly shipyardCapacity: number;
  /**
   * The nation's total committed work across its construction projects — the
   * cumulative `sum(Number(project.paidWork))`. Mirrors the honest snapshot
   * value `buildOpeningBriefingProjection` documents as `constructionCommitted`
   * (`opening-briefing.ts`): there is no pre-commit monthly construction
   * figure (`MonthReport.newConstructionSpending` only exists after a
   * `commitMonth`), so this surfaces the cumulative commitment, not a
   * fabricated monthly number.
   */
  readonly constructionSpend: number;
  /**
   * The nation's current research expenditure — a direct read of
   * `nation.research.researchBudget`.
   */
  readonly researchSpend: number;
  /**
   * The nation's fleet maintenance — re-derived from its ships
   * (`shipMaintenanceCost` per hull), never the raw `nation.maintenanceCost`
   * (0 before the first `commitMonth`). Same derivation as
   * `projectedSurplusDeficit`'s.
   */
  readonly maintenanceCost: number;
}

export interface PlayerProjectionPort {
  readonly id: string;
  readonly name: string;
  readonly areaId: string;
  readonly capacity: number;
}

export interface PlayerProjectionShip {
  readonly name: string;
  readonly designId: string;
}

export interface PlayerProjectionDivision {
  readonly name: string;
  readonly areaId: string;
  readonly ships: readonly PlayerProjectionShip[];
}

export interface PlayerProjectionFleet {
  readonly name: string;
  readonly divisions: readonly PlayerProjectionDivision[];
}

export interface PlayerProjectionStrategicArea {
  readonly id: string;
  readonly name: string;
}

export interface PlayerProjectionMonth {
  readonly month: number;
  readonly year: number;
}

export interface PlayerProjectionCommandWorkspace {
  readonly commands: readonly unknown[];
  readonly movementCommands: readonly unknown[];
}

export interface PlayerProjection {
  readonly campaignIdentity: string;
  readonly snapshotHash: string;
  readonly revision: number;
  readonly month: PlayerProjectionMonth;
  /**
   * The nation id of the player slot this projection was built for. Derived,
   * read-only projection data (never authoritative state and never persisted):
   * it lets presentation tell the player's side from the AI's without guessing
   * from ordering or nation identity.
   */
  readonly playerNationId: string;
  readonly nationName: string;
  /**
   * Projected monthly surplus/deficit for the nation, derived from the same
   * raw fields Treasury uses and reusing the briefing's `projectedSurplus`
   * chain: `governmentAllocation (= scaleValue(income, navalAppropriationRateBp))`
   * minus fleet maintenance (re-derived from ships — never the raw
   * `nation.maintenanceCost`, which is 0 before the first `commitMonth`),
   * minus committed construction work, minus research expenditure. Purely
   * derived over the immutable snapshot.
   */
  readonly projectedSurplusDeficit: number;
  readonly economy: PlayerProjectionEconomy;
  readonly fleet: readonly PlayerProjectionFleet[];
  readonly ports: readonly PlayerProjectionPort[];
  readonly knownTechnologyIds: readonly string[];
  readonly strategicAreas: readonly PlayerProjectionStrategicArea[];
  readonly knownEnemyNations: readonly string[];
  readonly commandWorkspace: PlayerProjectionCommandWorkspace;
}

/**
 * Builds a `PlayerProjection` for `playerSlotId` from a real compiled
 * `CampaignState` — the function ticket 12 found missing (only the type
 * existed). Every field is derived from real snapshot data, not
 * placeholders:
 *
 * - `economy.monthlyAppropriation` reuses `@bluewave/campaign`'s existing
 *   basis-point scaling formula (`scaleValue`) over the nation's income and
 *   its own `navalAppropriationRateBp`, rather than inventing a new formula.
 * - `economy.shipyardCapacity` and each port's `capacity` are the nation's
 *   own ports' authored `level` — there is no dedicated "shipyard capacity"
 *   concept elsewhere in the engine yet, so port level is the closest real,
 *   non-fabricated proxy (documented judgment call, ticket 12).
 * - `economy.constructionSpend` is the cumulative committed construction work
 *   (`sum(paidWork)` — the honest pre-commit value, same as the briefing's
 *   `constructionCommitted`), and `economy.researchSpend` is the real
 *   `researchBudget` (direct read).
 * - `nationName` is `NationState.name`; `projectedSurplusDeficit` reuses the
 *   briefing's `projectedSurplus` chain (`monthlyAppropriation` minus fleet
 *   maintenance re-derived from ships, committed construction, research
 *   spend) — never the raw `maintenanceCost` (0 pre-first-commit).
 * - `fleet` flattens each compiled `FleetState` into one division carrying
 *   all of its ships — the compiled snapshot has no separate division
 *   grouping under a fleet (see `commandWorkspace`, deliberately left empty:
 *   real command listings are tickets 09/10's concern, not this one).
 * - `strategicAreas` are the world areas this nation controls.
 * - `knownTechnologyIds` is the nation's `research.discoveredTechs`.
 * - `knownEnemyNations` are derived from `politics.relations` where the
 *   relation is `at_war` and this nation is a party.
 *
 * Returns `undefined` if `playerSlotId` doesn't resolve to a nation in the
 * snapshot.
 */
export function buildPlayerProjection(
  state: CampaignState,
  playerSlotId: string,
  month: PlayerProjectionMonth,
): PlayerProjection | undefined {
  const snapshot = state.snapshot;
  const nation = snapshot.nations.get(playerSlotId);
  if (nation === undefined) return undefined;

  const ports: PlayerProjectionPort[] = snapshot.world.ports
    .filter((port) => port.nationId === playerSlotId)
    .map((port) => ({
      id: port.id,
      name: port.name,
      areaId: port.areaId,
      capacity: Number(port.level),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const shipyardCapacity = ports.reduce((sum, port) => sum + port.capacity, 0);
  const monthlyAppropriation = Number(
    scaleValue(Number(nation.income), Number(nation.navalAppropriationRateBp)),
  );

  // Construction spend: cumulative committed work across construction
  // projects (honest pre-commit value — see `PlayerProjectionEconomy`).
  const constructionSpend = totalPaidWork(nation);
  // Research spend: direct read of the real research budget.
  const researchSpend = Number(nation.research.researchBudget);
  // Fleet maintenance: re-derived from ships (never the raw `maintenanceCost`,
  // which is 0 before the first commitMonth).
  const fleetMaintenance = nation.fleets.reduce(
    (sum, fleet) =>
      sum +
      fleet.ships.reduce((s, ship) => s + shipMaintenanceCost(ship.hitPoints, ship.readiness), 0),
    0,
  );
  // Projected surplus/deficit — the briefing's `projectedSurplus` chain.
  const projectedSurplusDeficit =
    monthlyAppropriation - fleetMaintenance - constructionSpend - researchSpend;

  const fleet: PlayerProjectionFleet[] = nation.fleets.map((f) => ({
    name: f.name,
    divisions: [
      {
        name: f.name,
        areaId: f.locationAreaId,
        ships: f.ships.map((ship) => ({
          name: ship.name,
          designId: ship.designVersionId,
        })),
      },
    ],
  }));

  const strategicAreas: PlayerProjectionStrategicArea[] = snapshot.world.areas
    .filter((area) => area.controller === playerSlotId)
    .map((area) => ({ id: area.id, name: area.name }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const knownEnemyNations = [
    ...new Set(
      snapshot.politics.relations
        .filter(
          (relation) =>
            relation.relation === "at_war" &&
            (relation.nationA === playerSlotId || relation.nationB === playerSlotId),
        )
        .map((relation) =>
          relation.nationA === playerSlotId ? relation.nationB : relation.nationA,
        ),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return {
    campaignIdentity: snapshot.campaignId,
    snapshotHash: state.rawHash,
    revision: Number(snapshot.turnNumber),
    month,
    playerNationId: playerSlotId,
    nationName: nation.name,
    projectedSurplusDeficit,
    economy: {
      treasury: Number(nation.treasury),
      monthlyAppropriation,
      shipyardCapacity,
      constructionSpend,
      researchSpend,
      maintenanceCost: fleetMaintenance,
    },
    fleet,
    ports,
    knownTechnologyIds: [...nation.research.discoveredTechs].sort((a, b) => a.localeCompare(b)),
    strategicAreas,
    knownEnemyNations,
    commandWorkspace: { commands: [], movementCommands: [] },
  };
}
