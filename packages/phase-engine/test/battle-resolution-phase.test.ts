import type { CampaignSnapshot, Ship } from "@bluewave/campaign";
import {
  BATTLE_AUTO_RESOLUTION_FAILED,
  INVALID_BATTLE_WEATHER_INITIALIZATION,
  resolveBattleAuto,
} from "@bluewave/combat";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
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

const MONTH = "1880-02";
type AutoResolutionManifest = Parameters<typeof resolveBattleAuto>[0]["manifest"];

function runMonth(snapshot: CampaignSnapshot) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(snapshot, [], CAMPAIGN_SEED, collector);
  return { collector, result };
}

function directAutoResult(snapshot: CampaignSnapshot, final: CampaignSnapshot) {
  const manifest = final.wars.battleManifests[0]!;
  const weather = (final.strategicWeather ?? []).find((s) => s.areaId === manifest.areaId)!;
  const nation = (id: string) => snapshot.nations.get(id)!;
  return resolveBattleAuto({
    battleId: manifest.battleId,
    areaId: manifest.areaId,
    campaignMonth: MONTH,
    manifest: manifest as unknown as AutoResolutionManifest,
    attacker: {
      nationId: ATTACKER_NATION,
      ships: nation(ATTACKER_NATION).fleets.flatMap((f) => f.ships),
      designs: snapshot.designs,
      divisions: nation(ATTACKER_NATION).divisions,
    },
    defender: {
      nationId: DEFENDER_NATION,
      ships: nation(DEFENDER_NATION).fleets.flatMap((f) => f.ships),
      designs: snapshot.designs,
      divisions: nation(DEFENDER_NATION).divisions,
    },
    strategicWeather: weather,
    campaignSeed: CAMPAIGN_SEED,
    rulesetVersion: snapshot.rulesetVersion,
    formulaVersion: manifest.formulaVersion,
    rngVersion: manifest.rngVersion,
  });
}

function warScores(snapshot: CampaignSnapshot): { attacker: number; defender: number } {
  const war = snapshot.wars.wars[0]!;
  return { attacker: war.attackerWarScore, defender: war.defenderWarScore };
}

function allShips(snapshot: CampaignSnapshot): Ship[] {
  return [...snapshot.nations.values()].flatMap((n) => n.fleets.flatMap((f) => f.ships));
}

describe("battle_resolution phase (AC-8): tactical auto-resolution wiring", () => {
  it("a generated manifest battle resolves via resolveBattleAuto: result recorded, winner/loser match the deterministic run, war score moves on the decided path", () => {
    const snapshot = makeBattleSnapshot();
    const { collector, result } = runMonth(snapshot);

    const battles = result.finalSnapshot.wars.battles;
    expect(battles.length).toBe(1);
    const battle = battles[0]!;
    expect(battle.phase).toBe("resolved");
    expect(battle.manifestHash).toBeTruthy();

    const direct = directAutoResult(snapshot, result.finalSnapshot);
    expect(battle.result).toBeDefined();
    expect(battle.result!.winnerId).toBe(direct.winnerId);
    expect(battle.result!.loserId).toBe(direct.loserId);
    expect(battle.result!.damageReport).toEqual(direct.damageReport);
    expect(battle.result!.attackerLosses).toEqual([...direct.attackerSunkIds].sort());
    expect(battle.result!.defenderLosses).toEqual([...direct.defenderSunkIds].sort());

    if (direct.winnerId !== null && direct.loserId !== null) {
      const scores = warScores(result.finalSnapshot);
      const winnerSide = direct.winnerId === battle.attackerId ? "attacker" : "defender";
      const winnerScore = winnerSide === "attacker" ? scores.attacker : scores.defender;
      const loserScore = winnerSide === "attacker" ? scores.defender : scores.attacker;
      expect(winnerScore).toBeGreaterThan(0);
      expect(loserScore).toBeLessThan(0);
    } else {
      const scores = warScores(result.finalSnapshot);
      expect(scores.attacker).toBe(0);
      expect(scores.defender).toBe(0);
    }
    expect(collector.errors).toHaveLength(0);
  });

  it("a time_limit / tie battle (no viable elimination): NO war score change, damage applied (clamped), result recorded with null winner, reservations cleared", () => {
    const unarmed = makeDesign("dv-unarmed", ATTACKER_NATION, { guns: 0, caliberUm: 0 });
    const attackerShips = [
      makeShip("g1", "dv-unarmed", ATTACKER_NATION, { firepower: 0, inBattleId: "battle-tl" }),
      makeShip("g2", "dv-unarmed", ATTACKER_NATION, { firepower: 0, inBattleId: "battle-tl" }),
    ];
    const defenderShips = [
      makeShip("f1", "dv-unarmed", DEFENDER_NATION, { firepower: 0, inBattleId: "battle-tl" }),
      makeShip("f2", "dv-unarmed", DEFENDER_NATION, { firepower: 0, inBattleId: "battle-tl" }),
    ];
    const manifest = buildBattleManifest({
      battleId: "battle-tl",
      persistentAssets: ["g1", "g2", "f1", "f2"],
    });
    const snapshot = makeBattleSnapshot({
      attackerShips,
      defenderShips,
      designs: new Map([["dv-unarmed", unarmed]]),
      battles: [makeBattle({ id: "battle-tl", manifestHash: manifest.manifestHash })],
      manifests: [manifest],
    });

    const { collector, result } = runMonth(snapshot);

    const battle = result.finalSnapshot.wars.battles.find((b) => b.id === "battle-tl")!;
    expect(battle.phase).toBe("resolved");
    expect(battle.result).toBeDefined();
    expect(battle.result!.winnerId).toBeNull();
    expect(battle.result!.loserId).toBeNull();

    const scores = warScores(result.finalSnapshot);
    expect(scores.attacker).toBe(0);
    expect(scores.defender).toBe(0);

    for (const ship of allShips(result.finalSnapshot)) {
      expect(ship.hitPoints).toBe(SafeInt(100));
      expect(ship.inBattleId).toBeUndefined();
    }
    expect(
      allShips(result.finalSnapshot)
        .map((s) => s.id)
        .sort(),
    ).toEqual(["f1", "f2", "g1", "g2"]);
    expect(collector.errors).toHaveLength(0);
  });

  it("a manifest-less pending battle resolves via the M1 BattleResolver legacy path (no crash, result present, decided)", () => {
    const attackerShips = [
      makeShip("g1", "", ATTACKER_NATION, { firepower: 200, inBattleId: "battle-m1" }),
      makeShip("g2", "", ATTACKER_NATION, { firepower: 200, inBattleId: "battle-m1" }),
    ];
    const defenderShips = [
      makeShip("f1", "", DEFENDER_NATION, { firepower: 200, inBattleId: "battle-m1" }),
      makeShip("f2", "", DEFENDER_NATION, { firepower: 200, inBattleId: "battle-m1" }),
    ];
    const snapshot = makeBattleSnapshot({
      attackerShips,
      defenderShips,
      designs: new Map(),
      battles: [makeBattle({ id: "battle-m1" })],
      manifests: [],
    });

    const { collector, result } = runMonth(snapshot);
    expect(result.success).toBe(true);

    const battle = result.finalSnapshot.wars.battles.find((b) => b.id === "battle-m1")!;
    expect(battle.phase).toBe("resolved");
    expect(battle.result).toBeDefined();
    expect(battle.result!.winnerId).toBeTruthy();
    expect(battle.result!.loserId).toBeTruthy();
    expect(battle.result!.winnerId).toBe(DEFENDER_NATION);
    expect(battle.result!.loserId).toBe(ATTACKER_NATION);
    expect(battle.result!.defenderLosses).toEqual([]);
    expect(battle.result!.attackerLosses).toEqual(["g2"]);
    expect(battle.result!.damageReport).toEqual({ g1: SafeInt(23), g2: SafeInt(23) });
    const scores = warScores(result.finalSnapshot);
    expect(scores.attacker !== 0 || scores.defender !== 0).toBe(true);
    expect(collector.errors).toHaveLength(0);
  });

  it("a manifestHash with NO matching stored manifest fails closed: stable diagnostic, no partial mutation", () => {
    const attackerShips = [
      makeShip("g1", "", ATTACKER_NATION, { firepower: 10, inBattleId: "battle-ghost" }),
    ];
    const defenderShips = [
      makeShip("f1", "", DEFENDER_NATION, { firepower: 10, inBattleId: "battle-ghost" }),
    ];
    const snapshot = makeBattleSnapshot({
      attackerShips,
      defenderShips,
      designs: new Map(),
      battles: [makeBattle({ id: "battle-ghost", manifestHash: "ghost-manifest-hash" })],
      manifests: [],
    });

    const { collector, result } = runMonth(snapshot);

    expect(collector.errors.some((d) => d.code === BATTLE_AUTO_RESOLUTION_FAILED)).toBe(true);
    const battle = result.finalSnapshot.wars.battles.find((b) => b.id === "battle-ghost")!;
    expect(battle.phase).toBe("pending");
    expect(battle.result).toBeUndefined();
    expect(warScores(result.finalSnapshot)).toEqual({ attacker: 0, defender: 0 });
    expect(result.finalSnapshot.wars.wars).toEqual(snapshot.wars.wars);
    expect(allShips(result.finalSnapshot)).toEqual(allShips(snapshot));
  });

  it("a matching manifest WITHOUT committed weather fails closed: stable diagnostic + legacy fallback, no partial auto mutation", () => {
    const attackerShips = [
      makeShip("g1", "dv-att-a", ATTACKER_NATION, { firepower: 200, inBattleId: "battle-nw" }),
      makeShip("g2", "dv-att-b", ATTACKER_NATION, { firepower: 200, inBattleId: "battle-nw" }),
    ];
    const defenderShips = [
      makeShip("f1", "dv-def-a", DEFENDER_NATION, { firepower: 200, inBattleId: "battle-nw" }),
      makeShip("f2", "dv-def-b", DEFENDER_NATION, { firepower: 200, inBattleId: "battle-nw" }),
    ];
    const manifest = buildBattleManifest({
      battleId: "battle-nw",
      persistentAssets: ["g1", "g2", "f1", "f2"],
    });
    const snapshot = makeBattleSnapshot({
      attackerShips,
      defenderShips,
      areas: [],
      battles: [makeBattle({ id: "battle-nw", manifestHash: manifest.manifestHash })],
      manifests: [manifest],
    });

    const { collector, result } = runMonth(snapshot);

    expect(collector.errors.some((d) => d.code === INVALID_BATTLE_WEATHER_INITIALIZATION)).toBe(
      true,
    );
    const battle = result.finalSnapshot.wars.battles.find((b) => b.id === "battle-nw")!;
    expect(battle.phase).toBe("resolved");
    expect(battle.result).toBeDefined();
    expect(battle.result!.winnerId).toBeTruthy();
    expect(battle.result!.loserId).toBeTruthy();
    const scores = warScores(result.finalSnapshot);
    expect(scores.attacker !== 0 || scores.defender !== 0).toBe(true);
    for (const ship of allShips(result.finalSnapshot)) {
      expect(ship.hitPoints).toBe(SafeInt(100));
      expect(ship.inBattleId).toBe("battle-nw");
    }
  });

  it("a mid-try auto-resolution THROW fails closed: stable machine code + complete M1 legacy fallback (no partial tactical mutation)", () => {
    const attackerShips = [
      makeShip("g1", "dv-missing-att", ATTACKER_NATION, {
        firepower: 200,
        inBattleId: "battle-mid",
      }),
      makeShip("g2", "dv-missing-att", ATTACKER_NATION, {
        firepower: 200,
        inBattleId: "battle-mid",
      }),
    ];
    const defenderShips = [
      makeShip("f1", "dv-missing-def", DEFENDER_NATION, {
        firepower: 200,
        inBattleId: "battle-mid",
      }),
      makeShip("f2", "dv-missing-def", DEFENDER_NATION, {
        firepower: 200,
        inBattleId: "battle-mid",
      }),
    ];
    const manifest = buildBattleManifest({
      battleId: "battle-mid",
      persistentAssets: ["g1", "g2", "f1", "f2"],
    });
    const snapshot = makeBattleSnapshot({
      attackerShips,
      defenderShips,
      designs: new Map(),
      battles: [makeBattle({ id: "battle-mid", manifestHash: manifest.manifestHash })],
      manifests: [manifest],
    });

    const { collector, result } = runMonth(snapshot);

    expect(collector.errors.some((d) => d.code === "TACTICAL_UNIT_PROMOTION_INVALID")).toBe(true);
    expect(collector.errors.some((d) => d.code === BATTLE_AUTO_RESOLUTION_FAILED)).toBe(false);

    const battle = result.finalSnapshot.wars.battles.find((b) => b.id === "battle-mid")!;
    expect(battle.phase).toBe("resolved");
    expect(battle.result).toBeDefined();
    expect(battle.result!.winnerId).toBeTruthy();
    expect(battle.result!.loserId).toBeTruthy();
    for (const ship of allShips(result.finalSnapshot)) {
      expect(ship.hitPoints).toBe(SafeInt(100));
      expect(ship.inBattleId).toBe("battle-mid");
    }
  });

  it("deterministic: two identical runs produce byte-identical closing snapshots and battle results", () => {
    const a = runMonth(makeBattleSnapshot());
    const b = runMonth(makeBattleSnapshot());
    expect(sha256Hex(canonicalSerialize(a.result.finalSnapshot))).toBe(
      sha256Hex(canonicalSerialize(b.result.finalSnapshot)),
    );
    expect(a.result.finalSnapshot.wars.battles[0]!.result).toEqual(
      b.result.finalSnapshot.wars.battles[0]!.result,
    );
    expect(a.result.randomLedger.hash()).toBe(b.result.randomLedger.hash());
  });
});
