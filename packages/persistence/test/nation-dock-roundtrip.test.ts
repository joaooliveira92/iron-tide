// SB-3/INC-5c (ADR-0135): a nation's materialised dock limits survive the save/load boundary. The dock enters
// campaign state so dock expansion can mutate it; this pins the round-trip through the real SaveStore.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CampaignSnapshot,
  CampaignState,
  ConstructionProject,
  NationState,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

const dock = {
  maximumNewConstructionMassKg: 13_000_000,
  maximumMajorRepairMassKg: 13_000_000,
  maximumRebuildMassKg: 13_000_000,
  maximumConversionMassKg: 13_000_000,
};

function nation(projects: ConstructionProject[] = []): NationState {
  return {
    id: "uk",
    name: "United Kingdom",
    tag: "UK",
    treasury: SafeInt(10000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    prestige: SafeInt(20),
    fleets: [],
    divisions: [],
    research: {
      nationId: "uk",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: projects,
    dock,
    isPlayable: true,
    isAI: false,
  };
}

function state(projects: ConstructionProject[] = []): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "dock-roundtrip",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "uk", type: "playable" }],
    world: { areas: [{ id: "area-1", name: "Test Area", type: "sea" }], routes: [], ports: [] },
    nations: new Map([["uk", nation(projects)]]),
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
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

describe("nation dock persistence (INC-5c, ADR-0135)", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-nation-dock-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips the nation's dock limits through save/load", () => {
    const saved = state();
    store.save(saved, tmpDir);
    const loaded = store.load(tmpDir, new DiagnosticCollector());
    expect(loaded).not.toBeNull();
    expect(loaded!.snapshot.nations.get("uk")!.dock).toEqual(dock);
    expect(loaded!.rawHash).toBe(saved.rawHash);
  });

  it("round-trips a batch order's canonical name and class fields (SB3-R11)", () => {
    const project: ConstructionProject = {
      id: "project-b1-1",
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "dv-b",
      designVersionId: "dv-b",
      totalWork: SafeInt(100),
      completedWork: SafeInt(0),
      paidWork: SafeInt(0),
      status: "PLANNED",
      startedAt: "1880-01",
      shipName: "Devastation",
      batchId: "batch-b1",
      namedClassId: "dv-b-family",
      batchOrdinal: 1,
      namePoolId: "name_pool:uk:B",
      namePoolOrdinal: 1,
    };
    const saved = state([project]);
    store.save(saved, tmpDir);
    const loaded = store.load(tmpDir, new DiagnosticCollector());
    expect(loaded).not.toBeNull();
    expect(loaded!.snapshot.nations.get("uk")!.constructionProjects).toEqual([project]);
    expect(loaded!.rawHash).toBe(saved.rawHash);
  });
});
