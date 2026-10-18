// S-5 02 (#76, spec #73 R3): the additive home area and possession ownership survive the save/load boundary
// byte-for-byte, and a snapshot that predates them still loads (wire formats stay additive).
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
import { StorablePossessionSchema } from "../src/schemas.js";
import { SaveStore } from "../src/store.js";

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
    ...(seeded ? { homeAreaId: "area-1" } : {}),
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
    campaignId: "presence-roundtrip",
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
            possessions: [
              { id: "poss_a", nationId: "uk", areaId: "area-1" },
              { id: "poss_b", nationId: "uk", areaId: "area-2" },
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
    rulesetVersion: "1.0.0",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
  const envelope = createEnvelope("campaign-snapshot", CURRENT_COMPATIBILITY_VERSION, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

describe("S-5 02 home area and possessions save/load parity", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-presence-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips the home area and the possession ownership with an identical snapshot and hash", () => {
    const saved = state(true);
    store.save(saved, tmpDir);
    const diagnostics = new DiagnosticCollector();
    const loaded = store.load(tmpDir, diagnostics);

    expect(diagnostics.hasErrors).toBe(false);
    expect(loaded).not.toBeNull();
    expect(loaded!.rawHash).toBe(saved.rawHash);
    expect(canonicalSerialize(loaded!.snapshot)).toBe(canonicalSerialize(saved.snapshot));
    expect(loaded!.snapshot.nations.get("uk")!.homeAreaId).toBe("area-1");
    expect(loaded!.snapshot.world.possessions?.map((p) => p.id)).toEqual(["poss_a", "poss_b"]);
  });

  it("loads a snapshot that predates the home area and possessions (both stay absent)", () => {
    const saved = state(false);
    store.save(saved, tmpDir);
    const diagnostics = new DiagnosticCollector();
    const loaded = store.load(tmpDir, diagnostics);

    expect(diagnostics.hasErrors).toBe(false);
    expect(loaded!.rawHash).toBe(saved.rawHash);
    expect(loaded!.snapshot.world.possessions).toBeUndefined();
    expect(loaded!.snapshot.nations.get("uk")!.homeAreaId).toBeUndefined();
  });
});

describe("S-5 02 persisted possession schema", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-possession-schema-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const decodes = (value: unknown): boolean =>
    Result.isSuccess(Schema.decodeUnknownResult(StorablePossessionSchema)(value));
  const good = { id: "poss_a", nationId: "uk", areaId: "area-1" };

  it("accepts a well-formed possession", () => {
    expect(decodes(good)).toBe(true);
  });

  it("rejects a malformed possession entry", () => {
    for (const bad of [
      { ...good, id: "" },
      { ...good, nationId: 7 },
      { ...good, areaId: "" },
      { id: "poss_a", nationId: "uk" },
      { ...good, extra: "x" },
      "not-an-object",
    ]) {
      expect(decodes(bad)).toBe(false);
    }
  });

  it("rejects a save whose present possessions field holds a malformed entry", () => {
    const saved = state(true);
    store.save(saved, tmpDir);
    const pointer = JSON.parse(readFileSync(join(tmpDir, "pointer.json"), "utf8")) as {
      activeSaveId: string;
    };
    const file = join(tmpDir, pointer.activeSaveId, "campaign.json");
    const raw = JSON.parse(readFileSync(file, "utf8")) as {
      snapshot: { world: { possessions: unknown[] } };
    };
    raw.snapshot.world.possessions = [{ id: "", nationId: "uk", areaId: "area-1" }];
    writeFileSync(file, JSON.stringify(raw));
    const diagnostics = new DiagnosticCollector();
    expect(store.load(tmpDir, diagnostics)).toBeNull();
    expect(diagnostics.hasErrors).toBe(true);
  });
});
