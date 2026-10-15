//packages/phase-engine/test/tactical-replay.test.ts
// Ticket 07 — tactical replay verification (ADR-0034 decision 2).
// For every battle the snapshot records as resolved, re-resolve
// `resolveBattleAuto` from the stored manifest + seed (+ committed strategic
// weather + version pins) and compare the recomputed outcome against the
// recorded `BattleInstance.result` (winner/loser, losses, damageReport).
// A no-divergence replay reports a match; an altered result / wrong seed /
// altered manifest reports a first-divergence mismatch with a stable
// diagnostic. Battle replay is deterministic, and the tactical check composes
// with the existing strategic `ReplayVerifier`.

import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, ReplayVerifier, TacticalReplayVerifier } from "../src/index.js";
import {
  ATTACKER_NATION,
  CAMPAIGN_SEED,
  DEFENDER_NATION,
  makeBattleSnapshot,
} from "./battle-fixtures.js";

// Deterministic subset hash over the authoritative snapshot surface — parity
// with ReplayVerifier / the cross-process child (run-child.ts).
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

describe("TacticalReplayVerifier (ticket 07)", () => {
  it("reports a match when re-resolution from manifest + seed reproduces the recorded result", () => {
    // The battle is generated and auto-resolved during a real month against the
    // snapshot's full-HP committed ships.
    const s0 = makeBattleSnapshot();
    const month = new MonthExecutor().execute(s0, [], CAMPAIGN_SEED, new DiagnosticCollector());
    expect(month.success).toBe(true);
    const fs = month.finalSnapshot;
    expect(fs.wars.battles.length).toBe(1);
    expect(fs.wars.battles[0]!.phase).toBe("resolved");
    expect(fs.wars.battles[0]!.result).toBeDefined();

    // The verification snapshot carries the same committed ships the battle was
    // resolved against, plus the stored manifest and committed strategic weather.
    const verifySnap: CampaignSnapshot = {
      ...s0,
      strategicWeather: fs.strategicWeather,
      wars: {
        ...s0.wars,
        battles: fs.wars.battles,
        battleManifests: fs.wars.battleManifests,
      },
    };

    const result = new TacticalReplayVerifier().verify(verifySnap, CAMPAIGN_SEED);
    expect(result.match).toBe(true);
    expect(result.battles).toHaveLength(1);
    expect(result.battles[0]!.match).toBe(true);
    expect(result.battles[0]!.divergence).toBeUndefined();
  });

  it("is deterministic: two re-runs produce byte-identical verification output", () => {
    const s0 = makeBattleSnapshot();
    const month = new MonthExecutor().execute(s0, [], CAMPAIGN_SEED, new DiagnosticCollector());
    const fs = month.finalSnapshot;
    const verifySnap: CampaignSnapshot = {
      ...s0,
      strategicWeather: fs.strategicWeather,
      wars: {
        ...s0.wars,
        battles: fs.wars.battles,
        battleManifests: fs.wars.battleManifests,
      },
    };

    const verifier = new TacticalReplayVerifier();
    const a = verifier.verify(verifySnap, CAMPAIGN_SEED);
    const b = verifier.verify(verifySnap, CAMPAIGN_SEED);
    expect(canonicalSerialize(a)).toBe(canonicalSerialize(b));
    expect(a.match).toBe(b.match);
  });

  it("reports a first-divergence mismatch on an altered recorded result", () => {
    const s0 = makeBattleSnapshot();
    const month = new MonthExecutor().execute(s0, [], CAMPAIGN_SEED, new DiagnosticCollector());
    const fs = month.finalSnapshot;
    const verifySnap: CampaignSnapshot = {
      ...s0,
      strategicWeather: fs.strategicWeather,
      wars: {
        ...s0.wars,
        battles: fs.wars.battles,
        battleManifests: fs.wars.battleManifests,
      },
    };
    const recorded = verifySnap.wars.battles[0]!.result!;
    const tampered: CampaignSnapshot = {
      ...verifySnap,
      wars: {
        ...verifySnap.wars,
        battles: [
          {
            ...verifySnap.wars.battles[0]!,
            result: { ...recorded, winnerId: DEFENDER_NATION },
          },
        ],
      },
    };

    const result = new TacticalReplayVerifier().verify(tampered, CAMPAIGN_SEED);
    expect(result.match).toBe(false);
    expect(result.battles[0]!.divergence?.field).toBe("winnerId");
  });

  it("reports a mismatch when the replay uses the wrong campaign seed", () => {
    const s0 = makeBattleSnapshot();
    const month = new MonthExecutor().execute(s0, [], CAMPAIGN_SEED, new DiagnosticCollector());
    const fs = month.finalSnapshot;
    const verifySnap: CampaignSnapshot = {
      ...s0,
      strategicWeather: fs.strategicWeather,
      wars: {
        ...s0.wars,
        battles: fs.wars.battles,
        battleManifests: fs.wars.battleManifests,
      },
    };

    const result = new TacticalReplayVerifier().verify(verifySnap, "WRONG-CAMPAIGN-SEED");
    expect(result.match).toBe(false);
    expect(result.battles[0]!.divergence).toBeDefined();
  });

  it("reports a stable MANIFEST_TAMPERED diagnostic when a stored manifest's content is altered", () => {
    const s0 = makeBattleSnapshot();
    const month = new MonthExecutor().execute(s0, [], CAMPAIGN_SEED, new DiagnosticCollector());
    const fs = month.finalSnapshot;
    const verifySnap: CampaignSnapshot = {
      ...s0,
      strategicWeather: fs.strategicWeather,
      wars: {
        ...s0.wars,
        battles: fs.wars.battles,
        battleManifests: fs.wars.battleManifests,
      },
    };
    // A content edit that does not update the manifestHash field is tamper.
    const altered: CampaignSnapshot = {
      ...verifySnap,
      wars: {
        ...verifySnap.wars,
        battleManifests: [
          {
            ...verifySnap.wars.battleManifests[0]!,
            persistentAssets: [ATTACKER_NATION],
          },
        ],
      },
    };

    const result = new TacticalReplayVerifier().verify(altered, CAMPAIGN_SEED);
    expect(result.match).toBe(false);
    expect(result.battles[0]!.diagnostic).toBe("TACTICAL_MANIFEST_TAMPERED");
  });

  it("reports a stable MANIFEST_NOT_FOUND diagnostic when the battle's manifestHash references no stored manifest", () => {
    const s0 = makeBattleSnapshot();
    const month = new MonthExecutor().execute(s0, [], CAMPAIGN_SEED, new DiagnosticCollector());
    const fs = month.finalSnapshot;
    const verifySnap: CampaignSnapshot = {
      ...s0,
      strategicWeather: fs.strategicWeather,
      wars: {
        ...s0.wars,
        battles: fs.wars.battles,
        battleManifests: fs.wars.battleManifests,
      },
    };
    const orphaned: CampaignSnapshot = {
      ...verifySnap,
      wars: {
        ...verifySnap.wars,
        battles: [
          {
            ...verifySnap.wars.battles[0]!,
            manifestHash: "no-such-manifest",
          },
        ],
      },
    };

    const result = new TacticalReplayVerifier().verify(orphaned, CAMPAIGN_SEED);
    expect(result.match).toBe(false);
    expect(result.battles[0]!.diagnostic).toBe("TACTICAL_MANIFEST_NOT_FOUND");
  });

  it("composes with the strategic ReplayVerifier: both green on a normal turn", () => {
    const s0 = makeBattleSnapshot();
    const month = new MonthExecutor().execute(s0, [], CAMPAIGN_SEED, new DiagnosticCollector());
    const fs = month.finalSnapshot;
    const closingHash = hashSnapshot(fs);

    // Strategic replay (existing, unchanged) reproduces the closing hash.
    const strategic = new ReplayVerifier().verify(
      s0,
      [],
      month.commandLedger,
      closingHash,
      CAMPAIGN_SEED,
      new DiagnosticCollector(),
    );
    expect(strategic.match).toBe(true);

    // Tactical replay composes with it and is also green.
    const verifySnap: CampaignSnapshot = {
      ...s0,
      strategicWeather: fs.strategicWeather,
      wars: {
        ...s0.wars,
        battles: fs.wars.battles,
        battleManifests: fs.wars.battleManifests,
      },
    };
    const tactical = new TacticalReplayVerifier().verify(verifySnap, CAMPAIGN_SEED);
    expect(tactical.match).toBe(true);
  });
});
