// packages/combat/test/air-defense/integration.test.ts
// D-4 / INC-6 — AC-18: resolveAirDefense stage at step 7.8, strict no-op.
// AC-20: BattleResolver/StrengthCalculator unmodified.
import { describe, it, expect } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SafeInt } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import { BattleResolver } from "../../src/resolver.js";
import { StrengthCalculator } from "../../src/strength.js";
import { advanceMinutes } from "../../src/simulation/engine.js";
import type { TacticalBattleState } from "../../src/tactical/index.js";
import {
  AttackType,
  Category,
  Layer,
  computeAirDefenseStateHash,
  createAirDefenseAttack,
  createAirDefenseSystemDefinition,
  resolveAirDefense,
  verifyAirDefenseEngagementRecordHash,
  type AirDefenseContext,
  type AirDefenseState,
} from "../../src/air-defense/index.js";
import * as combatRoot from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function battleState(): TacticalBattleState {
  return {
    battleId: "battle-ad-1",
    mapId: "eng_ch",
    sides: [{ sideId: "DEFENDER", participantIds: ["ship_001"] }],
    forces: { DEFENDER: ["ship_001"] },
    divisions: [],
    units: [],
    contacts: [],
    objectives: [],
    weather: { weather: "clear", seaState: "calm", visibilityNm: 20, daylight: true },
    exitZones: [],
    battleEventLedger: [],
  };
}

function heavySystem() {
  return createAirDefenseSystemDefinition({
    systemId: "sys_heavy_01",
    layer: Layer.HEAVY_AA,
    category: Category.HEAVY_AA,
    baseKillBp: SafeInt(2_000),
    baseDamageBp: SafeInt(2_000),
    baseAbortBp: SafeInt(2_000),
    baseDisruptionBp: SafeInt(2_000),
    roundsPerEngagement: SafeInt(5),
    profileEligibility: new Set(["AIRCRAFT_LEVEL_BOMBING"]),
    engagementChannels: new Set(["ch001"]),
  });
}

function defenderState(rounds: number): AirDefenseState {
  const system = heavySystem();
  const state: AirDefenseState = {
    defenderId: "ship_001",
    scope: "SHIP",
    systems: [system],
    directorState: {
      channelId: "dir_01",
      assignedLayer: Layer.HEAVY_AA,
      directorIndex: SafeInt(0),
      scalingBp: SafeInt(10_000),
    },
    radarState: {
      channelId: "radar_01",
      assignedLayer: Layer.HEAVY_AA,
      saturationGroup: SafeInt(0),
      diminishingReturnsBp: SafeInt(10_000),
    },
    crewQuality: SafeInt(10_000),
    damageBp: SafeInt.ZERO,
    powerBp: SafeInt(10_000),
    ammunitionByType: new Map([[system.systemId, SafeInt(rounds)]]),
    targetAllocations: new Map<string, string>(),
    channelReservations: new Map<string, string>(),
    disruptionRecords: [],
    stateHash: "",
  };
  state.stateHash = computeAirDefenseStateHash(state);
  return state;
}

function levelBomberAttack() {
  return createAirDefenseAttack({
    attackId: "atk_001",
    formationId: "frm_001",
    targetId: "ship_001",
    attackType: AttackType.AIRCRAFT_LEVEL_BOMBING,
    speedKnots: SafeInt(150),
    speedMps: SafeInt(77),
    currentRangeM: SafeInt(5_000),
    currentAltitudeM: SafeInt(3_000),
    bearingDegrees: SafeInt(0),
    releaseRangeM: SafeInt(5_000),
    releaseAltitudeM: SafeInt(2_000),
    isReleased: false,
    fireControlSolutionBp: SafeInt(10_000),
    timeToImpactMs: SafeInt(30_000),
    formationSize: SafeInt(4),
    cohesionBp: SafeInt(10_000),
    defensiveSusceptibilityBp: SafeInt(10_000),
  });
}

function context(rounds = 100, seed = "ad-seed"): AirDefenseContext {
  return {
    defenders: [
      {
        state: defenderState(rounds),
        operability: {
          defenderSunk: false,
          defenderAbandoned: false,
          systemPowered: true,
          systemOperational: true,
        },
        directorAvailable: true,
        radarAvailable: true,
      },
    ],
    attacks: [levelBomberAttack()],
    engine: new RandomEngine(seed),
  };
}

function run(airDefense?: AirDefenseContext, minutes = 3) {
  return advanceMinutes({
    state: battleState(),
    minutes,
    observationTime: "1940-06-01T12:00:00.000Z",
    ...(airDefense ? { airDefense } : {}),
  });
}

describe("AC-18 resolveAirDefense stage (step 7.8)", () => {
  it("strict no-op: absent context leaves minute hashes byte-identical", () => {
    const baseline = run();
    const again = run();
    expect(again.hashes).toEqual(baseline.hashes);
    for (const r of baseline.results) {
      expect(r.airDefenseRecords).toBeUndefined();
      expect(r.airDefenseStates).toBeUndefined();
    }
  });

  it("strict no-op: context with no attacks or no defenders matches the baseline", () => {
    const baseline = run();
    const noAttacks = run({ ...context(), attacks: [] });
    const noDefenders = run({ ...context(), defenders: [] });
    expect(noAttacks.hashes).toEqual(baseline.hashes);
    expect(noDefenders.hashes).toEqual(baseline.hashes);
    expect(resolveAirDefense({ ...context(), attacks: [] }, "b", 1).active).toBe(false);
  });

  it("resolves engagements, emits hash-valid records, and changes the minute hash", () => {
    const baseline = run();
    const withAd = run(context());
    const records = withAd.results[0]!.airDefenseRecords!;
    expect(records.length).toBeGreaterThan(0);
    expect(records.every(verifyAirDefenseEngagementRecordHash)).toBe(true);
    expect(records[0]!.layer).toBe("HEAVY_AA");
    expect(records[0]!.roundsConsumed).toBe(5);
    expect(withAd.hashes[0]).not.toBe(baseline.hashes[0]);
  });

  it("threads ammunition across minutes until the system is empty", () => {
    // 10 rounds, 5 per engagement → two engagements, then zero contribution.
    const res = run(context(10), 3);
    const consumed = res.results.map((r) =>
      (r.airDefenseRecords ?? []).reduce((sum, rec) => sum + Number(rec.roundsConsumed), 0),
    );
    expect(consumed[0]).toBe(5);
    expect(consumed[1]).toBe(5);
    expect(consumed[2]).toBe(0);
    expect(
      Number(res.results[1]!.airDefenseStates!["ship_001"]!.ammunitionByType.get("sys_heavy_01")),
    ).toBe(0);
  });

  it("is deterministic for the same seed and seed-sensitive in its draws", () => {
    const a = run(context(100, "seed-a"));
    const b = run(context(100, "seed-a"));
    expect(a.hashes).toEqual(b.hashes);
    const drawsA = a.results.flatMap((r) => (r.airDefenseRecords ?? []).map((x) => x.draw));
    const drawsC = run(context(100, "seed-c")).results.flatMap((r) =>
      (r.airDefenseRecords ?? []).map((x) => x.draw),
    );
    expect(drawsA).not.toEqual(drawsC);
  });

  it("is reachable from the @bluewave/combat package root", () => {
    expect(typeof combatRoot.resolveAirDefense).toBe("function");
    expect(typeof combatRoot.compareStrings).toBe("function");
    expect(typeof combatRoot.damageMultiplierBp).toBe("function");
  });
});

describe("AC-20 integration boundary", () => {
  it("does not modify BattleResolver", () => {
    expect(typeof BattleResolver).toBe("function");
    const src = readFileSync(resolve(__dirname, "../../src/resolver.ts"), "utf-8");
    expect(src).not.toContain("airDefense");
    expect(src).not.toContain("resolveAirDefense");
  });

  it("does not modify StrengthCalculator", () => {
    expect(typeof StrengthCalculator).toBe("function");
    const src = readFileSync(resolve(__dirname, "../../src/strength.ts"), "utf-8");
    expect(src).not.toContain("airDefense");
    expect(src).not.toContain("resolveAirDefense");
  });

  it("air-defense module has no phase-engine dependency", () => {
    const dir = resolve(__dirname, "../../src/air-defense");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      const content = readFileSync(resolve(dir, file), "utf-8");
      expect(content).not.toContain("phase-engine");
    }
  });
});
