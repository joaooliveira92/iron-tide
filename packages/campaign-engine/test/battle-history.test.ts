import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { BattleInstance } from "@bluewave/campaign";
import { buildBattleHistory } from "../src/battle-history.js";
import { fixtureNation, fixtureSnapshot } from "./fixtures.js";

function battle(overrides: Partial<BattleInstance> & { id: string }): BattleInstance {
  return {
    phase: "resolved",
    attackerId: "uk",
    defenderId: "france",
    areaId: "eng_home_coast",
    attackerFleetIds: [],
    defenderFleetIds: [],
    ...overrides,
  };
}

const result = (over: Partial<NonNullable<BattleInstance["result"]>> = {}) => ({
  winnerId: "uk",
  loserId: "france",
  attackerLosses: [] as string[],
  defenderLosses: ["fr_ship_1", "fr_ship_2"],
  damageReport: {} as Record<string, ReturnType<typeof SafeInt>>,
  explanation: [] as string[],
  ...over,
});

function snapshotWith(battles: BattleInstance[]) {
  return fixtureSnapshot(
    [
      fixtureNation({ id: "uk", name: "Britain", tag: "GBR" }),
      fixtureNation({ id: "france", name: "France", tag: "FRA" }),
    ],
    [],
    {
      world: {
        areas: [{ id: "eng_home_coast", name: "English Home Waters", type: "coastal" }],
        routes: [],
        ports: [],
      } as never,
      wars: {
        wars: [],
        battles,
        participantMemberships: [],
        blockadeState: [],
        battleManifests: [],
      },
    },
  );
}

describe("buildBattleHistory", () => {
  it("is empty when no battle has resolved", () => {
    expect(buildBattleHistory(snapshotWith([]), "uk")).toEqual({ battles: [] });
    expect(
      buildBattleHistory(snapshotWith([battle({ id: "b1", phase: "pending" })]), "uk").battles,
    ).toEqual([]);
  });

  it("describes a resolved battle with names, outcome for the player, and loss counts", () => {
    const view = buildBattleHistory(snapshotWith([battle({ id: "b1", result: result() })]), "uk");
    expect(view.battles).toHaveLength(1);
    expect(view.battles[0]).toMatchObject({
      sequence: 1,
      battleId: "b1",
      areaName: "English Home Waters",
      attackerName: "Britain",
      defenderName: "France",
      involvesPlayer: true,
      outcomeForPlayer: "won",
      playerLossCount: 0,
      enemyLossCount: 2,
      lostShipIds: ["fr_ship_1", "fr_ship_2"],
    });
  });

  it("reads the outcome and losses from the player's side when the player defends", () => {
    const view = buildBattleHistory(
      snapshotWith([
        battle({
          id: "b2",
          attackerId: "france",
          defenderId: "uk",
          result: result({
            winnerId: "france",
            loserId: "uk",
            attackerLosses: ["fr_1"],
            defenderLosses: ["uk_1", "uk_2", "uk_3"],
          }),
        }),
      ]),
      "uk",
    );
    expect(view.battles[0]).toMatchObject({
      outcomeForPlayer: "lost",
      playerLossCount: 3,
      enemyLossCount: 1,
    });
  });

  it("reports an undecided battle (tie/time limit) as such, never as a win or loss", () => {
    const view = buildBattleHistory(
      snapshotWith([
        battle({ id: "b3", result: result({ winnerId: null, loserId: null, defenderLosses: [] }) }),
      ]),
      "uk",
    );
    expect(view.battles[0]).toMatchObject({ outcomeForPlayer: "undecided" });
  });

  it("marks battles the player was not in, and keeps append (chronological) order", () => {
    const view = buildBattleHistory(
      snapshotWith([
        battle({
          id: "b1",
          attackerId: "france",
          defenderId: "uk",
          result: result({ winnerId: "uk", loserId: "france" }),
        }),
        battle({
          id: "b2",
          attackerId: "france",
          defenderId: "germany",
          result: result({ winnerId: "france", loserId: "germany" }),
        }),
      ]),
      "uk",
    );
    expect(view.battles.map((b) => [b.sequence, b.battleId, b.involvesPlayer])).toEqual([
      [1, "b1", true],
      [2, "b2", false],
    ]);
    // Third parties get no win/loss framing from the player's point of view.
    expect(view.battles[1]?.outcomeForPlayer).toBe("not-involved");
  });

  it("falls back to ids for unknown nations and areas instead of throwing", () => {
    const view = buildBattleHistory(
      snapshotWith([
        battle({ id: "b9", attackerId: "ghost", areaId: "nowhere", result: result() }),
      ]),
      "uk",
    );
    expect(view.battles[0]).toMatchObject({ attackerName: "ghost", areaName: "nowhere" });
  });

  it("carries the recorded details of lost ships and flags which are the player's", () => {
    const view = buildBattleHistory(
      snapshotWith([
        battle({
          id: "b3",
          result: result({
            lostShips: [
              {
                shipId: "fr_ship_1",
                name: "Le Foudroyant",
                classId: "ironclad",
                nationId: "france",
                month: "1880-03",
                cause: "gunfire",
              },
              {
                shipId: "uk_1",
                name: "HMS Lost",
                classId: "cruiser",
                nationId: "uk",
                month: "1880-03",
              },
            ],
          }),
        }),
      ]),
      "uk",
    );
    expect(view.battles[0]!.lostShips).toEqual([
      {
        name: "Le Foudroyant",
        classId: "ironclad",
        nationName: "France",
        ownedByPlayer: false,
        month: "1880-03",
        cause: "gunfire",
      },
      {
        name: "HMS Lost",
        classId: "cruiser",
        nationName: "Britain",
        ownedByPlayer: true,
        month: "1880-03",
        cause: null,
      },
    ]);
  });

  it("has no ship details for battles recorded before ADR-0061", () => {
    const view = buildBattleHistory(snapshotWith([battle({ id: "b4", result: result() })]), "uk");
    expect(view.battles[0]!.lostShips).toEqual([]);
    expect(view.battles[0]!.lostShipIds).toHaveLength(2);
  });
});
