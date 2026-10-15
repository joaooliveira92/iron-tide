import type { BattleHistoryEntry } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import { shipsLabel, summarizeBattleHistory } from "./battle-history-state.js";

function entry(over: Partial<BattleHistoryEntry>): BattleHistoryEntry {
  return {
    sequence: 1,
    battleId: "b",
    areaId: "a",
    areaName: "Area",
    attackerId: "uk",
    attackerName: "Britain",
    defenderId: "france",
    defenderName: "France",
    involvesPlayer: true,
    outcomeForPlayer: "won",
    playerLossCount: 0,
    enemyLossCount: 0,
    lostShipIds: [],
    lostShips: [],
    ...over,
  };
}

describe("summarizeBattleHistory", () => {
  it("totals only the battles the player fought in", () => {
    const summary = summarizeBattleHistory([
      entry({ outcomeForPlayer: "won", playerLossCount: 1, enemyLossCount: 3 }),
      entry({ outcomeForPlayer: "lost", playerLossCount: 4, enemyLossCount: 1 }),
      entry({ outcomeForPlayer: "undecided", playerLossCount: 0, enemyLossCount: 0 }),
      // A third-party battle must not count towards anyone's totals.
      entry({ involvesPlayer: false, outcomeForPlayer: "not-involved", enemyLossCount: 9 }),
    ]);
    expect(summary).toEqual({
      played: 3,
      won: 1,
      lost: 1,
      undecided: 1,
      playerLosses: 5,
      enemyLosses: 4,
    });
  });

  it("is all zeros for an empty history", () => {
    expect(summarizeBattleHistory([])).toEqual({
      played: 0,
      won: 0,
      lost: 0,
      undecided: 0,
      playerLosses: 0,
      enemyLosses: 0,
    });
  });
});

describe("shipsLabel", () => {
  it("pluralises", () => {
    expect(shipsLabel(0)).toBe("0 ships");
    expect(shipsLabel(1)).toBe("1 ship");
    expect(shipsLabel(2)).toBe("2 ships");
  });
});
