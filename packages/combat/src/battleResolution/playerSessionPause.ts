import { WAYPOINT_REACHED_EVENT_TYPE } from "../orders/constants.js";
import type { BattleSide } from "./viability.js";
import type { PlayerBattleEvent, PlayerBattleSession } from "./playerSessionTypes.js";
import {
  FRIENDLY_HIT_EVENT_TYPES,
  RUN_PAUSE_PRECEDENCE,
  TORPEDO_EVENT_TYPES,
} from "./runConstants.js";
import type { RunPauseKind } from "./runRequest.js";

export type MinutePauseKind = (typeof RUN_PAUSE_PRECEDENCE)[number];

export function playerSideOf(session: PlayerBattleSession): BattleSide {
  return session.attackerId === session.playerNationId ? "ATTACKER" : "DEFENDER";
}

export function enemyContactIds(session: PlayerBattleSession): ReadonlySet<string> {
  const side = playerSideOf(session);
  return new Set(
    (session.state.contacts ?? [])
      .filter((contact) => contact.sideId !== side && !contact.stale)
      .map((contact) => contact.contactId),
  );
}

export function holdsEnemyContact(session: PlayerBattleSession): boolean {
  return enemyContactIds(session).size > 0;
}

function sunkShipIds(session: PlayerBattleSession): ReadonlySet<string> {
  return new Set(
    Object.entries(session.damage.targets)
      .filter(([, target]) => target.state.terminalStatus !== "NORMAL")
      .map(([shipId]) => shipId),
  );
}

export function minutePauseKinds(
  before: PlayerBattleSession,
  after: PlayerBattleSession,
  events: readonly PlayerBattleEvent[],
): ReadonlySet<MinutePauseKind> {
  const raised = new Set<MinutePauseKind>();
  if (after.ended) raised.add("BATTLE_END");

  const sunkBefore = sunkShipIds(before);
  for (const shipId of sunkShipIds(after)) {
    if (!sunkBefore.has(shipId)) raised.add("SHIP_SUNK");
  }

  const ownIds = new Set(
    after.units.filter((unit) => unit.sideId === playerSideOf(after)).map((unit) => unit.assetId),
  );
  const friendlyHit: readonly string[] = FRIENDLY_HIT_EVENT_TYPES;
  const torpedo: readonly string[] = TORPEDO_EVENT_TYPES;
  for (const event of events) {
    if (friendlyHit.includes(event.eventType) && ownIds.has(event.targetId)) {
      raised.add("FRIENDLY_HIT");
    }
    if (torpedo.includes(event.eventType)) raised.add("TORPEDO");
    if (
      event.eventType === WAYPOINT_REACHED_EVENT_TYPE &&
      ownIds.has(event.actorId) &&
      after.waypointArrivals?.[event.targetId]?.pauseOnArrival === true
    ) {
      raised.add("WAYPOINT_REACHED");
    }
  }

  const heldBefore = enemyContactIds(before);
  const heldAfter = enemyContactIds(after);
  for (const id of heldAfter) if (!heldBefore.has(id)) raised.add("ENEMY_SIGHTED");
  for (const id of heldBefore) if (!heldAfter.has(id)) raised.add("CONTACT_LOST");
  return raised;
}

export function pauseReasonOf(
  raised: ReadonlySet<MinutePauseKind>,
  pauseOn: readonly RunPauseKind[],
): MinutePauseKind | null {
  for (const kind of RUN_PAUSE_PRECEDENCE) {
    if (!raised.has(kind)) continue;
    if (kind === "BATTLE_END" || (pauseOn as readonly string[]).includes(kind)) return kind;
  }
  return null;
}
