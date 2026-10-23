import type { BattleHistoryEntry } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import { battleRecordAgainst, battleRecords } from "./diplomacy-hover.js";

const battle = (
  defenderName: string,
  outcomeForPlayer: BattleHistoryEntry["outcomeForPlayer"],
  involvesPlayer = true,
) =>
  ({
    attackerName: "your nation",
    defenderName,
    outcomeForPlayer,
    involvesPlayer,
  }) as BattleHistoryEntry;

describe("battleRecordAgainst", () => {
  it("counts only the player's battles against the named nation", () => {
    const battles = [
      battle("France", "won"),
      battle("France", "lost"),
      battle("France", "undecided"),
      battle("Germany", "won"),
      battle("France", "won", false),
    ];
    expect(battleRecordAgainst(battles, "France")).toEqual({
      played: 3,
      won: 1,
      lost: 1,
      undecided: 1,
    });
    expect(battleRecordAgainst(battles, "Spain")).toEqual({
      played: 0,
      won: 0,
      lost: 0,
      undecided: 0,
    });
  });
});

describe("battleRecords", () => {
  it("gives every nation an empty record while the history is not ready", () => {
    const records = battleRecords({ status: "loading" }, ["France"]);
    expect(records.get("France")?.played).toBe(0);
  });
});
