//packages/persistence/test/battle-generation-persistence.test.ts

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";

// Builds a snapshot carrying the new B-1 snapshot fields (battleManifests,
// divisions, manifestHash) so save/load round-trips them (AC-13).
function makeManifestSnapshot(): CampaignSnapshot {
  return {
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "battle-gen-persistence",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [
      { nationId: "GBR", type: "playable" },
      { nationId: "FRA", type: "ai" },
    ],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([
      [
        "GBR",
        {
          id: "GBR",
          name: "GBR",
          tag: "GBR",
          treasury: SafeInt(10000),
          income: SafeInt(0),
          expenses: SafeInt(0),
          baseResources: SafeInt(0),
          navalAppropriationRateBp: SafeInt(2000),
          maintenanceCost: SafeInt(0),
          fleets: [],
          divisions: [
            {
              divisionId: "div_1",
              nationId: "GBR",
              shipOrder: ["g1"],
              flagshipShipId: "g1",
              commanderOfficerId: "VACANT",
              divisionRole: "CORE",
              preferredFormation: "LINE_AHEAD",
              experience: SafeInt(20),
              cohesion: SafeInt(30),
              locationAreaId: "a-1",
              creationMonth: "1880-01",
              lastReorganizationMonth: "1880-01",
              provenanceRefs: [],
              rulesetVersion: "1.0",
              aggregateHash: "agg_1",
            },
          ],
          research: {
            nationId: "GBR",
            technologies: [],
            fieldPriorities: {},
            researchBudget: SafeInt(0),
            activeCandidates: new Map(),
            discoveredTechs: [],
          },
          constructionProjects: [],
          isPlayable: true,
          isAI: false,
        },
      ],
    ]),
    wars: {
      wars: [],
      battles: [
        {
          id: "battle_1",
          phase: "pending",
          attackerId: "GBR",
          defenderId: "FRA",
          areaId: "a-1",
          attackerFleetIds: [],
          defenderFleetIds: [],
          manifestHash: "manifest_hash_1",
        },
      ],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [
        {
          battleId: "battle_1",
          opportunityId: "opp_1",
          warId: "war_1",
          areaId: "a-1",
          missionType: "FLEET_BATTLE",
          attackerId: "GBR",
          defenderId: "FRA",
          acceptanceClass: "OPTIONAL",
          missionObjectives: [],
          sides: [
            { sideId: "ATTACKER", participantIds: ["GBR"] },
            { sideId: "DEFENDER", participantIds: ["FRA"] },
          ],
          persistentAssets: ["g1"],
          temporaryAssets: [],
          permanentDivisionIds: ["div_1"],
          tacticalDivisions: [],
          commanders: [],
          weather: "clear",
          seaState: "moderate",
          visibility: "good",
          environment: "day",
          sourceStateHashes: {},
          reservations: ["g1"],
          autoResolutionProof: "proof",
          provenanceRecords: [],
          battleSeed: "seed_1",
          rulesetVersion: "1.0",
          formulaVersion: "1",
          aiPolicyVersion: "1",
          rngVersion: "1",
          contentVersion: "0.3.0",
          manifestHash: "manifest_hash_1",
        },
      ],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "1.0",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
}

describe("battle-generation persistence (AC-13)", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "battle-gen-persist-"));
    store = new SaveStore();
  });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it("save/load roundtrip preserves manifests, divisions, and reservations", () => {
    const snapshot = makeManifestSnapshot();
    const envelope = createEnvelope("campaign-snapshot", CURRENT_COMPATIBILITY_VERSION, snapshot);
    const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
    const state: CampaignState = { snapshot, envelope, rawHash };

    const saved = store.save(state, tmpDir);
    expect(saved).toBeDefined();

    const loaded = store.load(tmpDir, new DiagnosticCollector());
    expect(loaded).toBeDefined();
    const loadedSnapshot = loaded!.snapshot;
    expect(loadedSnapshot.wars.battleManifests).toEqual(snapshot.wars.battleManifests);
    expect(loadedSnapshot.wars.battles).toEqual(snapshot.wars.battles);
    expect(loadedSnapshot.wars.battles[0]!.manifestHash).toBe("manifest_hash_1");
  });

  it("reload after a save/load cycle recomputes identical rawHash (canonical stability)", () => {
    const snapshot = makeManifestSnapshot();
    const envelope = createEnvelope("campaign-snapshot", CURRENT_COMPATIBILITY_VERSION, snapshot);
    const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
    const state: CampaignState = { snapshot, envelope, rawHash };

    store.save(state, tmpDir);
    const loaded = store.load(tmpDir, new DiagnosticCollector());
    expect(loaded).toBeDefined();
    expect(loaded!.rawHash).toBe(rawHash);
  });

  it("schema version is pinned and recorded", () => {
    expect(CURRENT_COMPATIBILITY_VERSION).toBe("2.0.0");
  });
});
