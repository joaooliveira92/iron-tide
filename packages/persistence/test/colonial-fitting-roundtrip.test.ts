// S-5 04 (#78, spec #73 R4/R13): the colonial-service fitting on a compiled design version and on a built ship survives
// the save/load boundary, and an unfitted design or ship (anything that predates the fitting) loads with no flag.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CampaignSnapshot,
  CampaignState,
  CompiledDesignVersion,
  NationState,
  Ship,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

const design = (id: string, fitted: boolean): CompiledDesignVersion => ({
  designVersionId: id,
  designFamilyId: "fam",
  className: "Test class",
  nationId: "uk",
  hullType: "KE",
  normalizedDisplacementKg: SafeInt(1_000_000),
  normalizedSpeedUms: SafeInt(10_000_000),
  normalizedArmorUm: SafeInt(0),
  hitPoints: SafeInt(100),
  mainGunsCaliber: SafeInt(0),
  mainGunsCount: SafeInt(0),
  machineryType: "steam",
  crewComplement: SafeInt(10),
  contentVersion: "t",
  compiledHash: "h",
  ...(fitted ? { colonialServiceFitted: true as const } : {}),
});

const ship = (id: string, designVersionId: string, fitted: boolean): Ship => ({
  id,
  name: id,
  classId: "Test class",
  nationId: "uk",
  locationAreaId: "area-1",
  designVersionId,
  hitPoints: SafeInt(100),
  maxHitPoints: SafeInt(100),
  speed: SafeInt(10),
  firepower: SafeInt(1),
  armor: SafeInt(1),
  isUnderConstruction: false,
  constructionProgress: SafeInt(0),
  constructionTotalWork: SafeInt(0),
  readiness: "ACTIVE",
  crewQuality: SafeInt(100),
  ...(fitted ? { colonialServiceFitted: true as const } : {}),
});

function nation(): NationState {
  return {
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
    fleets: [
      {
        id: "fleet-1",
        nationId: "uk",
        name: "Fleet",
        locationAreaId: "area-1",
        ships: [ship("fitted", "d_fit", true), ship("plain", "d_plain", false)],
      },
    ],
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
}

function state(): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "colonial-fitting-roundtrip",
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
    designs: new Map([
      ["d_fit", design("d_fit", true)],
      ["d_plain", design("d_plain", false)],
    ]),
    designFamilies: new Map(),
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    rulesetVersion: "1.0.0",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
  const envelope = createEnvelope("campaign-snapshot", CURRENT_COMPATIBILITY_VERSION, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

describe("S-5 04 colonial-service fitting save/load parity", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-colonial-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips the flag on the design version and the ship with an identical snapshot and hash", () => {
    const saved = state();
    store.save(saved, tmpDir);
    const diagnostics = new DiagnosticCollector();
    const loaded = store.load(tmpDir, diagnostics);

    expect(diagnostics.hasErrors).toBe(false);
    expect(loaded).not.toBeNull();
    expect(loaded!.rawHash).toBe(saved.rawHash);
    expect(canonicalSerialize(loaded!.snapshot)).toBe(canonicalSerialize(saved.snapshot));
    expect(loaded!.snapshot.designs.get("d_fit")!.colonialServiceFitted).toBe(true);
    const [fitted, plain] = loaded!.snapshot.nations.get("uk")!.fleets[0]!.ships;
    expect(fitted!.colonialServiceFitted).toBe(true);
    expect("colonialServiceFitted" in plain!).toBe(false);
    expect("colonialServiceFitted" in loaded!.snapshot.designs.get("d_plain")!).toBe(false);
  });
});
