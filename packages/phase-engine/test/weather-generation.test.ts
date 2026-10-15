// B-6/ADR-0025 (DESIGN-42 §1): the weather_generation phase (registry order
// 0.5) runs RIGHT AFTER opening_validation — per-area current-month
// StrategicWeatherState from the canonical default climate profile
// (keyed stream campaign/weather/<areaId>/<month>) committed into the snapshot
// BEFORE command_collection. Proves: committed per-area mesh, canonical
// ordering, campaign-month ids, randomLedger recording, missing-profile
// WEATHER_PROFILE_INCOMPLETE (fail-closed), determinism, prior-state linkage,
// battle_generation being unaffected (no battles in a no-war month), and
// replay reproduction of the identical strategicWeather on the closed snapshot.

import type { CampaignSnapshot, CampaignWeatherState, NationState } from "@bluewave/campaign";
import type { ClimateProfile } from "@bluewave/combat";
import {
  defaultClimateProfile_v1,
  WEATHER_GENERATION_PHASE,
  WEATHER_PROFILE_INCOMPLETE,
} from "@bluewave/combat";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, ReplayVerifier } from "../src/index.js";

function makeNation(id: string, treasury = 500): NationState {
  return {
    id,
    name: id,
    tag: id,
    treasury: SafeInt(treasury),
    income: SafeInt(150),
    expenses: SafeInt(50),
    baseResources: SafeInt(120000),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: id,
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

function makeSnapshot(
  areaIds: string[],
  overrides: Partial<CampaignSnapshot> = {},
): CampaignSnapshot {
  const nations = new Map<string, NationState>();
  nations.set("GBR", makeNation("GBR"));
  return {
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "weather-phase-test",
    startYear: 1880,
    startMonth: 1,
    slots: [{ nationId: "GBR", type: "playable" }],
    world: {
      areas: areaIds.map((id) => ({ id, name: id, type: "sea" })),
      routes: [],
      ports: [],
    },
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
    strategicWeather: [],
    rulesetVersion: "0.1.0",
    compatibilityVersion: "1.2.0",
    ...overrides,
  };
}

function stateIds(states: CampaignWeatherState[]): string[] {
  return [...states].map((s) => s.areaId);
}

describe("weather_generation phase (B-6 INC-1)", () => {
  it("commits one StrategicWeatherState per world area, ordered by areaId, for the current campaign month", () => {
    const snapshot = makeSnapshot(["zeta", "alpha", "mid"]);
    const result = new MonthExecutor().execute(snapshot, [], "seed-1", new DiagnosticCollector());

    expect(result.success).toBe(true);
    const weather = result.finalSnapshot.strategicWeather;
    expect(weather.length).toBe(3);
    expect(stateIds(weather)).toEqual(["alpha", "mid", "zeta"]);
    for (const state of weather) {
      // start 1880-01 + turn 1 -> 1880-02 (DESIGN-03 §2 / ADR-0025)
      expect(state.month).toBe("1880-02");
      expect(state.generatedAtPhase).toBe(WEATHER_GENERATION_PHASE);
      expect(state.stateHash).toMatch(/^[0-9a-f]{64}$/);
      expect(state.climateProfileId).toBe("default");
    }
  });

  it("records every keyed decision into the randomLedger (port pattern, rngAllowed)", () => {
    const result = new MonthExecutor().execute(
      makeSnapshot(["alpha", "zeta"]),
      [],
      "seed-1",
      new DiagnosticCollector(),
    );
    const decisions = [...result.randomLedger.all];
    expect(decisions.length).toBe(2 * 8); // 8 drawn fields per area
    for (const d of decisions) {
      expect(d.streamId.startsWith("campaign/weather/")).toBe(true);
      expect(d.streamId.endsWith("/1880-02")).toBe(true);
      expect(d.phase).toBe(WEATHER_GENERATION_PHASE);
    }
  });

  it("same seed + snapshot produce byte-identical closing snapshots (deterministic)", () => {
    const run = () =>
      new MonthExecutor().execute(
        makeSnapshot(["alpha", "beta"]),
        [],
        "det-seed",
        new DiagnosticCollector(),
      );
    const a = run();
    const b = run();
    expect(a.finalSnapshot.strategicWeather).toEqual(b.finalSnapshot.strategicWeather);
    expect(sha256Hex(canonicalSerialize(a.finalSnapshot))).toBe(
      sha256Hex(canonicalSerialize(b.finalSnapshot)),
    );
    expect(a.randomLedger.hash()).toBe(b.randomLedger.hash());
  });

  it("links the prior month's committed state via persistentWeatherStateId", () => {
    const input = makeSnapshot(["alpha"]);
    const first = new MonthExecutor().execute(input, [], "seed-1", new DiagnosticCollector());
    expect(first.finalSnapshot.strategicWeather[0]!.persistentWeatherStateId).toBe("");

    // A second month execution against the first month's closing snapshot
    // links the prior committed state hash (no prior for the first month).
    const second = new MonthExecutor().execute(
      first.finalSnapshot,
      [],
      "seed-1",
      new DiagnosticCollector(),
    );
    expect(second.finalSnapshot.strategicWeather[0]!.persistentWeatherStateId).toBe(
      first.finalSnapshot.strategicWeather[0]!.stateHash,
    );
  });

  it("a missing area climate profile fails closed with WEATHER_PROFILE_INCOMPLETE (never crashes, never silent)", () => {
    // Explicit per-area profile map covering only beta + gamma: alpha is
    // missing -> stable diagnostic, NO committed state for alpha, and the
    // month reports failure (fail-closed). Deterministic order: alpha (missing)
    // diagnostic first, sorted before the generated areas.
    const profiles = new Map<string, ClimateProfile>();
    profiles.set("beta", defaultClimateProfile_v1);
    profiles.set("gamma", defaultClimateProfile_v1);
    const snapshot = makeSnapshot(["alpha", "beta", "gamma"]);
    const collector = new DiagnosticCollector();
    const result = new MonthExecutor().execute(snapshot, [], "seed", collector, {
      climateProfiles: profiles,
    });

    expect(stateIds(result.finalSnapshot.strategicWeather)).toEqual(["beta", "gamma"]);
    expect(collector.errors.some((d) => d.code === WEATHER_PROFILE_INCOMPLETE)).toBe(true);
    const missing = collector.errors.find((d) => d.code === WEATHER_PROFILE_INCOMPLETE)!;
    expect(missing.stage).toBe("weather_generation");
    expect(missing.entityId).toBe("alpha");
    // Fail-closed: the month result reports failure, not silent success.
    expect(result.success).toBe(false);
  });

  it("cloneSnapshot preserves a committed weather collection and start date", () => {
    const input = makeSnapshot(["alpha"]);
    const first = new MonthExecutor().execute(input, [], "seed-1", new DiagnosticCollector());
    const second = new MonthExecutor().execute(
      first.finalSnapshot,
      [],
      "seed-2",
      new DiagnosticCollector(),
    );
    // The second execution's closing snapshot still carries the committed
    // state (deep-cloned, not shared) for the same area.
    expect(second.finalSnapshot.strategicWeather.map((s) => s.areaId)).toEqual(["alpha"]);
    expect(second.finalSnapshot.startYear).toBe(1880);
    expect(second.finalSnapshot.startMonth).toBe(1);
  });

  it("no-war month: battle_generation is unaffected (no battles, no manifests)", () => {
    const result = new MonthExecutor().execute(
      makeSnapshot(["alpha"]),
      [],
      "seed",
      new DiagnosticCollector(),
    );
    expect(result.finalSnapshot.wars.battles).toEqual([]);
    expect(result.finalSnapshot.wars.battleManifests ?? []).toEqual([]);
    expect(result.finalSnapshot.strategicWeather.length).toBe(1);
  });

  it("replay reproduces the identical strategicWeather on the closed snapshot", () => {
    const snapshot = makeSnapshot(["alpha", "beta"]);
    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();
    const monthResult = executor.execute(snapshot, [], "replay-seed", collector);
    const closingHash = hashSnapshot(monthResult.finalSnapshot);

    const replay = new ReplayVerifier().verify(
      snapshot,
      [],
      monthResult.commandLedger,
      closingHash,
      "replay-seed",
      new DiagnosticCollector(),
    );
    expect(replay.match).toBe(true);
    expect(replay.finalSnapshot.strategicWeather).toEqual(
      monthResult.finalSnapshot.strategicWeather,
    );
  });
});

// Deterministic subset hash over the authoritative snapshot surface
// (parity with run-child / ReplayVerifier).
function hashSnapshot(snapshot: CampaignSnapshot): string {
  const nations: Record<string, NationState> = {};
  for (const [id, nation] of snapshot.nations) nations[id] = nation;
  return sha256Hex(
    canonicalSerialize({
      version: snapshot.version,
      turnNumber: snapshot.turnNumber,
      campaignId: snapshot.campaignId,
      startYear: snapshot.startYear,
      startMonth: snapshot.startMonth,
      strategicWeather: (snapshot.strategicWeather ?? []).map((s) => ({ ...s })),
      slots: snapshot.slots.map((s) => ({ ...s })),
      world: {
        areas: snapshot.world.areas.map((a) => ({ ...a })),
        routes: snapshot.world.routes.map((r) => ({ ...r })),
        ports: snapshot.world.ports.map((p) => ({ ...p })),
      },
      nations,
      wars: {
        wars: snapshot.wars.wars.map((w) => ({ ...w })),
        battles: snapshot.wars.battles.map((b) => ({ ...b })),
        participantMemberships: snapshot.wars.participantMemberships.map((m) => ({ ...m })),
        blockadeState: snapshot.wars.blockadeState.map((b) => ({ ...b })),
        battleManifests: (snapshot.wars.battleManifests ?? []).map((m) => ({ ...m })),
      },
      politics: {
        relations: snapshot.politics.relations.map((r) => ({ ...r })),
        shells: { ...snapshot.politics.shells },
      },
      intelligence: { shells: { ...snapshot.intelligence.shells } },
      rulesetVersion: snapshot.rulesetVersion,
      compatibilityVersion: snapshot.compatibilityVersion,
    }),
  );
}
