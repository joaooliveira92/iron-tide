import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { BattleInstance, DeclinedBattleRecord } from "@bluewave/campaign";
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

function snapshotWith(battles: BattleInstance[], declinedBattles?: DeclinedBattleRecord[]) {
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
        ...(declinedBattles === undefined ? {} : { declinedBattles }),
      },
    },
  );
}

function declined(overrides: Partial<DeclinedBattleRecord> = {}): DeclinedBattleRecord {
  return {
    battleId: "d1",
    warId: "w1",
    nationId: "uk",
    areaId: "eng_home_coast",
    month: "1880-03",
    missionType: "FLEET_BATTLE",
    responseInputHash: "response-hash",
    victoryPointCost: 10,
    opponentCredit: 5,
    ...overrides,
  };
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

  it("names the player's absent ships with their ordered reasons, and omits the field when none", () => {
    const absences = [
      { shipId: "uk_ship_9", reasons: ["InRepair" as const, "Mothballed" as const] },
    ];
    const view = buildBattleHistory(
      snapshotWith([
        battle({ id: "b5", result: result(), absences }),
        battle({ id: "b6", result: result() }),
      ]),
      "uk",
    );
    expect(view.battles[0]!.absentShips).toEqual([
      { shipId: "uk_ship_9", shipName: "uk_ship_9", reasons: ["InRepair", "Mothballed"] },
    ]);
    expect(view.battles[1]!.absentShips).toBeUndefined();
  });

  it("does not show another nation's absences", () => {
    const absences = [{ shipId: "fr_ship_9", reasons: ["Mothballed" as const] }];
    const view = buildBattleHistory(
      snapshotWith([battle({ id: "b7", result: result(), absences })]),
      "spain",
    );
    expect(view.battles[0]!.absentShips).toBeUndefined();
  });

  it("projects the player's canonical declined-battle records without the response hash", () => {
    const view = buildBattleHistory(
      snapshotWith(
        [],
        [
          declined({ battleId: "d1" }),
          declined({ battleId: "d2", nationId: "france", warId: "w2", month: "1880-04" }),
        ],
      ),
      "uk",
    );
    expect(view.declinedBattles).toEqual([
      {
        battleId: "d1",
        warId: "w1",
        nationId: "uk",
        areaId: "eng_home_coast",
        month: "1880-03",
        missionType: "FLEET_BATTLE",
        victoryPointCost: 10,
        opponentCredit: 5,
      },
    ]);
  });

  it("omits declinedBattles when the player declined none", () => {
    const view = buildBattleHistory(snapshotWith([], [declined({ nationId: "france" })]), "uk");
    expect(view).toEqual({ battles: [] });
  });
});
