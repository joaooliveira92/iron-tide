import type { PlayerBattleEvent, PlayerBattleView } from "@bluewave/combat/battleResolution";
import { playerSideOf } from "../../../../shared/player-battle-orders.js";

export type CombatLogCategory = "battle" | "contact" | "fire" | "damage";

export type CombatLogMessageKey =
  | "tactical.log.battle_start"
  | "tactical.log.contact_created"
  | "tactical.log.gunnery_salvo"
  | "tactical.log.damage_impact"
  | "tactical.log.smoke_fire"
  | "tactical.log.battle_end";

export interface CombatLogEntry {
  readonly sequence: number;
  readonly minute: number;
  readonly category: CombatLogCategory;
  readonly messageKey: CombatLogMessageKey;
  readonly actorShipId: string | null;
  readonly targetShipId: string | null;
  readonly params: Readonly<Record<string, string>>;
}

export function shipIdOf(reference: string, battleId: string): string {
  let id = reference;
  for (const prefix of ["obs-", "fire-smoke:", `${battleId}:`]) {
    if (id.startsWith(prefix)) id = id.slice(prefix.length);
  }
  if (id.startsWith(`${battleId}:`)) id = id.slice(battleId.length + 1);
  const battery = id.indexOf(":");
  return battery === -1 ? id : id.slice(0, battery);
}

interface Projection {
  readonly names: ReadonlyMap<string, string>;
  readonly sides: ReadonlyMap<string, string>;
  readonly playerSide: string | null;
  readonly battleId: string;
}

function entryFor(
  event: PlayerBattleEvent,
  sequence: number,
  projection: Projection,
): CombatLogEntry | null {
  const actor = shipIdOf(event.actorId, projection.battleId);
  const target = shipIdOf(event.targetId, projection.battleId);
  const nameOf = (id: string): string => projection.names.get(id) ?? id;
  const base = { sequence, minute: event.minute };
  switch (event.eventType) {
    case "contact_created":
      if (projection.sides.get(target) === projection.playerSide) return null;
      return {
        ...base,
        category: "contact",
        messageKey: "tactical.log.contact_created",
        actorShipId: null,
        targetShipId: target,
        params: { target: nameOf(target) },
      };
    case "gunnery_salvo":
      return {
        ...base,
        category: "fire",
        messageKey: "tactical.log.gunnery_salvo",
        actorShipId: actor,
        targetShipId: target,
        params: { actor: nameOf(actor), target: nameOf(target) },
      };
    case "damage_impact":
      return {
        ...base,
        category: "damage",
        messageKey: "tactical.log.damage_impact",
        actorShipId: actor,
        targetShipId: target,
        params: { actor: nameOf(actor), target: nameOf(target) },
      };
    case "smoke_fire":
      return {
        ...base,
        category: "damage",
        messageKey: "tactical.log.smoke_fire",
        actorShipId: actor,
        targetShipId: null,
        params: { actor: nameOf(actor) },
      };
    default:
      return null;
  }
}

export function projectCombatLog(view: PlayerBattleView): readonly CombatLogEntry[] {
  const projection: Projection = {
    names: new Map(view.ships.map((ship) => [ship.shipId, ship.name])),
    sides: new Map(view.ships.map((ship) => [ship.shipId, ship.sideId])),
    playerSide: playerSideOf(view),
    battleId: view.battleId,
  };
  const entries: CombatLogEntry[] = [
    {
      sequence: -1,
      minute: 0,
      category: "battle",
      messageKey: "tactical.log.battle_start",
      actorShipId: null,
      targetShipId: null,
      params: { area: view.areaId },
    },
  ];
  view.log.forEach((event, sequence) => {
    const entry = entryFor(event, sequence, projection);
    if (entry !== null) entries.push(entry);
  });
  if (view.ended) {
    entries.push({
      sequence: view.log.length,
      minute: view.minute,
      category: "battle",
      messageKey: "tactical.log.battle_end",
      actorShipId: null,
      targetShipId: null,
      params: { reason: view.endReason ?? "unknown" },
    });
  }
  return entries;
}

export interface TransientMarkers {
  readonly firing: readonly { readonly actorShipId: string; readonly targetShipId: string }[];
  readonly impacts: readonly string[];
}

export function transientMarkers(
  entries: readonly CombatLogEntry[],
  minute: number,
): TransientMarkers {
  const current = entries.filter((entry) => entry.minute === minute);
  const firing = current
    .filter((entry) => entry.category === "fire")
    .flatMap((entry) =>
      entry.actorShipId === null || entry.targetShipId === null
        ? []
        : [{ actorShipId: entry.actorShipId, targetShipId: entry.targetShipId }],
    );
  const impacts = current
    .filter((entry) => entry.messageKey === "tactical.log.damage_impact")
    .flatMap((entry) => (entry.targetShipId === null ? [] : [entry.targetShipId]));
  return { firing, impacts };
}
