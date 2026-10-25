import type { AbsentShipView, BattleHistoryEntry } from "@bluewave/campaign-engine";

export interface BattleHistorySummary {
  readonly played: number;
  readonly won: number;
  readonly lost: number;
  readonly undecided: number;
  readonly playerLosses: number;
  readonly enemyLosses: number;
}

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

export const ABSENCE_REASON_LABELS: Readonly<Record<AbsentShipView["reasons"][number], string>> = {
  UnderConstruction: "still under construction",
  Unavailable: "out of action in a yard project",
  WorkingUp: "still working up",
  InRepair: "under repair",
  InReserve: "in reserve",
  Mothballed: "mothballed",
  InBattle: "committed to another battle",
  Assigned: "on another assignment",
  AssignmentForbidsUse: "on an assignment that bars battle",
};
