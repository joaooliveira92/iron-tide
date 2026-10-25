import type { AbsentShipView, BattleHistoryEntry } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import { hasAuthoredMessage, translate } from "../../lib/strings.js";
import { absenceText, shipsLabel, summarizeBattleHistory } from "./battle-history-state.js";

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
      entry({
        outcomeForPlayer: "lost",
        playerLossCount: 4,
        enemyLossCount: 1,
      }),
      entry({
        outcomeForPlayer: "undecided",
        playerLossCount: 0,
        enemyLossCount: 0,
      }),
      entry({
        involvesPlayer: false,
        outcomeForPlayer: "not-involved",
        enemyLossCount: 9,
      }),
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

const ALL_REASONS: Readonly<Record<AbsentShipView["reasons"][number], true>> = {
  UnderConstruction: true,
  Unavailable: true,
  WorkingUp: true,
  InRepair: true,
  InReserve: true,
  Mothballed: true,
  InBattle: true,
  Assigned: true,
  AssignmentForbidsUse: true,
};

describe("absenceText (fleet management story 44)", () => {
  it("renders every gate reason through the message catalogue, never a bare tag", () => {
    for (const tag of Object.keys(ALL_REASONS) as (keyof typeof ALL_REASONS)[]) {
      expect(hasAuthoredMessage(`fleet.absence.${tag}`)).toBe(true);
      expect(absenceText([tag])).not.toContain(tag);
    }
  });

  it("joins the ordered reasons into one catalogue sentence", () => {
    expect(absenceText(["Unavailable", "InRepair"])).toBe(
      "absent: out of action in a yard project, under repair",
    );
    expect(translate("battle.history.absent", { reasons: "x" })).toBe("absent: x");
  });
});
