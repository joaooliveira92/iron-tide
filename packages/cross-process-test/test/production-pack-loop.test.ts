import { describe, it, expect } from "vite-plus/test";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SafeInt } from "@bluewave/contracts";
import { buildContentBundleArtifact, buildFullSurfaceInput } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { CampaignCompiler } from "@bluewave/campaign/compiler";
import type { CampaignState, CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { CommandEnvelope, BudgetProjectCommand } from "@bluewave/commands";
import { CURRENT_COMPATIBILITY_VERSION, SaveStore } from "@bluewave/persistence";
import { MonthExecutor, ReplayVerifier } from "@bluewave/phase-engine";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { compileProductionCampaign } from "../src/production-pack.js";
import { tmpdir } from "node:os";

// Ticket 05 (.scratch/desktop-mvp/issues/05-verify-full-loop-against-production-pack.md):
// no existing test compiled content/production/1880 and then advanced a
// strategic month / saved / loaded it -- packages/cross-process-test/src/run-child.ts
// exercises exactly that loop (compile -> MonthExecutor -> SaveStore ->
// replay) but only against a synthetic inline 2-nation fixture. This test
// runs the same loop directly against the canonical production pack.

// Mirrors ReplayVerifier's internal `snapshotToHashable`/`hashSnapshot`
// (packages/phase-engine/src/replay.ts, not exported) and run-child.ts's own
// copy of the same shape: ReplayVerifier.verify() compares its replayed
// snapshot hash against this exact subset-hash, not a full canonicalSerialize
// of the raw snapshot.
function snapshotToHashable(snapshot: CampaignSnapshot): unknown {
  const nations: Record<string, NationState> = {};
  for (const [id, nation] of snapshot.nations) {
    nations[id] = nation;
  }
  return {
    version: snapshot.version,
    turnNumber: snapshot.turnNumber,
    campaignId: snapshot.campaignId,
    // B-6/ADR-0025: start date + current-month per-area weather are part of the
    // authoritative snapshot surface (hash parity with ReplayVerifier).
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
    // Step 1: compile the canonical production pack (not a synthetic fixture).
    const { state: campaignState, contentHash: contentArtifactHash } = compileProductionPack();
    const snapshot = campaignState.snapshot;

    expect(contentArtifactHash).toBeDefined();
    expect(snapshot.nations.size).toBe(14);

    // Step 2: advance one strategic month, issuing a real command against a
    // real in-progress construction project authored in the pack
    // (con_gbr_inflexible, nationId uk; content/production/1880/constructions.yaml).
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

      const loadDiag = new DiagnosticCollector();
      const loaded = store.load(saveDir, loadDiag);

      expect(loadDiag.hasErrors).toBe(false);
      expect(loaded).not.toBeNull();
      if (loaded) {
        expect(loaded.snapshot.nations.size).toBe(snapshot.nations.size);
        expect(loaded.snapshot.campaignId).toBe(snapshot.campaignId);
      }

      // Step 5: replay the same command against the pre-month snapshot and
      // confirm it reproduces the same closing state deterministically.
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
    const { buildManifest, resolveBattleAuto, withStrategicWeatherStateHash } =
      await import("@bluewave/combat");
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
      return resolveBattleAuto({
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
  // Build a scripted copy of the compiled production snapshot: four UK ships
  // take one readiness state each, so every S-1 mechanic is observed at least
  // once in a real production-pack month run.
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

    // Month 1: the working-up ship (crew 55 -> 60) is promoted to active.
    expect(byId(ids[0]!).readiness).toBe("ACTIVE");
    // Reserve crew ramps toward its ceiling; mothballed is laid up.
    expect(byId(ids[1]!).readiness).toBe("RESERVE");
    expect(byId(ids[2]!).readiness).toBe("MOTHBALLED");
    // The repairing ship counts down one month (2 -> 1) and stays in repair.
    expect(byId(ids[3]!).readiness).toBe("REPAIR");
    expect(byId(ids[3]!).repairMonthsRemaining as number).toBe(1);
    // A readiness transition is recorded as a domain event.
    expect(peace1.eventLedger.all.some((e) => e.body.kind === "ShipReadinessChanged")).toBe(true);

    // Month 2: the repair countdown reaches zero and releases the ship to active.
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

    // Wartime raises the nation's maintenance above peace for the same fleet.
    // Compare a month run with and without a live war (a distant opponent, so no
    // battle disturbs the maintenance snapshot); the month-1 promotion leaves an
    // active ship for the multiplier to apply to.
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

    // Deterministic: identical inputs produce byte-identical closing snapshots.
    expect(hashSnapshot(run().finalSnapshot)).toBe(hashSnapshot(run().finalSnapshot));
  });
});

// S-2 ticket 03 (spec #74 R3): prestige on the production pack. Every value here traces to
// ADR-0239 (decision request 0012, Option B); a fixture number must never be reachable.
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
      // As the full-loop test above does: a raw compile output carries its compile-time rawHash, so
      // the saved state is given the hash the store verifies.
      const { rawHash: _rawHash, ...stateForSave } = state;
      store.save({ ...state, rawHash: sha256Hex(canonicalSerialize(stateForSave)) }, dir);
      const diagnostics = new DiagnosticCollector();
      const loaded = store.load(dir, diagnostics);
      expect(diagnostics.errors.map((d) => `${d.code}: ${d.message}`)).toEqual([]);
      expect(loaded?.snapshot.prestigeRules).toEqual(EXPECTED_RULES);
      for (const [id, nation] of state.snapshot.nations) {
        expect(loaded?.snapshot.nations.get(id)?.prestige, id).toBe(nation.prestige);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("T-1 02 (#111): the battle-offer section is dormant on the production pack", () => {
  const PRODUCTION_DIR = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../content/production/1880",
  );

  it("authors no battleOffers section anywhere in the production pack", () => {
    const files = readdirSync(PRODUCTION_DIR, { recursive: true, encoding: "utf8" }).filter(
      (name) => /\.(ya?ml|json)$/.test(name),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      expect(readFileSync(resolve(PRODUCTION_DIR, name), "utf8"), name).not.toContain(
        "battleOffers",
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
