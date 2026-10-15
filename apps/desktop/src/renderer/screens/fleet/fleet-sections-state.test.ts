import type { BattleHistoryEntry, DivisionView } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import type { BattleHistoryState } from "../diplomacy/hooks/useBattleHistory.js";
import {
  DEFERRED_FLEET_ITEMS,
  officerRows,
  playerLossesView,
  playerLossRows,
} from "./fleet-sections-state.js";

function battle(over: Partial<BattleHistoryEntry>): BattleHistoryEntry {
  return {
    sequence: 1,
    battleId: "b1",
    areaId: "a",
    areaName: "Channel",
    attackerId: "uk",
    attackerName: "Britain",
    defenderId: "fr",
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

describe("playerLossRows", () => {
  it("lists only the player's lost ships, newest first, with class and cause", () => {
    const rows = playerLossRows([
      battle({
        battleId: "b1",
        lostShips: [
          {
            name: "HMS Old",
            classId: "iron_clad",
            nationName: "Britain",
            ownedByPlayer: true,
            month: "1880-03",
            cause: "gunfire",
          },
          {
            name: "Le Foe",
            classId: "cruiser",
            nationName: "France",
            ownedByPlayer: false,
            month: "1880-03",
            cause: null,
          },
        ],
      }),
      battle({
        battleId: "b2",
        areaName: "Malta",
        lostShips: [
          {
            name: "HMS Newer",
            classId: "cruiser",
            nationName: "Britain",
            ownedByPlayer: true,
            month: "1880-05",
            cause: null,
          },
        ],
      }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["HMS Newer", "HMS Old"]);
    expect(rows[1]).toMatchObject({
      classLabel: "Iron clad",
      cause: "sunk by gunfire",
      month: "1880-03",
      areaName: "Channel",
    });
    expect(rows[0]?.cause).toBeNull();
  });

  it("is empty when nothing was lost", () => {
    expect(playerLossRows([battle({})])).toEqual([]);
  });
});

describe("playerLossesView", () => {
  const ready: BattleHistoryState = {
    status: "ready",
    history: {
      battles: [
        battle({
          lostShips: [
            {
              name: "HMS Lost",
              classId: "iron_clad",
              nationName: "Britain",
              ownedByPlayer: true,
              month: "1880-04",
              cause: "fire",
            },
          ],
        }),
      ],
    },
  };

  it("derives the player's rows once for a ready history", () => {
    const view = playerLossesView(ready);
    expect(view.status).toBe("ready");
    expect(view).toEqual({
      status: "ready",
      rows: [
        {
          key: "b1-0",
          name: "HMS Lost",
          classLabel: "Iron clad",
          cause: "lost to fire",
          month: "1880-04",
          areaName: "Channel",
        },
      ],
    });
  });

  it("passes loading and error through without deriving rows", () => {
    expect(playerLossesView({ status: "loading" })).toEqual({ status: "loading" });
    expect(playerLossesView({ status: "error", message: "boom" })).toEqual({
      status: "error",
      message: "boom",
    });
  });
});

describe("officerRows", () => {
  const base = {
    flagshipShipId: "s",
    flagshipName: "HMS A",
    role: "CORE",
    formation: "LINE_AHEAD",
    experience: 10,
    cohesion: 10,
    areaId: "a",
    areaName: "A",
    ships: [],
  };
  it("shows the commander for each division or marks it vacant", () => {
    const divisions: DivisionView[] = [
      {
        ...base,
        divisionId: "d1",
        commanderVacant: false,
        commander: { officerId: "o", name: "Edmund Harcourt", rank: "REAR_ADMIRAL", skill: 70 },
      },
      { ...base, divisionId: "d2", commanderVacant: true },
    ];
    const rows = officerRows(divisions);
    expect(rows[0]).toMatchObject({
      divisionId: "d1",
      officer: "Edmund Harcourt",
      rankLabel: "Rear admiral",
      skill: 70,
    });
    expect(rows[1]).toMatchObject({
      divisionId: "d2",
      officer: null,
      rankLabel: null,
      skill: null,
    });
  });
});

describe("DEFERRED_FLEET_ITEMS", () => {
  it("records every deferred fleet item with a reason and no numbers invented", () => {
    expect(DEFERRED_FLEET_ITEMS.map((i) => i.id)).toEqual([
      "submarine-roster",
      "submarine-auto-build",
      "air-groups",
      "aircraft-types",
      "fleet-exercise",
      "ship-scrapping",
    ]);
    expect(DEFERRED_FLEET_ITEMS.every((i) => i.reason.length > 20)).toBe(true);
  });
});
