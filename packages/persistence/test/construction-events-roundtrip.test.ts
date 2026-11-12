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
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";
import { runExit, unwrapSuccess } from "./harness.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

const hit: ConstructionProject = {
  id: "project-hit",
  type: "ship",
  projectType: "NEW_CONSTRUCTION",
  targetId: "dv-1",
  designVersionId: "dv-1",
  totalWork: SafeInt(540),
  completedWork: SafeInt(100),
  paidWork: SafeInt(100),
  status: "DELAYED",
  startedAt: "1880-01",
  newConstructionReservedMassKg: 0,
  delayReasonCode: "STEEL_PLATE_SHORTAGE",
  delays: [
    { month: "1880-03", reasonCode: "YARD_WEATHER_DAMAGE", months: 1 },
    { month: "1880-05", reasonCode: "STEEL_PLATE_SHORTAGE", months: 3 },
  ],
  overruns: [
    { month: "1880-02", reasonCode: "DESIGN_CHANGE_REWORK", amount: SafeInt(25) },
    { month: "1880-04", reasonCode: "MATERIALS_PRICE_RISE", amount: SafeInt(15) },
  ],
};

const untouched: ConstructionProject = {
  id: "project-untouched",
  type: "ship",
  projectType: "NEW_CONSTRUCTION",
  targetId: "dv-2",
  designVersionId: "dv-2",
  totalWork: SafeInt(500),
  completedWork: SafeInt(0),
  paidWork: SafeInt(0),
  status: "ACTIVE",
  startedAt: "1880-01",
  newConstructionReservedMassKg: 0,
};

function state(): CampaignState {
  const nation: NationState = {
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
    constructionProjects: [hit, untouched],
    isPlayable: true,
    isAI: false,
  };
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "construction-events-roundtrip",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "uk", type: "playable" }],
    world: { areas: [{ id: "area-1", name: "Test Area", type: "sea" }], routes: [], ports: [] },
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
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

describe("construction event history persistence (#584)", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-construction-events-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips delays and overruns in order with an unchanged hash", () => {
    const saved = state();
    store.save(saved, tmpDir);
    const loaded = unwrapSuccess(runExit(store.load(tmpDir)));
    const projects = loaded.state.snapshot.nations.get("uk")!.constructionProjects;
    expect(projects).toEqual([hit, untouched]);
    expect(projects[0]!.delays?.map((d) => d.months)).toEqual([1, 3]);
    expect(projects[0]!.overruns?.map((o) => Number(o.amount))).toEqual([25, 15]);
    expect(projects[1]!.delays).toBeUndefined();
    expect(projects[1]!.overruns).toBeUndefined();
    expect(loaded.state.rawHash).toBe(saved.rawHash);
  });
});
