// T-1 04 (#113, spec #109 R8, R15): the additive declined-battle record survives the save/load boundary byte for byte, a
// save that predates it (or never declines) still loads with the collection absent, and a malformed record is refused.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState, DeclinedBattleRecord } from "@bluewave/campaign";
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

function state(declined: readonly DeclinedBattleRecord[] | undefined): CampaignState {
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

  it("refuses a save holding a malformed, short or over-keyed declined record", () => {
    for (const bad of [
      { ...RECORD, battleId: "" },
      { ...RECORD, victoryPointCost: -1 },
      { ...RECORD, victoryPointCost: 1.5 },
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
});
