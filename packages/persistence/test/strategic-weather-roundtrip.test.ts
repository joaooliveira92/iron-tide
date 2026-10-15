// B-6/ADR-0025 (AC-1/AC-11): the new snapshot fields — startYear/startMonth and
// the current-month per-area strategicWeather collection — survive SaveStore
// save -> load -> replay round trips. strategicWeather is a plain canonically
// ordered array (JSON-native, no Map/Record conversion needed), so the existing
// storable snapshot shape carries it automatically.

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CampaignSnapshot, CampaignState, CampaignWeatherState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";

function makeWeatherState(areaId: string, month: string, salt: number): CampaignWeatherState {
  return {
    areaId,
    month,
    climateProfileId: "default",
    seasonId: "summer",
    persistentWeatherStateId: "",
    seaState: 1 + (salt % 5),
    windDirectionDeg: salt % 360,
    windSpeedUmPerSec: 5_000_000 + salt,
    precipitationType: "NONE",
    precipitationIntensityBp: 0,
    fogMistDensityBp: 100,
    cloudCoverBp: 2_000,
    daylightProfileId: "default_daylight_v1",
    glareEligible: true,
    baseVisibilityUm: 50_000_000_000,
    generatedAtPhase: "weather_generation",
    rulesetVersion: "weather_ruleset_v1",
    climateVersion: "weather_climate_v1",
    formulaVersion: "weather_formula_v1",
    rngVersion: "weather_rng_v1",
    stateHash: `statehash_${areaId}_${salt}`,
  };
}

function makeFixtureState(): CampaignState {
  const weather: CampaignWeatherState[] = [
    makeWeatherState("alpha", "1880-06", 1),
    makeWeatherState("beta", "1880-06", 2),
  ];
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "weather-roundtrip",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: weather,
    slots: [{ nationId: "nation-a", type: "playable" }],
    world: {
      areas: [
        { id: "alpha", name: "Alpha Sea", type: "sea" },
        { id: "beta", name: "Beta Sea", type: "sea" },
      ],
      routes: [],
      ports: [],
    },
    nations: new Map(),
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

describe("SaveStore round-trips the B-6 strategic-weather schema", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-sw-"));
    store = new SaveStore();
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("save -> load preserves startYear, startMonth and the full strategicWeather collection", () => {
    const state = makeFixtureState();
    store.save(state, tmpDir);

    const diagnostics = new DiagnosticCollector();
    const loaded = store.load(tmpDir, diagnostics);
    expect(diagnostics.hasErrors).toBe(false);
    expect(loaded).not.toBeNull();
    if (!loaded) return;

    expect(loaded.snapshot.startYear).toBe(1880);
    expect(loaded.snapshot.startMonth).toBe(1);
    expect(loaded.snapshot.strategicWeather).toEqual(state.snapshot.strategicWeather);
    expect(loaded.snapshot.strategicWeather.map((s) => s.areaId)).toEqual(["alpha", "beta"]);
  });

  it("rawHash and envelope survive the round trip (canonical stability)", () => {
    const state = makeFixtureState();
    store.save(state, tmpDir);

    const diagnostics = new DiagnosticCollector();
    const loaded = store.load(tmpDir, diagnostics);
    expect(loaded).not.toBeNull();
    if (!loaded) return;
    expect(loaded.rawHash).toBe(state.rawHash);
    expect(loaded.envelope.bodyHash).toBe(state.envelope.bodyHash);
  });

  it("a snapshot WITHOUT the B-6 collection is rejected as incompatible (no silent continuation)", () => {
    const current = makeFixtureState().snapshot;
    // Reject-on-mismatch stance (ADR-0025 / spec §1.4): a 1.0.0 build's save
    // (no start fields, no weather) must NOT continue silently. Load rejects
    // on the compatibility version. The envelope + rawHash are built over the
    // SAME 1.0.0 body so the only failing gate is the compatibility check —
    // proving the stable diagnostic fires rather than a generic corrupt path.
    const old: CampaignSnapshot = { ...current, compatibilityVersion: "1.0.0" };
    const envelope = createEnvelope("campaign-snapshot", "1.0.0", old);
    const state: CampaignState = {
      snapshot: old,
      envelope,
      rawHash: sha256Hex(canonicalSerialize({ snapshot: old, envelope })),
    };
    store.save(state, tmpDir);
    const diagnostics = new DiagnosticCollector();
    expect(store.load(tmpDir, diagnostics)).toBeNull();
    // Rejection must surface the stable diagnostic code (spec §1.4 / ADR-0025),
    // not merely fall through a generic corrupt-save path.
    expect(diagnostics.errors.some((d) => d.code === "PERSISTENCE_COMPATIBILITY_MISMATCH")).toBe(
      true,
    );
  });
});
