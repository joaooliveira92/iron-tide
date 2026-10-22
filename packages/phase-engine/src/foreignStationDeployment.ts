import {
  applyDivisionCommand,
  assertDivisionInvariants,
  DIVISION_STATE_INVARIANT_FAILED,
  type CampaignSnapshot,
  type FleetState,
  type NationState,
  type PermanentDivision,
  type PresenceAreaRow,
  type Ship,
} from "@bluewave/campaign";
import { divisionAssetsFor } from "./divisionCommands.js";
import { foreignStationEvents } from "./events.js";
import type { MonthContext } from "./monthContext.js";

export const DIVISION_LEFT_FOR_FOREIGN_STATION_REASON = "FOREIGN_STATION_DEPLOYMENT" as const;

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function detachedFleetId(shipId: string): string {
  return `fleet-fs-${shipId}`;
}

function seaAdjacency(snapshot: CampaignSnapshot): Map<string, string[]> {
  const sea = new Set(snapshot.world.areas.filter((a) => a.type !== "land").map((a) => a.id));
  const adjacency = new Map<string, string[]>();
  const link = (from: string, to: string): void => {
    if (!sea.has(from) || !sea.has(to)) return;
    const list = adjacency.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    adjacency.set(from, list);
  };
  for (const route of snapshot.world.routes) {
    if (route.type !== "sea") continue;
    link(route.from, route.to);
    link(route.to, route.from);
  }
  for (const list of adjacency.values()) list.sort(byId);
  return adjacency;
}

function hopsFrom(target: string, adjacency: Map<string, string[]>): Map<string, number> {
  const distance = new Map<string, number>([[target, 0]]);
  const queue = [target];
  for (let i = 0; i < queue.length; i += 1) {
    const here = queue[i]!;
    for (const next of adjacency.get(here) ?? []) {
      if (distance.has(next)) continue;
      distance.set(next, distance.get(here)! + 1);
      queue.push(next);
    }
  }
  return distance;
}

export function nextHopToward(
  from: string,
  target: string,
  adjacency: Map<string, string[]>,
): string | null {
  const distance = hopsFrom(target, adjacency);
  const here = distance.get(from);
  if (here === undefined || here === 0) return null;
  return (adjacency.get(from) ?? []).find((n) => distance.get(n) === here - 1) ?? null;
}

function largestShortfall(rows: readonly PresenceAreaRow[]): PresenceAreaRow | undefined {
  let best: PresenceAreaRow | undefined;
  for (const row of rows) {
    if (
      best === undefined ||
      row.shortfallTons > best.shortfallTons ||
      (row.shortfallTons === best.shortfallTons && byId(row.areaId, best.areaId) < 0)
    ) {
      best = row;
    }
  }
  return best;
}

function replaceNation(
  snapshot: CampaignSnapshot,
  nationId: string,
  nation: NationState,
): CampaignSnapshot {
  const nations = new Map(snapshot.nations);
  nations.set(nationId, nation);
  return { ...snapshot, nations };
}

export function runForeignStationDeploymentStep(
  ctx: MonthContext,
  demand: readonly PresenceAreaRow[],
): void {
  if (demand.length === 0) return;
  const adjacency = seaAdjacency(ctx.currentSnapshot);
  const nationIds = [...new Set(demand.map((r) => r.nationId))].sort(byId);
  for (const nationId of nationIds) {
    const rows = demand.filter((r) => r.nationId === nationId);
    const target = largestShortfall(rows);
    if (target === undefined) continue;
    const shortAreas = new Set(rows.map((r) => r.areaId));
    const nation = ctx.currentSnapshot.nations.get(nationId);
    if (nation === undefined) continue;
    const stationed = nation.fleets
      .flatMap((fleet) => fleet.ships)
      .filter(
        (s) =>
          s.nationId === nationId &&
          s.stationAssignment === "FOREIGN_STATION" &&
          s.readiness === "ACTIVE" &&
          !shortAreas.has(s.locationAreaId),
      )
      .sort((a, b) => byId(a.id, b.id));
    for (const ship of stationed) deployShip(ctx, nationId, ship.id, target.areaId, adjacency);
  }
}

function deployShip(
  ctx: MonthContext,
  nationId: string,
  shipId: string,
  targetAreaId: string,
  adjacency: Map<string, string[]>,
): void {
  const snapshot = ctx.currentSnapshot;
  const nation = snapshot.nations.get(nationId)!;
  const fleet = nation.fleets.find((f) => f.ships.some((s) => s.id === shipId))!;
  const ship = fleet.ships.find((s) => s.id === shipId)!;
  const here = ship.locationAreaId;
  const month = ctx.campaignMonth;
  const nextArea = nextHopToward(here, targetAreaId, adjacency);
  if (nextArea === null) {
    ctx.eventLedger.append(
      foreignStationEvents.noRoute(nationId, shipId, here, targetAreaId, ctx.nextSeq(), month),
    );
    return;
  }

  const division = nation.divisions.find((d) => d.shipOrder.includes(shipId));
  let divisions: PermanentDivision[] = nation.divisions;
  let dissolved = false;
  if (division !== undefined) {
    dissolved = division.shipOrder.length === 1;
    if (dissolved) {
      divisions = nation.divisions.filter((d) => d.divisionId !== division.divisionId);
    } else {
      try {
        const next = applyDivisionCommand(
          division,
          { type: "remove_ship", shipId },
          month,
        ).division;
        assertDivisionInvariants(next, divisionAssetsFor(snapshot, nationId, next.shipOrder), {});
        divisions = nation.divisions.map((d) => (d.divisionId === division.divisionId ? next : d));
      } catch (e) {
        ctx.collector.addError(
          DIVISION_STATE_INVARIANT_FAILED,
          `Foreign-station ship ${shipId} cannot leave division ${division.divisionId}: ${(e as Error).message}`,
          { stage: "battle_resolution" },
        );
        return;
      }
    }
  }

  const alone = fleet.ships.length === 1;
  const movedShip: Ship = { ...ship, locationAreaId: nextArea };
  const movedFleetId = alone ? fleet.id : detachedFleetId(shipId);
  const fleets: FleetState[] = alone
    ? nation.fleets.map((f) =>
        f.id === fleet.id ? { ...f, locationAreaId: nextArea, ships: [movedShip] } : f,
      )
    : [
        ...nation.fleets.map((f) =>
          f.id === fleet.id ? { ...f, ships: f.ships.filter((s) => s.id !== shipId) } : f,
        ),
        {
          id: movedFleetId,
          nationId,
          name: ship.name,
          locationAreaId: nextArea,
          ships: [movedShip],
        },
      ];

  if (division !== undefined) {
    ctx.eventLedger.append(
      foreignStationEvents.leftDivision(
        nationId,
        shipId,
        division.divisionId,
        dissolved,
        DIVISION_LEFT_FOR_FOREIGN_STATION_REASON,
        ctx.nextSeq(),
        month,
      ),
    );
  }
  if (!alone) {
    ctx.eventLedger.append(
      foreignStationEvents.detached(
        nationId,
        shipId,
        fleet.id,
        movedFleetId,
        here,
        ctx.nextSeq(),
        month,
      ),
    );
  }
  ctx.eventLedger.append(
    foreignStationEvents.moved(
      nationId,
      shipId,
      movedFleetId,
      here,
      nextArea,
      targetAreaId,
      ctx.nextSeq(),
      month,
    ),
  );
  ctx.currentSnapshot = replaceNation(snapshot, nationId, { ...nation, fleets, divisions });
}
