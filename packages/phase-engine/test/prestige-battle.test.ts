import type { CampaignSnapshot } from "@bluewave/campaign";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, type MonthResult } from "../src/index.js";
import {
  ATTACKER_NATION,
  buildBattleManifest,
  CAMPAIGN_SEED,
  DEFENDER_NATION,
  makeBattle,
  makeBattleSnapshot,
  makeDesign,
  makeShip,
} from "./battle-fixtures.js";

function legacySnapshot(): CampaignSnapshot {
  return makeBattleSnapshot({
    attackerShips: [
      makeShip("g1", "", ATTACKER_NATION, { firepower: 200, inBattleId: "battle-m1" }),
      makeShip("g2", "", ATTACKER_NATION, { firepower: 200, inBattleId: "battle-m1" }),
    ],
    defenderShips: [
      makeShip("f1", "", DEFENDER_NATION, { firepower: 200, inBattleId: "battle-m1" }),
      makeShip("f2", "", DEFENDER_NATION, { firepower: 200, inBattleId: "battle-m1" }),
    ],
    designs: new Map(),
    battles: [makeBattle({ id: "battle-m1" })],
    manifests: [],
  });
}

function tieSnapshot(): CampaignSnapshot {
  const unarmed = makeDesign("dv-unarmed", ATTACKER_NATION, { guns: 0, caliberUm: 0 });
  const manifest = buildBattleManifest({
    battleId: "battle-tl",
    persistentAssets: ["g1", "g2", "f1", "f2"],
  });
  return makeBattleSnapshot({
    attackerShips: [
      makeShip("g1", "dv-unarmed", ATTACKER_NATION, { firepower: 0, inBattleId: "battle-tl" }),
      makeShip("g2", "dv-unarmed", ATTACKER_NATION, { firepower: 0, inBattleId: "battle-tl" }),
    ],
    defenderShips: [
      makeShip("f1", "dv-unarmed", DEFENDER_NATION, { firepower: 0, inBattleId: "battle-tl" }),
      makeShip("f2", "dv-unarmed", DEFENDER_NATION, { firepower: 0, inBattleId: "battle-tl" }),
    ],
    designs: new Map([["dv-unarmed", unarmed]]),
    battles: [makeBattle({ id: "battle-tl", manifestHash: manifest.manifestHash })],
    manifests: [manifest],
  });
}

function run(snapshot: CampaignSnapshot, playerNationId?: string): MonthResult {
  return new MonthExecutor().execute(
    snapshot,
    [],
    CAMPAIGN_SEED,
    new DiagnosticCollector(),
    undefined,
    playerNationId === undefined ? undefined : { playerNationId },
  );
}

const prestige = (result: MonthResult, nation: string) =>
  result.finalSnapshot.nations.get(nation)?.prestige;
const prestigeEvents = (result: MonthResult) =>
  result.eventLedger.all.filter((e) => e.body.kind === "PrestigeChanged");

describe("S-2 05: a resolved battle moves the player's prestige", () => {
  it("the losing player takes BATTLE_LOST with the S-2 event", () => {
    const result = run(legacySnapshot(), ATTACKER_NATION);
    expect(result.finalSnapshot.wars.battles[0]?.result?.loserId).toBe(ATTACKER_NATION);
    expect(prestige(result, ATTACKER_NATION)).toBe(19);
    expect(prestige(result, DEFENDER_NATION)).toBe(20);
    expect(prestigeEvents(result).map((e) => e.body)).toEqual([
      {
        kind: "PrestigeChanged",
        nationId: ATTACKER_NATION,
        reasonCode: "BATTLE_LOST",
        ruleKind: "PROPORTIONAL_LOSS",
        before: 20,
        after: 19,
        delta: -1,
        rulesetVersion: result.finalSnapshot.rulesetVersion,
      },
    ]);
  });

  it("the winning player takes BATTLE_WON with the S-2 event", () => {
    const result = run(legacySnapshot(), DEFENDER_NATION);
    expect(prestige(result, DEFENDER_NATION)).toBe(21);
    expect(prestige(result, ATTACKER_NATION)).toBe(20);
    expect(prestigeEvents(result).map((e) => e.body)).toEqual([
      {
        kind: "PrestigeChanged",
        nationId: DEFENDER_NATION,
        reasonCode: "BATTLE_WON",
        ruleKind: "FIXED_GAIN",
        before: 20,
        after: 21,
        delta: 1,
        rulesetVersion: result.finalSnapshot.rulesetVersion,
      },
    ]);
  });

  it("a tie changes nothing", () => {
    const result = run(tieSnapshot(), ATTACKER_NATION);
    expect(result.finalSnapshot.wars.battles[0]?.result?.winnerId).toBeNull();
    expect(prestige(result, ATTACKER_NATION)).toBe(20);
    expect(prestigeEvents(result)).toHaveLength(0);
  });

  it("a battle without the player, or without a player nation, changes nothing", () => {
    expect(prestigeEvents(run(legacySnapshot(), "NOT-IN-BATTLE"))).toHaveLength(0);
    expect(prestigeEvents(run(legacySnapshot()))).toHaveLength(0);
  });

  it("scores a battle once even though its record persists into the next month", () => {
    const first = run(legacySnapshot(), ATTACKER_NATION);
    const second = run(first.finalSnapshot, ATTACKER_NATION);
    expect(prestige(second, ATTACKER_NATION)).toBe(19);
    expect(prestigeEvents(second)).toHaveLength(0);
  });
});
