import { advancePlayerBattleMinute } from "./playerSessionAdvance.js";
import { holdsEnemyContact, minutePauseKinds, pauseReasonOf } from "./playerSessionPause.js";
import type { MinutePauseKind } from "./playerSessionPause.js";
import type {
  PlayerBattleEvent,
  PlayerBattleOrders,
  PlayerBattleSession,
} from "./playerSessionTypes.js";
import { decodeRunRequest, requestedMinutes, type RunRequest } from "./runRequest.js";

export type RunPauseReason = MinutePauseKind | "RUN_CAP";

export interface RunOutcome {
  readonly session: PlayerBattleSession;
  readonly minutesAdvanced: number;
  readonly pauseReason: RunPauseReason | null;
  readonly events: readonly PlayerBattleEvent[];
}

export function runPlayerBattle(
  session: PlayerBattleSession,
  orders: PlayerBattleOrders,
  request: RunRequest,
): RunOutcome {
  const decoded = decodeRunRequest(request);
  if (session.ended) {
    return { session, minutesAdvanced: 0, pauseReason: "BATTLE_END", events: [] };
  }
  const budget = Math.min(
    requestedMinutes(decoded.mode, holdsEnemyContact(session)),
    decoded.runCapMinutes ?? Number.POSITIVE_INFINITY,
  );
  const capBinds = decoded.mode.kind === "RUN_UNTIL_EVENT";
  let current = session;
  let minutesAdvanced = 0;
  while (minutesAdvanced < budget) {
    const next = advancePlayerBattleMinute(current, orders);
    minutesAdvanced += 1;
    const minuteEvents = next.log.slice(current.log.length);
    const reason = pauseReasonOf(minutePauseKinds(current, next, minuteEvents), decoded.pauseOn);
    current = next;
    if (reason !== null) {
      return finish(session, current, minutesAdvanced, reason);
    }
  }
  return finish(session, current, minutesAdvanced, capBinds ? "RUN_CAP" : null);
}

function finish(
  start: PlayerBattleSession,
  end: PlayerBattleSession,
  minutesAdvanced: number,
  pauseReason: RunPauseReason | null,
): RunOutcome {
  return {
    session: end,
    minutesAdvanced,
    pauseReason,
    events: end.log.slice(start.log.length),
  };
}
