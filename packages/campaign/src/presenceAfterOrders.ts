import { exerciseProblems } from "./fleetExercise.js";
import { advanceFleetRoute, orderFleetRoute } from "./fleetRoute.js";
import { fleetMoveProblem } from "./movement.js";
import {
  isPresenceExempt,
  measurePresence,
  type PresenceMeasurementRules,
  type StationPresenceRow,
} from "./presenceMeasurement.js";
import { readinessCommandProblems } from "./readinessCommand.js";
import type { CommandableReadiness } from "./readinessCommand.js";
import {
  setShipReadiness,
  stationAssignmentProblems,
  stationTargetFor,
  withStationAssignment,
} from "./stationAssignment.js";
import type { CampaignSnapshot, NationState, Ship } from "./state.js";

export type PresenceOrder =
  | {
      readonly type: "MOVE_FLEET";
      readonly fleetId: string;
      readonly toAreaId: string;
      readonly shipIds?: readonly string[];
    }
  | {
      readonly type: "SET_READINESS";
      readonly shipIds: readonly string[];
      readonly readiness: CommandableReadiness;
    }
  | {
      readonly type: "ASSIGN_STATION";
      readonly shipIds: readonly string[];
      readonly stationAreaId?: string;
    }
  | { readonly type: "CLEAR_STATION"; readonly shipIds: readonly string[] }
  | { readonly type: "HOLD_EXERCISE"; readonly shipIds: readonly string[] };

export type PresenceWarningSnapshot = Pick<
  CampaignSnapshot,
  "nations" | "world" | "designs" | "wars"
>;

export interface PresenceWarning {
  readonly nationId: string;
  readonly areaId: string;
  readonly requiredTons: number;
  readonly presentTonsBefore: number;
  readonly presentTonsAfter: number;
  readonly shortfallBefore: number;
  readonly shortfallAfter: number;
  readonly causes: readonly number[];
}

export interface PresenceAfterOrders {
  readonly exempt: boolean;
  readonly warnings: readonly PresenceWarning[];
}

function mapShips(
  snapshot: PresenceWarningSnapshot,
  nationId: string,
  shipIds: readonly string[],
  change: (ship: Ship) => Ship,
): PresenceWarningSnapshot {
  const nation = snapshot.nations.get(nationId);
  if (nation === undefined) return snapshot;
  const ids = new Set(shipIds);
  const updated: NationState = {
    ...nation,
    fleets: nation.fleets.map((fleet) => ({
      ...fleet,
      ships: fleet.ships.map((ship) => (ids.has(ship.id) ? change(ship) : ship)),
    })),
  };
  const nations = new Map(snapshot.nations);
  nations.set(nationId, updated);
  return { ...snapshot, nations };
}

export function applyPresenceOrder(
  snapshot: PresenceWarningSnapshot,
  nationId: string,
  order: PresenceOrder,
): PresenceWarningSnapshot {
  const nation = snapshot.nations.get(nationId);
  if (nation === undefined) return snapshot;
  switch (order.type) {
    case "MOVE_FLEET": {
      if (
        fleetMoveProblem(snapshot, nationId, order.fleetId, order.toAreaId, order.shipIds) !== null
      ) {
        return snapshot;
      }
      const routed = orderFleetRoute(
        snapshot,
        nationId,
        order.fleetId,
        order.toAreaId,
        order.shipIds,
      );
      return advanceFleetRoute(routed.snapshot, nationId, routed.routedFleetId);
    }
    case "SET_READINESS": {
      if (readinessCommandProblems(nation, nationId, order.shipIds, order.readiness).length > 0) {
        return snapshot;
      }
      return mapShips(
        snapshot,
        nationId,
        order.shipIds,
        (ship) => setShipReadiness(ship, order.readiness).ship,
      );
    }
    case "ASSIGN_STATION": {
      const target = stationTargetFor(snapshot.world, nationId, order.stationAreaId);
      if (stationAssignmentProblems(nation, nationId, order.shipIds, "assign", target).length > 0) {
        return snapshot;
      }
      return mapShips(snapshot, nationId, order.shipIds, (ship) =>
        withStationAssignment(ship, "assign", order.stationAreaId),
      );
    }
    case "CLEAR_STATION": {
      if (stationAssignmentProblems(nation, nationId, order.shipIds, "clear").length > 0) {
        return snapshot;
      }
      return mapShips(snapshot, nationId, order.shipIds, (ship) =>
        withStationAssignment(ship, "clear"),
      );
    }
    case "HOLD_EXERCISE": {
      if (exerciseProblems(nation, nationId, order.shipIds).length > 0) return snapshot;
      return mapShips(snapshot, nationId, order.shipIds, (ship) => ({
        ...ship,
        stationAssignment: "EXERCISE" as const,
      }));
    }
  }
}

function rowsFor(
  snapshot: PresenceWarningSnapshot,
  nationId: string,
  rules: PresenceMeasurementRules,
): Map<string, StationPresenceRow> {
  const rows = new Map<string, StationPresenceRow>();
  for (const row of measurePresence(snapshot, rules)) {
    if (row.nationId === nationId) rows.set(row.areaId, row);
  }
  return rows;
}

export function presenceAfterOrders(
  snapshot: PresenceWarningSnapshot,
  nationId: string,
  orders: readonly PresenceOrder[],
  rules: PresenceMeasurementRules,
  campaignMonth: string,
): PresenceAfterOrders {
  if (isPresenceExempt(snapshot, nationId, campaignMonth)) return { exempt: true, warnings: [] };
  const baseline = rowsFor(snapshot, nationId, rules);
  const causes = new Map<string, number[]>();
  let current = snapshot;
  let previous = baseline;
  orders.forEach((order, index) => {
    current = applyPresenceOrder(current, nationId, order);
    const next = rowsFor(current, nationId, rules);
    for (const [areaId, row] of next) {
      if (row.shortfallTons > (previous.get(areaId)?.shortfallTons ?? 0)) {
        causes.set(areaId, [...(causes.get(areaId) ?? []), index]);
      }
    }
    previous = next;
  });
  const warnings: PresenceWarning[] = [];
  for (const [areaId, row] of [...previous].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const before = baseline.get(areaId);
    const shortfallBefore = before?.shortfallTons ?? 0;
    if (row.shortfallTons <= shortfallBefore) continue;
    warnings.push({
      nationId,
      areaId,
      requiredTons: row.requiredTons,
      presentTonsBefore: before?.presentTons ?? 0,
      presentTonsAfter: row.presentTons,
      shortfallBefore,
      shortfallAfter: row.shortfallTons,
      causes: causes.get(areaId) ?? [],
    });
  }
  return { exempt: false, warnings };
}
