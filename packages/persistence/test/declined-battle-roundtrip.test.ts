import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CampaignSnapshot,
  CampaignState,
  DeclineCounterEntry,
  DeclinedBattleRecord,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

const RECORD: DeclinedBattleRecord = {
  battleId: "battle-1",
  warId: "war_1",
  nationId: "GBR",
  areaId: "a-1",
  month: "1880-01",
  missionType: "FLEET_BATTLE",
  responseInputHash: "f".repeat(64),
  victoryPointCost: 4,
  opponentCredit: 0,
};

const COUNTER: DeclineCounterEntry = {
  key: "WAR|war_1|GBR",
  nationId: "GBR",
  lastWarId: "war_1",
  count: 2,
  decayAnchorMonth: "1880-01",
};

function state(
  declined: readonly DeclinedBattleRecord[] | undefined,
  counters?: readonly DeclineCounterEntry[],
): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "declined-roundtrip",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map(),
    wars: {
      wars: [],
      battles: [
        {
          id: "battle-1",
          phase: "declined",
          attackerId: "GBR",
          defenderId: "FRA",
          areaId: "a-1",
          attackerFleetIds: [],
          defenderFleetIds: [],
        },
      ],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
      ...(declined === undefined ? {} : { declinedBattles: [...declined] }),
      ...(counters === undefined ? {} : { declineCounters: [...counters] }),
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    rulesetVersion: "1.0.0",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
  const envelope = createEnvelope("campaign-snapshot", CURRENT_COMPATIBILITY_VERSION, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

describe("declined-battle record save/load parity", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-declined-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function tamper(edit: (wars: { declinedBattles: unknown[] }) => void): void {
    const pointer = JSON.parse(readFileSync(join(tmpDir, "pointer.json"), "utf8")) as {
      activeSaveId: string;
    };
    const file = join(tmpDir, pointer.activeSaveId, "campaign.json");
    const raw = JSON.parse(readFileSync(file, "utf8")) as {
      snapshot: { wars: { declinedBattles: unknown[] } };
    };
    edit(raw.snapshot.wars);
    writeFileSync(file, JSON.stringify(raw));
  }

  function tamperCounters(edit: (wars: { declineCounters: unknown[] }) => void): void {
    const pointer = JSON.parse(readFileSync(join(tmpDir, "pointer.json"), "utf8")) as {
      activeSaveId: string;
    };
    const file = join(tmpDir, pointer.activeSaveId, "campaign.json");
    const raw = JSON.parse(readFileSync(file, "utf8")) as {
      snapshot: { wars: { declineCounters: unknown[] } };
    };
    edit(raw.snapshot.wars);
    writeFileSync(file, JSON.stringify(raw));
  }

  it("round-trips the records, the terminal battle phase and the hash exactly", () => {
    const saved = state([RECORD, { ...RECORD, battleId: "battle-2", areaId: "a-2" }]);
    store.save(saved, tmpDir);
    const diagnostics = new DiagnosticCollector();
    const loaded = store.load(tmpDir, diagnostics);

    expect(diagnostics.all.map((d) => d.message)).toEqual([]);
    expect(loaded!.rawHash).toBe(saved.rawHash);
    expect(canonicalSerialize(loaded!.snapshot)).toBe(canonicalSerialize(saved.snapshot));
    expect(loaded!.snapshot.wars.declinedBattles?.map((r) => r.battleId)).toEqual([
      "battle-1",
      "battle-2",
    ]);
    expect(loaded!.snapshot.wars.battles[0]?.phase).toBe("declined");
  });

  it("loads a save that never declined with the collection absent, under the unchanged compatibility version", () => {
    const saved = state(undefined);
    store.save(saved, tmpDir);
    const diagnostics = new DiagnosticCollector();
    const loaded = store.load(tmpDir, diagnostics);

    expect(diagnostics.hasErrors).toBe(false);
    expect(loaded!.rawHash).toBe(saved.rawHash);
    expect(loaded!.snapshot.wars.declinedBattles).toBeUndefined();
    expect("declinedBattles" in loaded!.snapshot.wars).toBe(false);
    expect(CURRENT_COMPATIBILITY_VERSION).toBe("4.0.0");
  });

  it("refuses, rather than silently loading, a state-bearing save whose new keys a reader without them would drop (R15)", () => {
    for (const dropped of ["declinedBattles", "declineCounters"] as const) {
      store.save(state([RECORD], [COUNTER]), tmpDir);
      tamper((wars) => {
        delete (wars as Record<string, unknown>)[dropped];
      });
      const diagnostics = new DiagnosticCollector();
      expect(store.load(tmpDir, diagnostics)).toBeNull();
      expect(diagnostics.hasErrors).toBe(true);
    }
  });

  it("refuses a save holding a malformed, short or over-keyed declined record", () => {
    for (const bad of [
      { ...RECORD, battleId: "" },
      { ...RECORD, victoryPointCost: -1 },
      { ...RECORD, victoryPointCost: 1.5 },
      { ...RECORD, victoryPointCost: Number.MAX_SAFE_INTEGER + 1 },
      { ...RECORD, opponentCredit: Number.MAX_SAFE_INTEGER + 1 },
      { ...RECORD, extra: "x" },
      { battleId: "battle-1" },
      "not-an-object",
    ]) {
      store.save(state([RECORD]), tmpDir);
      tamper((wars) => {
        wars.declinedBattles = [bad];
      });
      const diagnostics = new DiagnosticCollector();
      expect(store.load(tmpDir, diagnostics)).toBeNull();
      expect(diagnostics.hasErrors).toBe(true);
    }
  });

  it("round-trips the decline tallies exactly and loads a save without them with the field absent (T-1 05)", () => {
    const saved = state([RECORD], [COUNTER, { ...COUNTER, key: "CAMPAIGN", count: 0 }]);
    store.save(saved, tmpDir);
    const loaded = store.load(tmpDir, new DiagnosticCollector());
    expect(loaded!.rawHash).toBe(saved.rawHash);
    expect(loaded!.snapshot.wars.declineCounters).toEqual([
      COUNTER,
      { ...COUNTER, key: "CAMPAIGN", count: 0 },
    ]);

    const bare = state([RECORD]);
    store.save(bare, tmpDir);
    const reloaded = store.load(tmpDir, new DiagnosticCollector());
    expect("declineCounters" in reloaded!.snapshot.wars).toBe(false);
  });

  it("refuses a save holding a malformed, short or over-keyed decline tally (T-1 05)", () => {
    for (const bad of [
      { ...COUNTER, key: "" },
      { ...COUNTER, count: -1 },
      { ...COUNTER, count: 1.5 },
      { ...COUNTER, count: Number.MAX_SAFE_INTEGER + 1 },
      { ...COUNTER, decayAnchorMonth: "1880-13" },
      { ...COUNTER, extra: "x" },
      { key: "CAMPAIGN" },
      "not-an-object",
    ]) {
      store.save(state([RECORD], [COUNTER]), tmpDir);
      tamperCounters((wars) => {
        wars.declineCounters = [bad];
      });
      const diagnostics = new DiagnosticCollector();
      expect(store.load(tmpDir, diagnostics)).toBeNull();
      expect(diagnostics.hasErrors).toBe(true);
    }
  });
});
