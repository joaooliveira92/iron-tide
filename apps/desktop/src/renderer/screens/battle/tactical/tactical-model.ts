import type { WorldPoint } from "./tactical-geometry.js";
import type { TacticalShip, TacticalView } from "./tactical-view.js";

export type ShipStatus = "operational" | "damaged" | "sunk";

export const PROVISIONAL_TRAIL_LENGTH = 12;

export function shipStatus(ship: TacticalShip): ShipStatus {
  if (ship.damageState === "SINKING" || ship.damageState === "FOUNDERED") return "sunk";
  const worn =
    ship.hitPoints !== null && ship.maxHitPoints !== null && ship.hitPoints < ship.maxHitPoints;
  if (ship.damageState !== "NORMAL" || worn) return "damaged";
  return "operational";
}

export type Trails = Readonly<Record<string, readonly WorldPoint[]>>;

export function appendTrails(trails: Trails, view: TacticalView): Trails {
  const next: Record<string, readonly WorldPoint[]> = {};
  let changed = false;
  for (const ship of view.ships) {
    if (ship.position === null) continue;
    const previous = trails[ship.shipId];
    const history = previous ?? [];
    const last = history.at(-1);
    const point: WorldPoint = [ship.position[0], ship.position[1]];
    const moved = last === undefined || last[0] !== point[0] || last[1] !== point[1];
    if (moved || previous === undefined) changed = true;
    next[ship.shipId] = moved ? [...history, point].slice(-PROVISIONAL_TRAIL_LENGTH) : history;
  }
  if (!changed && Object.keys(next).length === Object.keys(trails).length) return trails;
  return next;
}

export function selectedShip(
  view: TacticalView,
  selectedShipId: string | null,
): TacticalShip | null {
  if (selectedShipId === null) return null;
  return view.ships.find((ship) => ship.shipId === selectedShipId) ?? null;
}

export function divisionOfShip(view: TacticalView, shipId: string): string | null {
  return view.ships.find((ship) => ship.shipId === shipId)?.divisionId ?? null;
}

export function knownPositions(view: TacticalView): readonly WorldPoint[] {
  return view.ships.flatMap((ship) =>
    ship.position === null ? [] : [[ship.position[0], ship.position[1]] as const],
  );
}

export function shipPoint(ship: TacticalShip): WorldPoint | null {
  return ship.position === null ? null : [ship.position[0], ship.position[1]];
}

export function shortDivisionId(divisionId: string): string {
  return divisionId.slice(divisionId.lastIndexOf(":") + 1);
}
