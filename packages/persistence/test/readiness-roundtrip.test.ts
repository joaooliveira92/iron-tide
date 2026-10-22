import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState, NationState, Ship } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

function makeShip(): Ship {
  return {
    id: "ship-a",
    name: "HMS Example",
    classId: "battleship",
    nationId: "nation-a",
    locationAreaId: "area-1",
    designVersionId: "dv-ship-a",
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    speed: SafeInt(30),
    firepower: SafeInt(10),
    armor: SafeInt(12),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "MOTHBALLED",
    crewQuality: SafeInt(7),
  };
}

function makeNation(): NationState {
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
    prestige: SafeInt(20),
    fleets: [
      {
        id: "fleet-a",
        nationId: "nation-a",
        name: "Home Fleet",
        locationAreaId: "area-1",
        ships: [makeShip()],
      },
    ],
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

function makeFixtureState(): CampaignState {
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
    nations: new Map([["nation-a", makeNation()]]),
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

describe("SaveStore round-trips the S-1 per-ship readiness and crew quality", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-readiness-"));
    store = new SaveStore();
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("save -> load preserves readiness and crewQuality exactly", () => {
    const state = makeFixtureState();
    store.save(state, tmpDir);

    const diagnostics = new DiagnosticCollector();
    const loaded = store.load(tmpDir, diagnostics);
    expect(diagnostics.hasErrors).toBe(false);
    expect(loaded).not.toBeNull();
    if (!loaded) return;

    const ship = loaded.snapshot.nations.get("nation-a")!.fleets[0]!.ships[0]!;
    expect(ship.readiness).toBe("MOTHBALLED");
    expect(ship.crewQuality).toBe(7);
    expect(loaded.rawHash).toBe(state.rawHash);
    expect(loaded.envelope.bodyHash).toBe(state.envelope.bodyHash);
  });
});
