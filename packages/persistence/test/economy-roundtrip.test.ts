import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { Result, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { StorableTechnologySchema } from "../src/schemas.js";
import { SaveStore } from "../src/store.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

function nation(seeded: boolean): NationState {
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
    constructionProjects: [
      {
        id: "con_gbr_inflexible",
        type: "ship",
        projectType: "NEW_CONSTRUCTION",
        targetId: "gbr_inflexible",
        designVersionId: "des_gbr_inflexible",
        totalWork: SafeInt(100),
        completedWork: SafeInt(60),
        paidWork: SafeInt(0),
        status: "ACTIVE",
        startedAt: "1880-01",
        ...(seeded
          ? {
              packages: [
                {
                  id: "hull",
                  kind: "HULL" as const,
                  line: "slipway",
                  totalWork: SafeInt(70),
                  doneWork: SafeInt(60),
                  dependsOn: [],
                },
                {
                  id: "launch",
                  kind: "LAUNCH" as const,
                  line: "slipway",
                  totalWork: SafeInt(30),
                  doneWork: SafeInt(0),
                  dependsOn: ["hull"],
                },
              ],
              capacityUnits: { slipway: SafeInt(3), quay: SafeInt(3) },
              buildTimeMultiplierBp: 9300,
              nationalProfileId: "uk",
            }
          : {}),
      },
    ],
    isPlayable: true,
    isAI: false,
  };
}

function state(seeded: boolean): CampaignState {
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "economy-roundtrip",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "uk", type: "playable" }],
    world: {
      areas: [{ id: "area-1", name: "Test Area", type: "sea" }],
      routes: [],
      ports: [],
      ...(seeded
        ? {
            technologies: [
              {
                techId: "mac_triple_expansion",
                researchFieldId: "MACHINERY",
                cost: SafeInt(120),
                discoveryWeight: SafeInt(4000),
                prerequisites: ["mac_compound_engine"],
                availabilityMonth: SafeInt(72),
              },
            ],
          }
        : {}),
    },
    nations: new Map([["uk", nation(seeded)]]),
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

describe("economy model save/load parity (#138)", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-economy-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips the economy fields with an identical snapshot and hash", () => {
    const saved = state(true);
    store.save(saved, tmpDir);
    const diagnostics = new DiagnosticCollector();
    const loaded = store.load(tmpDir, diagnostics);

    expect(diagnostics.hasErrors).toBe(false);
    expect(loaded).not.toBeNull();
    expect(loaded!.rawHash).toBe(saved.rawHash);
    expect(canonicalSerialize(loaded!.snapshot)).toBe(canonicalSerialize(saved.snapshot));
    const uk = loaded!.snapshot.nations.get("uk")!;
    expect(uk.baseResources).toBe(6000);
    expect(uk.research.standingResearchBudget).toBe(5);
    expect(uk.constructionProjects[0]!.capacityUnits).toEqual({ slipway: 3, quay: 3 });
    expect(loaded!.snapshot.world.technologies?.[0]?.techId).toBe("mac_triple_expansion");
  });

  it("loads a snapshot that predates the additive catalogue and capacity fields", () => {
    const saved = state(false);
    store.save(saved, tmpDir);
    const diagnostics = new DiagnosticCollector();
    const loaded = store.load(tmpDir, diagnostics);

    expect(diagnostics.hasErrors).toBe(false);
    expect(loaded!.rawHash).toBe(saved.rawHash);
    expect(loaded!.snapshot.world.technologies).toBeUndefined();
    expect(
      loaded!.snapshot.nations.get("uk")!.constructionProjects[0]!.capacityUnits,
    ).toBeUndefined();
  });
});

describe("economy #166 persisted technology catalogue schema", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-technology-schema-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const decodes = (value: unknown): boolean =>
    Result.isSuccess(Schema.decodeUnknownResult(StorableTechnologySchema)(value));
  const good = {
    techId: "hc_wrought_iron_hull",
    researchFieldId: "HULL_CONSTRUCTION",
    cost: 50,
    discoveryWeight: 1000,
    prerequisites: [],
    availabilityMonth: 0,
  };

  it("accepts a well-formed technology matching the saved fixture shape", () => {
    expect(decodes(good)).toBe(true);
  });

  it("rejects a malformed technology entry", () => {
    for (const bad of [
      { ...good, techId: "" },
      { ...good, researchFieldId: "" },
      { ...good, cost: NaN },
      { ...good, cost: Infinity },
      { ...good, discoveryWeight: "1000" },
      { ...good, prerequisites: [""] },
      { ...good, prerequisites: "none" },
      { techId: "hc_wrought_iron_hull", researchFieldId: "HULL_CONSTRUCTION" },
      { ...good, extra: "x" },
      "not-an-object",
    ]) {
      expect(decodes(bad)).toBe(false);
    }
  });

  it("rejects a save whose present technologies field holds a malformed entry", () => {
    const saved = state(true);
    store.save(saved, tmpDir);
    const pointer = JSON.parse(readFileSync(join(tmpDir, "pointer.json"), "utf8")) as {
      activeSaveId: string;
    };
    const file = join(tmpDir, pointer.activeSaveId, "campaign.json");
    const raw = JSON.parse(readFileSync(file, "utf8")) as {
      snapshot: { world: { technologies: unknown[] } };
    };
    raw.snapshot.world.technologies = [{ techId: "hc_wrought_iron_hull", researchFieldId: "" }];
    writeFileSync(file, JSON.stringify(raw));
    const diagnostics = new DiagnosticCollector();
    expect(store.load(tmpDir, diagnostics)).toBeNull();
    expect(diagnostics.hasErrors).toBe(true);
  });
});
