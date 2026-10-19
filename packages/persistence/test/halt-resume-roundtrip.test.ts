// SB-3/INC-3 (DESIGN-23 section 7, ADR-0129): a construction project's steering status survives the save/load
// boundary. HALTED and DELAYED are part of the DESIGN-23 section 2 vocabulary, so they must round-trip through the
// real SaveStore, not only live in memory.
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

function project(status: ConstructionProject["status"], id: string): ConstructionProject {
  return {
    id,
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: id,
    designVersionId: "",
    totalWork: SafeInt(200),
    completedWork: SafeInt(50),
    paidWork: SafeInt(50),
    status,
    startedAt: "1880-01",
  };
}

function nation(): NationState {
  return {
    id: "uk",
    name: "United Kingdom",
    tag: "UK",
    treasury: SafeInt(10_000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2_000),
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
    constructionProjects: [project("HALTED", "proj-halt"), project("DELAYED", "proj-delay")],
    isPlayable: true,
    isAI: false,
  };
}

function state(): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "halt-resume-roundtrip",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "uk", type: "playable" }],
    world: { areas: [{ id: "area-1", name: "Test Area", type: "sea" }], routes: [], ports: [] },
    nations: new Map([["uk", nation()]]),
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

describe("halted / delayed construction status persistence (INC-3)", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-halt-resume-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips HALTED and DELAYED project statuses through save/load", () => {
    const saved = state();
    store.save(saved, tmpDir);
    const loaded = store.load(tmpDir, new DiagnosticCollector());
    expect(loaded).not.toBeNull();
    const projects = loaded!.snapshot.nations.get("uk")!.constructionProjects;
    expect(projects.map((p) => p.status).sort()).toEqual(["DELAYED", "HALTED"]);
    expect(loaded!.rawHash).toBe(saved.rawHash);
  });
});
