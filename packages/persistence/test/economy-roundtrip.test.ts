// Economy #138 (compatibility 3.1.0): the fields the 1880 economy model adds survive the save/load boundary byte-for-byte —
// the derived economic base, the seeded standing research budget, the pack research catalogue and a seeded project's
// packages and own capacity — and a snapshot without the additive catalogue and capacity still loads (wire formats stay additive).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
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
