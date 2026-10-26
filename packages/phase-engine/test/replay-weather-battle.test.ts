import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState, NationState } from "@bluewave/campaign";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { runSync } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, ReplayVerifier } from "../src/index.js";
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

function hashSnapshot(snapshot: CampaignSnapshot): string {
  const nations: Record<string, NationState> = {};
  for (const [id, nation] of snapshot.nations) nations[id] = nation;
  return sha256Hex(
    canonicalSerialize({
      version: snapshot.version,
      turnNumber: snapshot.turnNumber,
      campaignId: snapshot.campaignId,
      startYear: snapshot.startYear,
      startMonth: snapshot.startMonth,
      strategicWeather: (snapshot.strategicWeather ?? []).map((s) => ({ ...s })),
      slots: snapshot.slots.map((s) => ({ ...s })),
      world: {
        areas: snapshot.world.areas.map((a) => ({ ...a })),
        routes: snapshot.world.routes.map((r) => ({ ...r })),
        ports: snapshot.world.ports.map((p) => ({ ...p })),
      },
      nations,
      wars: {
        wars: snapshot.wars.wars.map((w) => ({ ...w })),
        battles: snapshot.wars.battles.map((b) => ({ ...b })),
        participantMemberships: snapshot.wars.participantMemberships.map((m) => ({ ...m })),
        blockadeState: snapshot.wars.blockadeState.map((b) => ({ ...b })),
        battleManifests: (snapshot.wars.battleManifests ?? []).map((m) => ({ ...m })),
      },
      politics: {
        relations: snapshot.politics.relations.map((r) => ({ ...r })),
        shells: { ...snapshot.politics.shells },
      },
      intelligence: { shells: { ...snapshot.intelligence.shells } },
      rulesetVersion: snapshot.rulesetVersion,
      compatibilityVersion: snapshot.compatibilityVersion,
    }),
  );
}

function toSaveableState(snapshot: CampaignSnapshot): CampaignState {
  const envelope = createEnvelope("campaign-snapshot", snapshot.compatibilityVersion, snapshot);
  const state: CampaignState = { snapshot, envelope, rawHash: "" };
  const { rawHash: _rawHash, ...stateForHash } = state;
  return { ...state, rawHash: sha256Hex(canonicalSerialize(stateForHash)) };
}

function makeTieSnapshot(): CampaignSnapshot {
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
  return makeBattleSnapshot({
    attackerShips,
    defenderShips,
    designs: new Map([["dv-unarmed", unarmed]]),
    battles: [makeBattle({ id: "battle-tl", manifestHash: manifest.manifestHash })],
    manifests: [manifest],
  });
}

describe("replay: save/load/replay a war campaign with resolved battles + weather (AC-11)", () => {
  it("round-trips the resolved battle result, weather, war score, and ship consequences; replay reproduces the same closing hash", () => {
    const saveDir = mkdtempSync(join(tmpdir(), "bw-replay-battle-"));
    try {
      const snapshot0 = makeBattleSnapshot();
      const executor = new MonthExecutor();
      const collector = new DiagnosticCollector();
      const month1 = executor.execute(snapshot0, [], CAMPAIGN_SEED, collector);
      expect(month1.success).toBe(true);
      const snapshot1 = month1.finalSnapshot;
      const closingHash = hashSnapshot(snapshot1);

      expect(snapshot1.wars.battles.length).toBe(1);
      expect(snapshot1.wars.battles[0]!.phase).toBe("resolved");
      expect(snapshot1.wars.battles[0]!.result).toBeDefined();
      expect((snapshot1.strategicWeather ?? []).length).toBeGreaterThan(0);

      const store = new SaveStore();
      store.save(toSaveableState(snapshot1), saveDir);
      const loaded = runSync(store.load(saveDir));
      expect(loaded.warnings).toEqual([]);

      expect(loaded.state.snapshot.wars.battles).toEqual(snapshot1.wars.battles);
      expect(loaded.state.snapshot.strategicWeather).toEqual(snapshot1.strategicWeather);
      expect(loaded.state.snapshot.wars.wars).toEqual(snapshot1.wars.wars);
      const shipsOf = (snap: CampaignSnapshot) =>
        [...snap.nations.values()]
          .flatMap((n) => n.fleets.flatMap((f) => f.ships))
          .sort((a, b) => a.id.localeCompare(b.id));
      expect(shipsOf(loaded.state.snapshot)).toEqual(shipsOf(snapshot1));

      const directAgain = new MonthExecutor().execute(
        snapshot1,
        [],
        CAMPAIGN_SEED,
        new DiagnosticCollector(),
      );
      const loadedAgain = new MonthExecutor().execute(
        loaded.state.snapshot,
        [],
        CAMPAIGN_SEED,
        new DiagnosticCollector(),
      );
      expect(hashSnapshot(loadedAgain.finalSnapshot)).toBe(hashSnapshot(directAgain.finalSnapshot));

      const replay = new ReplayVerifier().verify(
        snapshot0,
        [],
        month1.commandLedger,
        closingHash,
        CAMPAIGN_SEED,
        new DiagnosticCollector(),
      );
      expect(replay.match).toBe(true);
      expect(replay.replayedFinalHash).toBe(closingHash);
      expect(replay.finalSnapshot.wars.battles[0]!.result).toEqual(
        snapshot1.wars.battles[0]!.result,
      );
    } finally {
      rmSync(saveDir, { recursive: true, force: true });
    }
  });

  it("save/load round-trips a null-winner tie result (time_limit) — null serializes and reloads", () => {
    const saveDir = mkdtempSync(join(tmpdir(), "bw-replay-tie-"));
    try {
      const tie = makeTieSnapshot();
      const month = new MonthExecutor().execute(tie, [], CAMPAIGN_SEED, new DiagnosticCollector());
      const battle = month.finalSnapshot.wars.battles[0]!;
      expect(battle.phase).toBe("resolved");
      expect(battle.result!.winnerId).toBeNull();
      expect(battle.result!.loserId).toBeNull();

      const store = new SaveStore();
      store.save(toSaveableState(month.finalSnapshot), saveDir);
      const loaded = runSync(store.load(saveDir));
      expect(loaded.state.snapshot.wars.battles[0]!.result!.winnerId).toBeNull();
      expect(loaded.state.snapshot.wars.battles[0]!.result!.loserId).toBeNull();
      const next = new MonthExecutor().execute(
        loaded.state.snapshot,
        [],
        CAMPAIGN_SEED,
        new DiagnosticCollector(),
      );
      expect(next.success).toBe(true);
    } finally {
      rmSync(saveDir, { recursive: true, force: true });
    }
  });
});
