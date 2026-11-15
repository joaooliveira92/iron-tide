import { SafeInt } from "@bluewave/contracts";
import {
  contributesToPresence,
  measurePresence,
  shipCountedKg,
  type PresenceMeasurementRules,
  type StationPresenceRow,
} from "./presenceMeasurement.js";
import type { CampaignSnapshot, Ship } from "./state.js";

const KG_PER_TON = SafeInt(1_000);

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export interface SurplusShip {
  readonly id: string;
  readonly tons: number;
}

function countedTons(
  snapshot: Pick<CampaignSnapshot, "designs">,
  ship: Ship,
  countBp: number,
): number {
  const design = snapshot.designs.get(ship.designVersionId);
  if (design === undefined) return 0;
  const counted = shipCountedKg(
    design.normalizedDisplacementKg,
    {
      colonialOnForeignStation:
        ship.colonialServiceFitted === true && ship.stationAssignment === "FOREIGN_STATION",
      reduced: design.crampedAccommodation === true || design.shortRange === true,
    },
    countBp,
  );
  return SafeInt.div(counted, KG_PER_TON, "floor");
}

function leavesItsArea(ship: Ship, row: StationPresenceRow | undefined): boolean {
  if (ship.stationAssignment !== "FOREIGN_STATION") return false;
  if (ship.stationAreaId !== undefined) return ship.stationAreaId !== ship.locationAreaId;
  return row === undefined || row.shortfallTons === 0;
}

export function surplusShips(
  snapshot: Pick<CampaignSnapshot, "nations" | "world" | "designs">,
  nationId: string,
  rules: PresenceMeasurementRules,
  eligibleShipIds: ReadonlySet<string>,
): SurplusShip[] {
  const nation = snapshot.nations.get(nationId);
  if (nation === undefined) return [];
  const rowByArea = new Map<string, StationPresenceRow>();
  for (const row of measurePresence(snapshot, rules)) {
    if (row.nationId === nationId) rowByArea.set(row.areaId, row);
  }
  const holdingByArea = new Map<string, number>();
  for (const [areaId, row] of rowByArea) holdingByArea.set(areaId, row.presentTons);
  const idleByArea = new Map<string, SurplusShip[]>();
  for (const ship of nation.fleets.flatMap((fleet) => fleet.ships)) {
    if (ship.nationId !== nationId || !contributesToPresence(ship)) continue;
    const row = rowByArea.get(ship.locationAreaId);
    const tons = countedTons(snapshot, ship, rules.crampedOrShortRangeCountBp);
    const idle = ship.stationAssignment === undefined && eligibleShipIds.has(ship.id);
    if (idle) {
      const list = idleByArea.get(ship.locationAreaId) ?? [];
      list.push({ id: ship.id, tons });
      idleByArea.set(ship.locationAreaId, list);
      continue;
    }
    const ignored = leavesItsArea(ship, row) || !eligibleShipIds.has(ship.id);
    if (ignored && row !== undefined) {
      holdingByArea.set(ship.locationAreaId, (holdingByArea.get(ship.locationAreaId) ?? 0) - tons);
    }
  }
  const surplus: SurplusShip[] = [];
  for (const [areaId, ships] of idleByArea) {
    ships.sort((a, b) => b.tons - a.tons || byId(a.id, b.id));
    const row = rowByArea.get(areaId);
    if (row === undefined) {
      surplus.push(...ships);
      continue;
    }
    let holding = holdingByArea.get(areaId) ?? 0;
    for (const ship of ships) {
      if (holding - ship.tons < row.requiredTons) continue;
      holding -= ship.tons;
      surplus.push(ship);
    }
  }
  return surplus.sort((a, b) => a.tons - b.tons || byId(a.id, b.id));
}

export function chargeablePresenceRows(
  snapshot: Pick<CampaignSnapshot, "nations" | "world" | "designs">,
  nationId: string,
  rows: readonly StationPresenceRow[],
  rules: PresenceMeasurementRules,
  eligibleShipIds: ReadonlySet<string>,
): StationPresenceRow[] {
  const available = surplusShips(snapshot, nationId, rules, eligibleShipIds);
  const wanted = rows
    .filter((row) => row.nationId === nationId)
    .sort((a, b) => a.shortfallTons - b.shortfallTons || byId(a.areaId, b.areaId));
  const chargeable: StationPresenceRow[] = [];
  for (const row of wanted) {
    const index = available.findIndex((ship) => ship.tons >= row.shortfallTons);
    if (index < 0) continue;
    available.splice(index, 1);
    chargeable.push(row);
  }
  return chargeable.sort((a, b) => byId(a.areaId, b.areaId));
}
