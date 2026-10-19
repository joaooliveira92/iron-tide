import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Schema } from "effect";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { SafeInt } from "@bluewave/contracts";
import { CURRENT_COMPATIBILITY_VERSION, SaveStore } from "@bluewave/persistence";
import type { CampaignSnapshot, CampaignState, NationState } from "@bluewave/campaign";
import { createEnvelope, canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { loadCampaignSave } from "../src/main/campaignSave.js";
import { LoadSaveResultSchema } from "../src/main/campaignSaveSchema.js";

function buildNation(id: string): NationState {
  return {
    id,
    name: `Nation ${id}`,
    tag: id.toUpperCase(),
    treasury: SafeInt.ZERO,
    income: SafeInt.ZERO,
    expenses: SafeInt.ZERO,
    baseResources: SafeInt.ZERO,
    navalAppropriationRateBp: SafeInt.ZERO,
    maintenanceCost: SafeInt.ZERO,
    prestige: SafeInt(20),
    fleets: [],
    divisions: [],
    research: {
      nationId: id,
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt.ZERO,
      activeCandidates: new Map([["basic_steam", "candidate-a"]]),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
  };
}

function buildSnapshot(): CampaignSnapshot {
  const nations = new Map<string, NationState>();
  nations.set("uk", buildNation("uk"));

  return {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "test-campaign-001",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "uk", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations,
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
}

function buildState(): CampaignState {
  const snapshot = buildSnapshot();
  const envelope = createEnvelope("campaign-snapshot", snapshot.compatibilityVersion, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

describe("campaignSave module", () => {
  let saveDir: string;

  beforeEach(() => {
    saveDir = mkdtempSync(join(tmpdir(), "bw-desktop-save-"));
  });

  afterEach(() => {
    rmSync(saveDir, { recursive: true, force: true });
  });

  it("loads the active save and reports success with no diagnostics", () => {
    new SaveStore().save(buildState(), saveDir);

    const result = loadCampaignSave(saveDir);

    expect(result.success).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.rawHash).toBeDefined();
    expect(result.envelope).toBeDefined();
    expect(result.snapshot).toBeDefined();
    expect(() => Schema.decodeUnknownSync(LoadSaveResultSchema)(result)).not.toThrow();
  });

  it("produces a result matching the IPC boundary schema on failure too", () => {
    const result = loadCampaignSave("/nonexistent/save/dir");

    expect(() => Schema.decodeUnknownSync(LoadSaveResultSchema)(result)).not.toThrow();
  });

  it("converts Map-valued snapshot fields to plain objects", () => {
    new SaveStore().save(buildState(), saveDir);

    const result = loadCampaignSave(saveDir);

    const snapshot = result.snapshot as Record<string, unknown>;
    expect(snapshot["nations"]).not.toBeInstanceOf(Map);
    expect(snapshot["designs"]).not.toBeInstanceOf(Map);
    expect(snapshot["designFamilies"]).not.toBeInstanceOf(Map);
    // JSON.stringify must be able to render the whole snapshot without dropping data.
    expect(() => JSON.stringify(snapshot)).not.toThrow();
  });

  it("returns a MISSING_SAVE diagnostic for a directory with no save data", () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "bw-desktop-empty-"));

    const result = loadCampaignSave(emptyDir);

    expect(result.success).toBe(false);
    expect(result.snapshot).toBeUndefined();
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]!.code).toBe("PERSISTENCE_MISSING_SAVE");

    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("returns a MISSING_SAVE diagnostic for a non-existent save directory", () => {
    const result = loadCampaignSave("/nonexistent/save/dir");

    expect(result.success).toBe(false);
    expect(result.diagnostics[0]!.code).toBe("PERSISTENCE_MISSING_SAVE");
  });

  it("returns a CORRUPT_SAVE diagnostic when the pointer file is malformed", () => {
    writeFileSync(join(saveDir, "pointer.json"), "not json", "utf8");

    const result = loadCampaignSave(saveDir);

    expect(result.success).toBe(false);
    expect(result.diagnostics[0]!.code).toBe("PERSISTENCE_CORRUPT_SAVE");
  });
});
