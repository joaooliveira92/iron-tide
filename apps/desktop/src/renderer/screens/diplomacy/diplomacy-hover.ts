import type { BattleHistoryEntry } from "@bluewave/campaign-engine";
import type { BattleHistoryState } from "./hooks/useBattleHistory.js";

export interface BattleRecord {
  readonly played: number;
  readonly won: number;
  readonly lost: number;
  readonly undecided: number;
}

export function battleRecordAgainst(
  battles: readonly BattleHistoryEntry[],
  nationName: string,
): BattleRecord {
  let won = 0;
  let lost = 0;
  let undecided = 0;
  for (const battle of battles) {
    if (!battle.involvesPlayer) continue;
    if (battle.attackerName !== nationName && battle.defenderName !== nationName) continue;
    if (battle.outcomeForPlayer === "won") won += 1;
    else if (battle.outcomeForPlayer === "lost") lost += 1;
    else undecided += 1;
  }
  return { played: won + lost + undecided, won, lost, undecided };
}

export function battleRecords(
  state: BattleHistoryState,
  nationNames: readonly string[],
): ReadonlyMap<string, BattleRecord> {
  const battles = state.status === "ready" ? state.history.battles : [];
  return new Map(nationNames.map((name) => [name, battleRecordAgainst(battles, name)]));
}
