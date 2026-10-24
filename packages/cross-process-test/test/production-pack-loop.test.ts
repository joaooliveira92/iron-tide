import { describe, it, expect } from "vite-plus/test";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SafeInt } from "@bluewave/contracts";
import {
  battleOffersFromRulesets,
  buildContentBundleArtifact,
  buildFullSurfaceInput,
} from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { CampaignCompiler } from "@bluewave/campaign/compiler";
import type { CampaignState, CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { CommandEnvelope, BudgetProjectCommand } from "@bluewave/commands";
import { CURRENT_COMPATIBILITY_VERSION, SaveStore } from "@bluewave/persistence";
import { MonthExecutor, ReplayVerifier } from "@bluewave/phase-engine";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { Effect } from "effect";
import { FIXTURE_BATTLE_OFFER_RULES, FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { compileProductionCampaign } from "../src/production-pack.js";
import { tmpdir } from "node:os";

function snapshotToHashable(snapshot: CampaignSnapshot): unknown {
  const nations: Record<string, NationState> = {};
  for (const [id, nation] of snapshot.nations) {
    nations[id] = nation;
  }
  return {
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
    intelligence: {
      shells: { ...snapshot.intelligence.shells },
    },
    rulesetVersion: snapshot.rulesetVersion,
    compatibilityVersion: snapshot.compatibilityVersion,
  };
}

function hashSnapshot(snapshot: CampaignSnapshot): string {
  return sha256Hex(canonicalSerialize(snapshotToHashable(snapshot)));
}

const thisDir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(thisDir, "..", "..", "..");
const PRODUCTION_PACK = resolve(REPO_ROOT, "content", "production", "1880");

function compileProductionPack(): { state: CampaignState; contentHash: string } {
  const collector = new DiagnosticCollector();
  const signal = new AbortController().signal;
  const input = buildFullSurfaceInput(
    resolve(PRODUCTION_PACK, "pack.json"),
    PRODUCTION_PACK,
    collector,
  );
  const artifact = input ? buildContentBundleArtifact(input, signal, collector) : undefined;
  if (!artifact || collector.hasErrors) {
    throw new Error(
      `Production pack compilation failed: ${collector.all.map((d) => d.message).join("; ")}`,
    );
  }

  const output = new CampaignCompiler().compile(
    {
      contentBundle: artifact.bundle,
      contentHash: artifact.envelope.bodyHash,
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    },
    signal,
    collector,
  );

  if (!output || collector.hasErrors) {
    throw new Error(
      `Production pack compilation failed: ${collector.all.map((d) => d.message).join("; ")}`,
    );
  }
  return { state: output.state, contentHash: output.contentHash };
}

function makeBudgetCommand(
  snapshotHash: string,
  nationId: string,
  projectId: string,
  budget: SafeInt,
): CommandEnvelope<BudgetProjectCommand> {
  return {
    commandId: `cmd-${projectId}-${String(budget)}`,
    version: "0.1.0",
    expectedSnapshotHash: snapshotHash,
    idempotencyKey: `ik-${projectId}-${String(budget)}`,
    timestamp: "production-pack-loop-test",
    body: { type: "budget_project", nationId, projectId, budget },
  };
}

describe("production pack (content/production/1880) full loop", () => {
  it("compiles, advances a strategic month, saves, loads, and replays deterministically", () => {
    const { state: campaignState, contentHash: contentArtifactHash } = compileProductionPack();
    const snapshot = campaignState.snapshot;

    expect(contentArtifactHash).toBeDefined();
    expect(snapshot.nations.size).toBe(14);

    const executor = new MonthExecutor();
    const snapshotHash = sha256Hex(canonicalSerialize(snapshot));
    const cmd = makeBudgetCommand(snapshotHash, "uk", "con_gbr_inflexible", SafeInt(50));
    const collector = new DiagnosticCollector();
    const monthResult = executor.execute(snapshot, [cmd], "production-pack-loop-seed", collector);

    expect(monthResult.success).toBe(true);

    const saveDir = resolve(
      tmpdir(),
      `bw-prod-pack-save-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(saveDir, { recursive: true });

    try {
      const store = new SaveStore();
      const { rawHash: _rh, ...stateForSave } = campaignState;
      const saveableState: CampaignState = {
        ...campaignState,
        rawHash: sha256Hex(canonicalSerialize(stateForSave)),
      };
      store.save(saveableState, saveDir);

      const loaded = Effect.runSync(store.load(saveDir));

      expect(loaded.warnings).toEqual([]);
      expect(loaded.state.snapshot.nations.size).toBe(snapshot.nations.size);
      expect(loaded.state.snapshot.campaignId).toBe(snapshot.campaignId);

      const replayVerifier = new ReplayVerifier();
      const closingSnapshotHash = hashSnapshot(monthResult.finalSnapshot);
      const replayResult = replayVerifier.verify(
        snapshot,
        [cmd],
        monthResult.commandLedger,
        closingSnapshotHash,
        "production-pack-loop-seed",
        collector,
      );

      expect(replayResult.match).toBe(true);
    } finally {
      rmSync(saveDir, { recursive: true, force: true });
    }
  });
});

describe("P-1 AC-3: 1880 roster torpedo armament (docs/research/p1-1880-torpedo-armament.md)", () => {
  it("compiles the as-built tube counts and leaves unsourced/post-1880 fits unarmed", () => {
    const { state } = compileProductionPack();
    const tubes = (id: string): number =>
      (state.snapshot.designs.get(id)?.torpedoArmament ?? []).reduce(
        (n, m) => n + Number(m.tubeCount),
        0,
      );
    expect({
      des_gbr_inflexible: tubes("des_gbr_inflexible"),
      des_gbr_devastation: tubes("des_gbr_devastation"),
      des_fra_redoutable: tubes("des_fra_redoutable"),
      des_fra_amiral_duperre: tubes("des_fra_amiral_duperre"),
      des_rus_petrveliky: tubes("des_rus_petrveliky"),
      des_rus_ekaterina2: tubes("des_rus_ekaterina2"),
      des_ita_duilio: tubes("des_ita_duilio"),
      des_ita_italia: tubes("des_ita_italia"),
      des_chi_dingyuan: tubes("des_chi_dingyuan"),
    }).toEqual({
      des_gbr_inflexible: 4,
      des_gbr_devastation: 2,
      des_fra_redoutable: 4,
      des_fra_amiral_duperre: 4,
      des_rus_petrveliky: 2,
      des_rus_ekaterina2: 7,
      des_ita_duilio: 3,
      des_ita_italia: 4,
      des_chi_dingyuan: 3,
    });
    for (const unarmed of [
      "des_gbr_dreadnought75",
      "des_gbr_alexandra",
      "des_ger_kaiser",
      "des_ger_sachsen",
      "des_aut_tegetthoff",
      "des_usa_amphitrite",
      "des_jpn_fuso",
    ]) {
      expect(state.snapshot.designs.get(unarmed)?.torpedoArmament).toBeUndefined();
    }
  });
});

describe("P-1 AC-7: torpedoes reachable from a compiled production-pack battle", () => {
  it("an Italy vs Russia ironclad action built from compiled 1880 content fires torpedoes", async () => {
    const { resolve } = await import("@bluewave/combat");
    const { buildManifest } = await import("@bluewave/combat/generation");
    const { withStrategicWeatherStateHash } = await import("@bluewave/combat/weather");
    const { state } = compileProductionPack();
    const snap = state.snapshot;
    const nation = (id: string) => {
      const n = snap.nations.get(id)!;
      const ships = n.fleets.flatMap((f) => f.ships).filter((s) => !s.isUnderConstruction);
      return { nationId: id, ships, designs: snap.designs, divisions: [] };
    };
    const italy = nation("italy");
    const russia = nation("russia");
    expect(italy.ships.length).toBeGreaterThan(0);
    expect(russia.ships.length).toBeGreaterThan(0);
    const strip = (n: ReturnType<typeof nation>) => ({
      ...n,
      designs: new Map(
        [...n.designs].map(([k, d]) => {
          const { torpedoArmament: _t, ...rest } = d;
          return [k, rest];
        }),
      ),
    });
    const run = (
      attacker: ReturnType<typeof nation>,
      defender: ReturnType<typeof nation>,
      seed: string,
    ) => {
      const manifest = buildManifest({
        battleId: `p1-ac7-${seed}`,
        opportunityId: "opp-p1",
        warId: "war-p1",
        areaId: "med_central",
        missionType: "open_fleet_engagement",
        attackerId: "italy",
        defenderId: "russia",
        acceptanceClass: "accepted",
        missionObjectives: [],
        sides: [
          { sideId: "ATTACKER", participantIds: ["italy"] },
          { sideId: "DEFENDER", participantIds: ["russia"] },
        ],
        persistentAssets: [...attacker.ships, ...defender.ships].map((s) => s.id),
        temporaryAssets: [],
        permanentDivisionIds: [],
        tacticalDivisions: [],
        commanders: [],
        weather: "clear",
        seaState: "calm",
        visibility: "good",
        environment: "open_sea",
        sourceStateHashes: {},
        reservations: [],
        autoResolutionProof: "auto-resolvable",
        provenanceRecords: [],
        rulesetVersion: "b6_ruleset_v1",
        formulaVersion: "b6_formula_v1",
        aiPolicyVersion: "ai_policy_v1",
        rngVersion: "rng_v1",
        contentVersion: "0.4.0",
      });
      return resolve({
        battleId: manifest.battleId,
        areaId: "med_central",
        campaignMonth: "1880-06",
        manifest,
        attacker,
        defender,
        strategicWeather: withStrategicWeatherStateHash({
          areaId: "med_central",
          month: "1880-06",
          climateProfileId: "default",
          seasonId: "summer",
          persistentWeatherStateId: "",
          seaState: 2,
          windDirectionDeg: 225,
          windSpeedUmPerSec: 5_000_000,
          precipitationType: "NONE",
          precipitationIntensityBp: 0,
          fogMistDensityBp: 500,
          cloudCoverBp: 3_000,
          daylightProfileId: "default_daylight_v1",
          glareEligible: true,
          baseVisibilityUm: 20_000_000_000,
          generatedAtPhase: "weather_generation",
          rulesetVersion: "weather_ruleset_v1",
          climateVersion: "weather_climate_v1",
          formulaVersion: "weather_formula_v1",
          rngVersion: "weather_rng_v1",
        }),
        campaignSeed: seed,
        rulesetVersion: "b6_ruleset_v1",
        formulaVersion: "b6_formula_v1",
        rngVersion: "rng_v1",
      });
    };
    let fired = 0;
    let changed = 0;
    for (const seed of ["p1", "p2", "p3", "p4", "p5", "p6"]) {
      const armed = run(italy, russia, seed);
      const plain = run(strip(italy), strip(russia), seed);
      expect(plain.torpedoSummary).toBeUndefined();
      fired += armed.torpedoSummary!.tubesFired;
      if (armed.resultHash !== plain.resultHash) changed++;
    }
    expect(fired).toBeGreaterThan(0);
    expect(changed).toBeGreaterThan(0);
  });
});

describe("S-1 acceptance (ticket 09): readiness and maintenance on the production pack", () => {
  function s1Snapshot(): { snapshot: CampaignSnapshot; ids: string[] } {
    const snapshot = compileProductionPack().state.snapshot;
    const uk = snapshot.nations.get("uk")!;
    const four = uk.fleets
      .flatMap((f) => f.ships)
      .sort((a, b) => Number(b.hitPoints) - Number(a.hitPoints))
      .slice(0, 4);
    if (four.length < 4) throw new Error("production pack: UK has fewer than 4 ships");
    const ids = four.map((s) => s.id);
    const ships = four.map((s, i) => {
      if (i === 0) return { ...s, readiness: "WORKING_UP" as const, crewQuality: SafeInt(55) };
      if (i === 1) return { ...s, readiness: "RESERVE" as const, crewQuality: SafeInt(40) };
      if (i === 2) return { ...s, readiness: "MOTHBALLED" as const, crewQuality: SafeInt(0) };
      return { ...s, readiness: "REPAIR" as const, repairMonthsRemaining: SafeInt(2) };
    });
    const fleets = uk.fleets.map((f, fi) => (fi === 0 ? { ...f, ships } : { ...f, ships: [] }));
    const nations = new Map(snapshot.nations);
    nations.set("uk", { ...uk, fleets });
    return { snapshot: { ...snapshot, nations }, ids };
  }

  it("exercises promotion, reserve/mothball/repair maintenance, the repair countdown and wartime — deterministically", () => {
    const run = () =>
      new MonthExecutor().execute(
        s1Snapshot().snapshot,
        [],
        "s1-acceptance",
        new DiagnosticCollector(),
      );
    const { ids } = s1Snapshot();

    const peace1 = run();
    expect(peace1.success).toBe(true);
    const ships1 = peace1.finalSnapshot.nations.get("uk")!.fleets[0]!.ships;
    const byId = (id: string) => ships1.find((s) => s.id === id)!;

    expect(byId(ids[0]!).readiness).toBe("ACTIVE");
    expect(byId(ids[1]!).readiness).toBe("RESERVE");
    expect(byId(ids[2]!).readiness).toBe("MOTHBALLED");
    expect(byId(ids[3]!).readiness).toBe("REPAIR");
    expect(byId(ids[3]!).repairMonthsRemaining as number).toBe(1);
    expect(peace1.eventLedger.all.some((e) => e.body.kind === "ShipReadinessChanged")).toBe(true);

    const peace2 = new MonthExecutor().execute(
      peace1.finalSnapshot,
      [],
      "s1-acceptance",
      new DiagnosticCollector(),
    );
    const released = peace2.finalSnapshot.nations
      .get("uk")!
      .fleets[0]!.ships.find((s) => s.id === ids[3]!)!;
    expect(released.readiness).toBe("ACTIVE");
    expect(released.repairMonthsRemaining).toBeUndefined();

    const warWars = {
      ...peace1.finalSnapshot.wars,
      wars: [
        {
          id: "war_s1",
          attackerSideId: "side_a",
          defenderSideId: "side_d",
          attackerSideMembers: ["uk"],
          defenderSideMembers: ["qing"],
          attackerWarScore: 0,
          defenderWarScore: 0,
          attackerId: "uk",
          defenderId: "qing",
          startDate: "1880-01",
          status: "ACTIVE" as const,
        },
      ],
    };
    const peaceMonth2 = new MonthExecutor().execute(
      peace1.finalSnapshot,
      [],
      "s1-acceptance",
      new DiagnosticCollector(),
    );
    const warMonth2 = new MonthExecutor().execute(
      { ...peace1.finalSnapshot, wars: warWars },
      [],
      "s1-acceptance",
      new DiagnosticCollector(),
    );
    const peaceMaintenance = peaceMonth2.finalSnapshot.nations.get("uk")!.maintenanceCost as number;
    const warMaintenance = warMonth2.finalSnapshot.nations.get("uk")!.maintenanceCost as number;
    expect(warMaintenance).toBeGreaterThan(peaceMaintenance);

    expect(hashSnapshot(run().finalSnapshot)).toBe(hashSnapshot(run().finalSnapshot));
  });
});

describe("S-2 ticket 03: prestige on the production pack (ADR-0239)", () => {
  const EXPECTED_RULES = {
    lowerBound: SafeInt(0),
    upperBound: SafeInt(1000),
    sackingThreshold: SafeInt(16),
    sackingProbabilityBp: SafeInt(1000),
    rules: {
      UNPAID_FUNDS: { kind: "PROPORTIONAL_LOSS", basisPoints: SafeInt(300) },
      BATTLE_LOST: { kind: "PROPORTIONAL_LOSS", basisPoints: SafeInt(500) },
      BATTLE_WON: { kind: "FIXED_GAIN", amount: SafeInt(1) },
    },
  };

  it("carries the authorized start of 20 for all fourteen nations and keeps ten playable", () => {
    const { state } = compileProductionCampaign();
    const nations = [...state.snapshot.nations.values()];
    expect(nations).toHaveLength(14);
    for (const nation of nations) {
      expect(nation.prestige, nation.id).toBe(20);
    }
    expect(nations.filter((n) => n.isPlayable)).toHaveLength(10);
    expect(nations.filter((n) => !n.isPlayable)).toHaveLength(4);
  });

  it("runs on exactly the value set ADR-0239 authorizes", () => {
    const { state } = compileProductionCampaign();
    expect(state.snapshot.prestigeRules).toEqual(EXPECTED_RULES);
  });

  it("never reaches a fixture value: the production set differs from the fixture set in every field", () => {
    const { state } = compileProductionCampaign();
    const production = state.snapshot.prestigeRules;
    expect(production).not.toEqual(FIXTURE_PRESTIGE_RULES);
    expect(production.upperBound).not.toBe(FIXTURE_PRESTIGE_RULES.upperBound);
    expect(production.sackingThreshold).not.toBe(FIXTURE_PRESTIGE_RULES.sackingThreshold);
    expect(production.sackingProbabilityBp).not.toBe(FIXTURE_PRESTIGE_RULES.sackingProbabilityBp);
  });

  it("keeps every nation's start inside the bounds the ruleset declares", () => {
    const { state } = compileProductionCampaign();
    const { lowerBound, upperBound } = state.snapshot.prestigeRules;
    for (const nation of state.snapshot.nations.values()) {
      expect(nation.prestige).toBeGreaterThanOrEqual(lowerBound);
      expect(nation.prestige).toBeLessThanOrEqual(upperBound);
    }
  });

  it("round-trips prestige and the value set through a save and load, exactly", () => {
    const { state } = compileProductionCampaign();
    const dir = resolve(
      tmpdir(),
      `bw-s2-prestige-${String(process.pid)}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(dir, { recursive: true });
    try {
      const store = new SaveStore();
      const { rawHash: _rawHash, ...stateForSave } = state;
      store.save({ ...state, rawHash: sha256Hex(canonicalSerialize(stateForSave)) }, dir);
      const loaded = Effect.runSync(store.load(dir));
      expect(loaded.warnings.map((d) => `${d.code}: ${d.message}`)).toEqual([]);
      expect(loaded.state.snapshot.prestigeRules).toEqual(EXPECTED_RULES);
      for (const [id, nation] of state.snapshot.nations) {
        expect(loaded.state.snapshot.nations.get(id)?.prestige, id).toBe(nation.prestige);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("T-1 09 (#118): the battle-offer section is configured on the production pack (ADR-0254)", () => {
  const PRODUCTION_DIR = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../content/production/1880",
  );

  const ADR_0254_VALUES = {
    sectionVersion: 1,
    estimateModel: {
      kind: "PERTURBED",
      errorBoundBp: 2_000,
      rounding: "HALF_UP",
      showComposition: false,
    },
    declineVictoryPoints: {
      pointsByMission: { FLEET_BATTLE: 5, CRUISER_BATTLE: 2 },
      distanceModifier: { kind: "NONE" },
      rounding: "HALF_UP",
      opponentCredit: { kind: "NONE" },
    },
    declineCounter: { threshold: 3, scope: "WAR", reset: { kind: "ON_WAR_END" } },
    enemyDecline: { comparison: "LESS_THAN", thresholdBp: 5_000, probabilityBp: 5_000 },
    supportForce: { presenceChanceBp: 2_000, shareOfCapBp: 5_000, source: "ALLIED_ONLY" },
    declinedBattlePrestige: {
      rule: { kind: "PROPORTIONAL_LOSS", basisPoints: 300 },
      repeat: "EACH_FURTHER_DECLINE",
    },
  } as const;

  it("exposes the section on the compiled production campaign with every ADR-0254 value and balance-target provenance", () => {
    const { bundle } = compileProductionCampaign();
    const section = battleOffersFromRulesets(bundle.rulesets);
    expect(section).toBeDefined();
    const { provenance, ...values } = section!;
    expect(values).toEqual(ADR_0254_VALUES);
    expect(provenance).toMatchObject({
      sourceStatus: "BALANCE_TARGET",
      kind: "balance_adjustment",
    });
    expect(provenance.note).toContain("ADR-0254");
  });

  it("carries no fixture-class value: not the fixture section, no fixture label, and no field equal to a fixture field", () => {
    const { bundle } = compileProductionCampaign();
    const section = battleOffersFromRulesets(bundle.rulesets)!;
    expect(section).not.toEqual(FIXTURE_BATTLE_OFFER_RULES);
    expect(JSON.stringify(section).toLowerCase()).not.toContain("fixture");
    for (const key of [
      "estimateModel",
      "declineVictoryPoints",
      "declineCounter",
      "enemyDecline",
      "supportForce",
    ] as const) {
      expect(section[key], key).not.toEqual(FIXTURE_BATTLE_OFFER_RULES[key]);
    }
    const files = readdirSync(PRODUCTION_DIR, { recursive: true, encoding: "utf8" }).filter(
      (name) => /\.(ya?ml|json)$/.test(name),
    );
    for (const name of files) {
      expect(readFileSync(resolve(PRODUCTION_DIR, name), "utf8").toLowerCase(), name).not.toContain(
        "fixture-class",
      );
    }
  });

  it("supplying the player nation to a compiled production month changes no output byte", () => {
    const { state } = compileProductionCampaign();
    const run = (playerNationId?: string) =>
      new MonthExecutor().execute(
        state.snapshot,
        [],
        "t-1-02-seed",
        new DiagnosticCollector(),
        undefined,
        playerNationId === undefined ? undefined : { playerNationId },
      );
    const control = run();
    const withPlayer = run("uk");
    expect(withPlayer.success).toBe(control.success);
    expect(hashSnapshot(withPlayer.finalSnapshot)).toBe(hashSnapshot(control.finalSnapshot));
    expect(sha256Hex(canonicalSerialize(withPlayer.eventLedger))).toBe(
      sha256Hex(canonicalSerialize(control.eventLedger)),
    );
  });
});

describe("S-2 04 (#89): the unpaid-funds prestige source on the production pack (ADR-0239)", () => {
  function shortfallSnapshot(shortNationIds: readonly string[]): CampaignSnapshot {
    const { state } = compileProductionCampaign();
    const nations = new Map(state.snapshot.nations);
    for (const id of shortNationIds) {
      const nation = nations.get(id)!;
      nations.set(id, {
        ...nation,
        treasury: SafeInt(0),
        income: SafeInt(0),
        expenses: SafeInt(1_000),
        baseResources: SafeInt(0),
      });
    }
    return { ...state.snapshot, nations };
  }
  const run = (snapshot: CampaignSnapshot, playerNationId?: string) =>
    new MonthExecutor().execute(
      snapshot,
      [],
      "s-2-04-seed",
      new DiagnosticCollector(),
      undefined,
      playerNationId === undefined ? undefined : { playerNationId },
    );
  const prestigeEvents = (result: ReturnType<typeof run>) =>
    result.eventLedger.all.filter((e) => e.body.kind === "PrestigeChanged");

  it("lowers the player's prestige by the authorized rate in the shortfall month and records the event", () => {
    const snapshot = shortfallSnapshot(["uk"]);
    const before = snapshot.nations.get("uk")!.prestige as number;
    const result = run(snapshot, "uk");
    const after = Math.max(
      Number(snapshot.prestigeRules.lowerBound),
      before - Math.ceil((before * 300) / 10_000),
    );
    expect(after).toBeLessThan(before);
    expect(result.finalSnapshot.nations.get("uk")!.prestige).toBe(after);
    const events = prestigeEvents(result);
    expect(events).toHaveLength(1);
    expect(events[0]!.body).toEqual({
      kind: "PrestigeChanged",
      nationId: "uk",
      reasonCode: "UNPAID_FUNDS",
      ruleKind: "PROPORTIONAL_LOSS",
      before,
      after,
      delta: after - before,
      rulesetVersion: snapshot.rulesetVersion,
    });
  });

  it("changes nothing and emits no event for a shortfall in an AI-only nation or with no shortfall", () => {
    const aiOnly = [...compileProductionCampaign().state.snapshot.nations.values()].find(
      (n) => n.isAI && !n.isPlayable,
    )!;
    const aiShort = run(shortfallSnapshot([aiOnly.id]), "uk");
    expect(aiShort.finalSnapshot.nations.get(aiOnly.id)!.prestige).toBe(aiOnly.prestige);
    expect(prestigeEvents(aiShort)).toHaveLength(0);

    const plain = compileProductionCampaign().state.snapshot;
    const quiet = run(plain, "uk");
    expect(prestigeEvents(quiet)).toHaveLength(0);
    expect(hashSnapshot(quiet.finalSnapshot)).toBe(hashSnapshot(run(plain).finalSnapshot));
  });

  it("is byte-identical across two runs of the scripted month", () => {
    const snapshot = shortfallSnapshot(["uk"]);
    const a = run(snapshot, "uk");
    const b = run(snapshot, "uk");
    expect(hashSnapshot(a.finalSnapshot)).toBe(hashSnapshot(b.finalSnapshot));
    expect(sha256Hex(canonicalSerialize(a.eventLedger))).toBe(
      sha256Hex(canonicalSerialize(b.eventLedger)),
    );
  });
});
