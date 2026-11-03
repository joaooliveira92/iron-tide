import type { PlayerBattleShipView, PlayerBattleView } from "@bluewave/combat/battleResolution";
import type { WorldPoint } from "./tactical-geometry.js";

export type ShipStatus = "operational" | "damaged" | "sunk";

export const PROVISIONAL_TRAIL_LENGTH = 12;

export function shipStatus(ship: PlayerBattleShipView): ShipStatus {
  if (ship.damageState === "SINKING" || ship.damageState === "FOUNDERED") return "sunk";
  if (ship.damageState !== "NORMAL" || ship.hitPoints < ship.maxHitPoints) return "damaged";
  return "operational";
}

export type Trails = Readonly<Record<string, readonly WorldPoint[]>>;

export function appendTrails(trails: Trails, view: PlayerBattleView): Trails {
  const next: Record<string, readonly WorldPoint[]> = {};
  for (const ship of view.ships) {
    if (ship.position === null) continue;
    const history = trails[ship.shipId] ?? [];
    const last = history.at(-1);
    const point: WorldPoint = [ship.position[0], ship.position[1]];
    const moved = last === undefined || last[0] !== point[0] || last[1] !== point[1];
    next[ship.shipId] = moved ? [...history, point].slice(-PROVISIONAL_TRAIL_LENGTH) : history;
  }
  return next;
}

export function selectedShip(
  view: PlayerBattleView,
  selectedShipId: string | null,
): PlayerBattleShipView | null {
  if (selectedShipId === null) return null;
  return view.ships.find((ship) => ship.shipId === selectedShipId) ?? null;
}

export function divisionOfShip(view: PlayerBattleView, shipId: string): string | null {
  return view.ships.find((ship) => ship.shipId === shipId)?.divisionId ?? null;
}

export function knownPositions(view: PlayerBattleView): readonly WorldPoint[] {
  return view.ships.flatMap((ship) =>
    ship.position === null ? [] : [[ship.position[0], ship.position[1]] as const],
  );
}

export function shipPoint(ship: PlayerBattleShipView): WorldPoint | null {
  return ship.position === null ? null : [ship.position[0], ship.position[1]];
}

export function shortDivisionId(divisionId: string): string {
  return divisionId.slice(divisionId.lastIndexOf(":") + 1);
}
