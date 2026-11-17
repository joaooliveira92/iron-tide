import {
  applyDivisionCommand,
  checkDivisionInvariants,
  DIVISION_STATE_INVARIANT_FAILED,
  nextHopToward,
  seaAdjacency,
  type SeaAdjacency,
  type FleetState,
  type PermanentDivision,
  type Ship,
  type StationPresenceRow,
} from "@bluewave/campaign";
import { Result } from "effect";
import { divisionAssetsFor } from "./divisionCommands.js";
import { foreignStationEvents } from "./events.js";
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";
import { presenceDemand } from "./presenceMeasurement.js";

export const DIVISION_LEFT_FOR_FOREIGN_STATION_REASON = "FOREIGN_STATION_DEPLOYMENT" as const;

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function detachedFleetId(shipId: string): string {
  return `fleet-fs-${shipId}`;
}

function largestShortfall(rows: readonly StationPresenceRow[]): StationPresenceRow | undefined {
  let best: StationPresenceRow | undefined;
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

export function runForeignStationDeploymentPhase(ctx: PhaseContext): PhaseRunOutcome {
  const rules = ctx.engineOptions?.presence;
  if (rules === undefined) return { status: "continue" };
  const demand: StationPresenceRow[] = presenceDemand(
    ctx.snapshot.view(),
    rules,
    ctx.campaignMonth,
  );

  const adjacency = seaAdjacency(ctx.snapshot.view().world);
  const nationIds = [...ctx.snapshot.view().nations.keys()].sort(byId);
  for (const nationId of nationIds) {
    const nation = ctx.snapshot.view().nations.get(nationId);
    if (nation === undefined) continue;
    const posted = nation.fleets
      .flatMap((fleet) => fleet.ships)
      .filter(
        (s) =>
          s.nationId === nationId &&
          s.stationAssignment === "FOREIGN_STATION" &&
          s.readiness === "ACTIVE",
      )
      .sort((a, b) => byId(a.id, b.id));
    if (posted.length === 0) continue;
    const rows = demand.filter((r) => r.nationId === nationId);
    const target = largestShortfall(rows);
    const shortAreas = new Set(rows.map((r) => r.areaId));
    for (const ship of posted) {
      if (ship.stationAreaId !== undefined) {
        if (ship.locationAreaId === ship.stationAreaId) continue;
        deployShip(ctx, nationId, ship.id, ship.stationAreaId, adjacency);
      } else if (target !== undefined && !shortAreas.has(ship.locationAreaId)) {
        deployShip(ctx, nationId, ship.id, target.areaId, adjacency);
      }
    }
  }
  return { status: "continue" };
}

function deployShip(
  ctx: PhaseContext,
  nationId: string,
  shipId: string,
  targetAreaId: string,
  adjacency: SeaAdjacency,
): void {
  const snapshot = ctx.snapshot.view();
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
      const next = applyDivisionCommand(division, { type: "remove_ship", shipId }, month).division;
      const invariants = checkDivisionInvariants(
        next,
        divisionAssetsFor(snapshot, nationId, next.shipOrder),
        {},
      );
      if (Result.isFailure(invariants)) {
        ctx.collector.addError(
          DIVISION_STATE_INVARIANT_FAILED,
          `Foreign-station ship ${shipId} cannot leave division ${division.divisionId}: ${invariants.failure.message}`,
          { stage: "foreign_station_deployment" },
        );
        return;
      }
      divisions = nation.divisions.map((d) => (d.divisionId === division.divisionId ? next : d));
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
  const nations = new Map(snapshot.nations);
  nations.set(nationId, { ...nation, fleets, divisions });
  ctx.snapshot.write("nations", nations);
}

export const foreignStationDeploymentPhase: MonthPhase = {
  id: "foreign_station_deployment",
  name: "Foreign Station Deployment",
  permissions: {
    reads: ["nations", "world", "designs", "wars"],
    writes: ["nations"],
    rng: false,
  },
  run: runForeignStationDeploymentPhase,
};
