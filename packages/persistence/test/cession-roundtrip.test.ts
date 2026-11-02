import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";
import { runExit, unwrapSuccess } from "./harness.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

const nation: NationState = {
  id: "uk",
  name: "United Kingdom",
  tag: "UK",
  treasury: SafeInt(500),
  income: SafeInt(100),
  expenses: SafeInt(38),
  baseResources: SafeInt(6000),
  navalAppropriationRateBp: SafeInt(2000),
  maintenanceCost: SafeInt(16),
  prestige: SafeInt(20),
  homeAreaId: "area-home",
  fleets: [],
  divisions: [],
  research: {
    nationId: "uk",
    technologies: [],
    fieldPriorities: { MACHINERY: SafeInt(4) },
    researchBudget: SafeInt(5),
    standingResearchBudget: SafeInt(5),
    activeCandidates: new Map(),
    discoveredTechs: [],
  },
  constructionProjects: [],
  isPlayable: true,
  isAI: false,
};

function stateWithArea(area: { controller?: string; cessionCost?: SafeInt }): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "cession-roundtrip",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "uk", type: "playable" }],
    world: {
      areas: [{ id: "area-1", name: "Test Area", type: "sea", ...area }],
      routes: [],
      ports: [],
      possessions: [{ id: "poss_a", nationId: "uk", areaId: "area-1" }],
    },
    nations: new Map([["uk", nation]]),
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
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    rulesetVersion: "1.0.0",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
  const envelope = createEnvelope("campaign-snapshot", CURRENT_COMPATIBILITY_VERSION, snapshot);
  return { snapshot, envelope, rawHash: sha256Hex(canonicalSerialize({ snapshot, envelope })) };
}

describe("area controller and cession cost save/load parity (#483)", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-cession-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips a rewritten controller and a cession cost with an identical hash", () => {
    const saved = stateWithArea({ controller: "france", cessionCost: SafeInt(6) });
    store.save(saved, tmpDir);
    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));

    expect(loaded.warnings).toEqual([]);
    expect(loaded.state.rawHash).toBe(saved.rawHash);
    expect(canonicalSerialize(loaded.state.snapshot)).toBe(canonicalSerialize(saved.snapshot));
    expect(loaded.state.snapshot.world.areas[0]).toEqual({
      id: "area-1",
      name: "Test Area",
      type: "sea",
      controller: "france",
      cessionCost: 6,
    });
  });

  it("hashes a ceded controller differently from the original holder", () => {
    const before = stateWithArea({ controller: "france" });
    const after = stateWithArea({ controller: "uk" });
    expect(after.rawHash).not.toBe(before.rawHash);
    store.save(after, tmpDir);
    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));
    expect(loaded.state.rawHash).toBe(after.rawHash);
  });

  it("loads an area saved before the cession cost existed with the field still absent", () => {
    const saved = stateWithArea({ controller: "france" });
    store.save(saved, tmpDir);
    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));
    expect(loaded.state.rawHash).toBe(saved.rawHash);
    expect(loaded.state.snapshot.world.areas[0]).not.toHaveProperty("cessionCost");
  });
});
