import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CampaignSnapshot,
  CampaignState,
  NationState,
  PrestigeValueSet,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  COMPATIBILITY_MISMATCH_CODE,
  CURRENT_COMPATIBILITY_VERSION,
} from "../src/compatibility.js";
import { toStorableSnapshot } from "../src/snapshotSerialization.js";
import { SaveStore } from "../src/store.js";

const VALUE_SET = {
  lowerBound: SafeInt(0),
  upperBound: SafeInt(100),
  sackingThreshold: SafeInt(10),
  sackingProbabilityBp: SafeInt(2_500),
  rules: {
    UNPAID_FUNDS: { kind: "PROPORTIONAL_LOSS", basisPoints: SafeInt(300) },
    BATTLE_LOST: { kind: "PROPORTIONAL_LOSS", basisPoints: SafeInt(500) },
    BATTLE_WON: { kind: "FIXED_GAIN", amount: SafeInt(1) },
  },
} as const satisfies PrestigeValueSet;

function makeNation(prestige: number): NationState {
  return {
    id: "nation-a",
    name: "Nation A",
    tag: "NVA",
    treasury: SafeInt(0),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(0),
    maintenanceCost: SafeInt(0),
    prestige: SafeInt(prestige),
    fleets: [],
    divisions: [],
    research: {
      nationId: "nation-a",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
  };
}

function makeFixtureState(
  prestige = 33,
  version = CURRENT_COMPATIBILITY_VERSION,
  prestigeRules: PrestigeValueSet = VALUE_SET,
): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "readiness-roundtrip",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "nation-a", type: "playable" }],
    world: {
      areas: [{ id: "area-1", name: "Area One", type: "sea" }],
      routes: [],
      ports: [],
    },
    nations: new Map([["nation-a", makeNation(prestige)]]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    prestigeRules,
    rulesetVersion: "1.0.0",
    compatibilityVersion: version,
  };
  const envelope = createEnvelope("campaign-snapshot", version, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

describe("SaveStore round-trips the S-2 prestige state", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-prestige-"));
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("save -> load preserves a nation's prestige and the value set exactly", () => {
    const state = makeFixtureState(33);
    const store = new SaveStore();
    store.save(state, tmpDir);

    const diagnostics = new DiagnosticCollector();
    const loaded = store.load(tmpDir, diagnostics);
    expect(diagnostics.hasErrors).toBe(false);
    expect(loaded).not.toBeNull();
    if (!loaded) return;

    expect(loaded.snapshot.nations.get("nation-a")?.prestige).toBe(33);
    expect(loaded.snapshot.prestigeRules).toEqual(VALUE_SET);
    expect(loaded.rawHash).toBe(state.rawHash);
    expect(loaded.envelope.bodyHash).toBe(state.envelope.bodyHash);
  });

  it("moves the stored snapshot hash when a nation's prestige changes", () => {
    const hash = (prestige: number) =>
      sha256Hex(canonicalSerialize(toStorableSnapshot(makeFixtureState(prestige).snapshot)));
    expect(hash(20)).not.toBe(hash(21));
    expect(hash(20)).toBe(hash(20));
  });

  it("moves the stored snapshot hash when the value set changes", () => {
    const base = makeFixtureState(20).snapshot;
    const changed: CampaignSnapshot = {
      ...base,
      prestigeRules: { ...VALUE_SET, sackingProbabilityBp: SafeInt(2_501) },
    };
    expect(sha256Hex(canonicalSerialize(toStorableSnapshot(base)))).not.toBe(
      sha256Hex(canonicalSerialize(toStorableSnapshot(changed))),
    );
  });

  it("round-trips an authored DECLINED_BATTLE fixed-loss rule exactly (ADR-0261)", () => {
    const withRule = makeFixtureState(33, CURRENT_COMPATIBILITY_VERSION, {
      ...VALUE_SET,
      rules: { ...VALUE_SET.rules, DECLINED_BATTLE: { kind: "FIXED_LOSS", amount: SafeInt(2) } },
    });
    new SaveStore().save(withRule, tmpDir);
    const loaded = new SaveStore().load(tmpDir, new DiagnosticCollector());
    expect(loaded?.snapshot.prestigeRules).toEqual(withRule.snapshot.prestigeRules);
    expect(loaded?.rawHash).toBe(withRule.rawHash);
  });

  it("stores a value set without DECLINED_BATTLE with no such key, so its bytes do not move (ADR-0261)", () => {
    const stored = canonicalSerialize(toStorableSnapshot(makeFixtureState(20).snapshot));
    expect(stored).not.toContain("DECLINED_BATTLE");
  });

  it("refuses a save from the previous compatibility version before decoding it", () => {
    const previous = "3.1.0";
    const state = makeFixtureState(33, previous);
    new SaveStore(previous).save(state, tmpDir);

    const diagnostics = new DiagnosticCollector();
    const loaded = new SaveStore().load(tmpDir, diagnostics);
    expect(loaded).toBeNull();
    expect(diagnostics.all.map((d) => d.code)).toContain(COMPATIBILITY_MISMATCH_CODE);
  });

  it("is stamped with the new compatibility version", () => {
    expect(CURRENT_COMPATIBILITY_VERSION).toBe("4.0.0");
  });
});
