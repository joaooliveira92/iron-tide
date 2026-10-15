import type { BattleHistoryEntry } from "@bluewave/campaign-engine";

export interface BattleHistorySummary {
  readonly played: number;
  readonly won: number;
  readonly lost: number;
  readonly undecided: number;
  /** Ships the player lost, across battles the player fought in. */
  readonly playerLosses: number;
  /** Ships the opposing side lost in those same battles. */
  readonly enemyLosses: number;
}

/** Totals over the battles the player fought in; third-party battles are ignored. */
export function summarizeBattleHistory(
  battles: readonly BattleHistoryEntry[],
): BattleHistorySummary {
  let won = 0;
  let lost = 0;
  let undecided = 0;
  let playerLosses = 0;
  let enemyLosses = 0;
  let played = 0;
  for (const battle of battles) {
    if (!battle.involvesPlayer) continue;
    played += 1;
    if (battle.outcomeForPlayer === "won") won += 1;
    else if (battle.outcomeForPlayer === "lost") lost += 1;
    else undecided += 1;
    playerLosses += battle.playerLossCount;
    enemyLosses += battle.enemyLossCount;
  }
  return { played, won, lost, undecided, playerLosses, enemyLosses };
}

export const OUTCOME_LABELS: Readonly<Record<BattleHistoryEntry["outcomeForPlayer"], string>> = {
  won: "Victory",
  lost: "Defeat",
  undecided: "Undecided",
  "not-involved": "Not involved",
};

export function shipsLabel(count: number): string {
  return count === 1 ? "1 ship" : `${count} ships`;
}
