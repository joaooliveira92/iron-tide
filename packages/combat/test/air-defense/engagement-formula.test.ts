import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, SafeInt, isBluewaveError } from "@bluewave/contracts";
import { RandomEngine, RandomStream } from "@bluewave/random";
import {
  AirDefenseAttack,
  AirDefenseState,
  AttackType,
  Category,
  ENGAGEMENT_FORMULA_DENOMINATOR,
  EngagementMultipliers,
  Layer,
  MAX_ENGAGEMENT_FACTOR_BP,
  airDefenseEngagementStreamId,
  computeAirDefenseStateHash,
  computeEffectiveDefenseBp,
  createAirDefenseAttack,
  createAirDefenseSystemDefinition,
  drawAirDefenseOutcome,
  INVALID_AIR_DEFENSE_STATE,
  resolveEngagement,
  resolveEngagementOutcome,
} from "../../src/air-defense/index.js";

function neutralMultipliers(): EngagementMultipliers {
  return {
    directorBp: SafeInt(10_000),
    radarBp: SafeInt(10_000),
    crewBp: SafeInt(10_000),
    damageBp: SafeInt(10_000),
    ammunitionBp: SafeInt(10_000),
    targetProfileBp: SafeInt(10_000),
    weatherBp: SafeInt(10_000),
    saturationBp: SafeInt(10_000),
  };
}

class FixedStreamEngine extends RandomEngine {
  constructor(private readonly value: number) {
    super("fake-master");
  }
  override stream(_domain: string): RandomStream {
    return { id: "fake", next: () => this.value };
  }
}

function makeSystem(overrides: Record<string, unknown> = {}) {
  return createAirDefenseSystemDefinition({
    systemId: "sys_001",
    layer: Layer.HEAVY_AA,
    category: Category.HEAVY_AA,
    baseKillBp: SafeInt(100),
    baseDamageBp: SafeInt(50),
    baseAbortBp: SafeInt(30),
    baseDisruptionBp: SafeInt(15),
    roundsPerEngagement: SafeInt(5),
    profileEligibility: new Set(["AIRCRAFT_LEVEL_BOMBING"]),
    engagementChannels: new Set(["ch001"]),
    ...overrides,
  });
}

function makeState(
  system: ReturnType<typeof makeSystem>,
  ammo: ReadonlyArray<readonly [string, SafeInt]> = [],
  overrides: Partial<AirDefenseState> = {},
): AirDefenseState {
  const state: AirDefenseState = {
    defenderId: "ship_001",
    scope: "SHIP",
    systems: [system],
    directorState: {
      channelId: "ch001",
      assignedLayer: Layer.HEAVY_AA,
      directorIndex: SafeInt(0),
      scalingBp: SafeInt(10_000),
    },
    radarState: {
      channelId: "radar01",
      assignedLayer: Layer.HEAVY_AA,
      saturationGroup: SafeInt(0),
      diminishingReturnsBp: SafeInt(10_000),
    },
    crewQuality: SafeInt(10_000),
    damageBp: SafeInt.ZERO,
    powerBp: SafeInt(10_000),
    ammunitionByType: new Map(ammo),
    targetAllocations: new Map<string, string>(),
    channelReservations: new Map<string, string>(),
    disruptionRecords: [],
    stateHash: "",
    ...overrides,
  };
  state.stateHash = computeAirDefenseStateHash(state);
  return state;
}

function makeAttack(): AirDefenseAttack {
  return createAirDefenseAttack({
    attackId: "atk_001",
    formationId: "frm_001",
    targetId: "ship_001",
    attackType: AttackType.AIRCRAFT_LEVEL_BOMBING,
    speedKnots: SafeInt(150),
    speedMps: SafeInt(77),
    currentRangeM: SafeInt(10_000),
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

const IDENTITY = {
  defenderId: "ship_001",
  systemId: "sys_001",
  attackId: "atk_001",
  minute: SafeInt(5),
  substep: SafeInt(2),
};

describe("AC-11: engagement formula (§19)", () => {
  it("returns the base value unchanged when every multiplier is neutral 10_000", () => {
    expect(computeEffectiveDefenseBp(SafeInt(100), neutralMultipliers())).toBe(100);
    expect(computeEffectiveDefenseBp(SafeInt(0), neutralMultipliers())).toBe(0);
  });

  it("a single 2_500 factor quarters the effective value", () => {
    const m = { ...neutralMultipliers(), directorBp: SafeInt(2_500) };
    expect(computeEffectiveDefenseBp(SafeInt(100), m)).toBe(25);
  });

  it("mixed factors produce the exact floored rational (one FLOOR)", () => {
    const m = {
      ...neutralMultipliers(),
      directorBp: SafeInt(2_500),
      radarBp: SafeInt(7_500),
    };
    expect(computeEffectiveDefenseBp(SafeInt(101), m)).toBe(18);
  });

  it("the bigint path produces the exact floored result for a sub-safe numerator case", () => {
    const m = {
      directorBp: SafeInt(9_999),
      radarBp: SafeInt(9_999),
      crewBp: SafeInt(9_999),
      damageBp: SafeInt(9_999),
      ammunitionBp: SafeInt(9_999),
      targetProfileBp: SafeInt(9_999),
      weatherBp: SafeInt(9_999),
      saturationBp: SafeInt(9_999),
    };
    const expected = Number(9_999n ** 9n / 10_000n ** 8n);
    expect(computeEffectiveDefenseBp(SafeInt(9_999), m)).toBe(expected);
  });

  it("documents the bound analysis: the raw numerator exceeds MAX_SAFE_INTEGER", () => {
    expect(ENGAGEMENT_FORMULA_DENOMINATOR).toBe(10_000n ** 8n);
    const maxNumerator = 31_000n * 10_000n ** 8n;
    expect(maxNumerator > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it("a zero multiplier zeroes the effective value", () => {
    const m = { ...neutralMultipliers(), ammunitionBp: SafeInt.ZERO };
    expect(computeEffectiveDefenseBp(SafeInt(100), m)).toBe(0);
  });

  it("rejects non-safe-integer factors at the boundary (fail-closed)", () => {
    let caught: unknown;
    try {
      computeEffectiveDefenseBp((Number.MAX_SAFE_INTEGER + 1) as SafeInt, neutralMultipliers());
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_STATE);
  });

  it("rejects fractional factors at the boundary", () => {
    expect(() =>
      computeEffectiveDefenseBp(SafeInt(100), {
        ...neutralMultipliers(),
        directorBp: 2_500.5 as SafeInt,
      }),
    ).toThrow();
  });

  it("rejects negative factors at the boundary", () => {
    expect(() =>
      computeEffectiveDefenseBp(SafeInt(100), {
        ...neutralMultipliers(),
        directorBp: -2_500 as SafeInt,
      }),
    ).toThrow();
  });

  it("accepts a factor of exactly MAX_ENGAGEMENT_FACTOR_BP (31_000, §12)", () => {
    expect(MAX_ENGAGEMENT_FACTOR_BP).toBe(31_000);
    const m = { ...neutralMultipliers(), directorBp: SafeInt(31_000) };
    expect(computeEffectiveDefenseBp(SafeInt(10_000), m)).toBe(31_000);
  });

  it("rejects a NORMAL-class factor above MAX_ENGAGEMENT_FACTOR_BP (31_001 director) fail-closed", () => {
    let caught: unknown;
    try {
      computeEffectiveDefenseBp(SafeInt(100), {
        ...neutralMultipliers(),
        directorBp: 31_001 as SafeInt,
      });
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_STATE);
    expect((caught as BluewaveError).context.slot).toBe("director");
  });

  it("the returned value never exceeds 31_000 under the shipped factor bounds", () => {
    expect(
      computeEffectiveDefenseBp(SafeInt(10_000), {
        ...neutralMultipliers(),
        directorBp: SafeInt(31_000),
      }),
    ).toBe(31_000);
    expect(computeEffectiveDefenseBp(SafeInt(31_000), neutralMultipliers())).toBe(31_000);
  });
});

describe("AC-11: two-class factor bound policy (INC-4 repair, §14/§16 saturation aggregates)", () => {
  it("(a) §14 rational embedding: base 100, all other factors neutral, radarBp=40_000 (4 groups) → 400", () => {
    const m = { ...neutralMultipliers(), radarBp: SafeInt(40_000) };
    expect(computeEffectiveDefenseBp(SafeInt(100), m)).toBe(400);
  });

  it("(b) §16 rational embedding: base 100, all other factors neutral, saturationBp=40_000 (4 CIWS) → 400", () => {
    const m = { ...neutralMultipliers(), saturationBp: SafeInt(40_000) };
    expect(computeEffectiveDefenseBp(SafeInt(100), m)).toBe(400);
  });

  it("(c) mixed with the director factor: base 100, directorBp=18_000 (2 directors), radarBp=40_000 → 720", () => {
    const m = { ...neutralMultipliers(), directorBp: SafeInt(18_000), radarBp: SafeInt(40_000) };
    expect(computeEffectiveDefenseBp(SafeInt(100), m)).toBe(720);
  });

  it("the 9-group radar aggregate (55_500) is accepted and embeds the §14 rational 5.55", () => {
    const m = { ...neutralMultipliers(), radarBp: SafeInt(55_500) };
    expect(computeEffectiveDefenseBp(SafeInt(100), m)).toBe(555);
  });

  it("the 12-system CIWS aggregate (55_000) is accepted — §16 is not a construction cap", () => {
    const m = { ...neutralMultipliers(), saturationBp: SafeInt(55_000) };
    expect(computeEffectiveDefenseBp(SafeInt(100), m)).toBe(550);
  });

  it("SATURATION-class slots accept a value just above the 31_000 NORMAL cap (radarBp=31_001)", () => {
    const m = { ...neutralMultipliers(), radarBp: 31_001 as SafeInt };
    expect(computeEffectiveDefenseBp(SafeInt(100), m)).toBe(310);
    const s = { ...neutralMultipliers(), saturationBp: 31_001 as SafeInt };
    expect(computeEffectiveDefenseBp(SafeInt(100), s)).toBe(310);
  });

  it("a saturation aggregate beyond the shipped optimum is still exact: max-valid 4/4-scale, radar 4 groups + saturation 4 systems + director 4", () => {
    const m = {
      ...neutralMultipliers(),
      directorBp: SafeInt(31_000),
      radarBp: SafeInt(40_000),
      saturationBp: SafeInt(40_000),
    };
    expect(computeEffectiveDefenseBp(SafeInt(10_000), m)).toBe(496_000);
  });

  it("the defensive rawFloored > MAX_SAFE_INTEGER throw still guards pathological saturation inputs", () => {
    let caught: unknown;
    try {
      computeEffectiveDefenseBp(SafeInt(100), {
        ...neutralMultipliers(),
        radarBp: Number.MAX_SAFE_INTEGER as SafeInt,
        saturationBp: Number.MAX_SAFE_INTEGER as SafeInt,
      });
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_STATE);
  });

  it("SATURATION-class slots still reject negatives and non-safe integers (fail-closed)", () => {
    expect(() =>
      computeEffectiveDefenseBp(SafeInt(100), {
        ...neutralMultipliers(),
        radarBp: -1 as SafeInt,
      }),
    ).toThrow();
    expect(() =>
      computeEffectiveDefenseBp(SafeInt(100), {
        ...neutralMultipliers(),
        saturationBp: -10_000 as SafeInt,
      }),
    ).toThrow();
    expect(() =>
      computeEffectiveDefenseBp(SafeInt(100), {
        ...neutralMultipliers(),
        radarBp: (Number.MAX_SAFE_INTEGER + 1) as SafeInt,
      }),
    ).toThrow();
  });
});

describe("AC-11: mutually exclusive outcome table (§5, §19 lines 328-330)", () => {
  const bands = {
    effectiveKillBp: SafeInt(25),
    effectiveDamageBp: SafeInt(10),
    effectiveAbortBp: SafeInt(5),
    effectiveDisruptionBp: SafeInt(3),
  };

  it("maps draw < killBp → KILL", () => {
    expect(resolveEngagementOutcome({ ...bands, draw: SafeInt(24) }).outcome).toBe("KILL");
  });

  it("maps the cumulative DAMAGE band [25, 35) → DAMAGE", () => {
    expect(resolveEngagementOutcome({ ...bands, draw: SafeInt(25) }).outcome).toBe("DAMAGE");
    expect(resolveEngagementOutcome({ ...bands, draw: SafeInt(34) }).outcome).toBe("DAMAGE");
  });

  it("maps the cumulative ABORT band [35, 40) → ABORT", () => {
    expect(resolveEngagementOutcome({ ...bands, draw: SafeInt(35) }).outcome).toBe("ABORT");
    expect(resolveEngagementOutcome({ ...bands, draw: SafeInt(39) }).outcome).toBe("ABORT");
  });

  it("maps the cumulative DISRUPTION band [40, 43) → DISRUPTION", () => {
    expect(resolveEngagementOutcome({ ...bands, draw: SafeInt(40) }).outcome).toBe("DISRUPTION");
    expect(resolveEngagementOutcome({ ...bands, draw: SafeInt(42) }).outcome).toBe("DISRUPTION");
  });

  it("maps draw >= totalBp → NO_EFFECT", () => {
    expect(resolveEngagementOutcome({ ...bands, draw: SafeInt(43) }).outcome).toBe("NO_EFFECT");
    expect(resolveEngagementOutcome({ ...bands, draw: SafeInt(9_999) }).outcome).toBe("NO_EFFECT");
  });

  it("returns exactly one primary outcome with correct cumulative thresholds", () => {
    const result = resolveEngagementOutcome({ ...bands, draw: SafeInt(30) });
    expect(result.outcome).toBe("DAMAGE");
    expect(Number(result.thresholds.killEndBp)).toBe(25);
    expect(Number(result.thresholds.damageEndBp)).toBe(35);
    expect(Number(result.thresholds.abortEndBp)).toBe(40);
    expect(Number(result.thresholds.disruptionEndBp)).toBe(43);
    expect(Number(result.thresholds.totalBp)).toBe(43);
  });

  it("every draw 0..9_999 yields exactly one outcome band (exhaustive + mutually exclusive)", () => {
    const wide = {
      effectiveKillBp: SafeInt(100),
      effectiveDamageBp: SafeInt(200),
      effectiveAbortBp: SafeInt(300),
      effectiveDisruptionBp: SafeInt(400),
    };
    const counts: Record<string, number> = {
      KILL: 0,
      DAMAGE: 0,
      ABORT: 0,
      DISRUPTION: 0,
      NO_EFFECT: 0,
    };
    for (let d = 0; d <= 9_999; d++) {
      const { outcome } = resolveEngagementOutcome({ ...wide, draw: SafeInt(d) });
      counts[outcome]++;
    }
    expect(counts).toEqual({
      KILL: 100,
      DAMAGE: 200,
      ABORT: 300,
      DISRUPTION: 400,
      NO_EFFECT: 9_000,
    });
  });
});

describe("AC-11: keyed engagement draw", () => {
  it("produces a stable stream id from the engagement identity", () => {
    expect(airDefenseEngagementStreamId(IDENTITY)).toBe(
      "air-defense/engagement/ship_001/sys_001/atk_001/5/2",
    );
    expect(airDefenseEngagementStreamId(IDENTITY)).toBe(airDefenseEngagementStreamId(IDENTITY));
    expect(airDefenseEngagementStreamId({ ...IDENTITY, attackId: "atk_002" })).not.toBe(
      airDefenseEngagementStreamId(IDENTITY),
    );
  });

  it("same seed + same stream → same draw, always within 0..9_999", () => {
    const engineA = new RandomEngine("engagement-seed-1");
    const engineB = new RandomEngine("engagement-seed-1");
    const drawA = drawAirDefenseOutcome(engineA, airDefenseEngagementStreamId(IDENTITY));
    const drawB = drawAirDefenseOutcome(engineB, airDefenseEngagementStreamId(IDENTITY));
    expect(drawA).toBe(drawB);
    expect(Number(drawA)).toBeGreaterThanOrEqual(0);
    expect(Number(drawA)).toBeLessThanOrEqual(9_999);
  });

  it("different engagement identities draw from different streams", () => {
    const engine = new RandomEngine("engagement-seed-2");
    const drawA = drawAirDefenseOutcome(engine, airDefenseEngagementStreamId(IDENTITY));
    const drawB = drawAirDefenseOutcome(
      engine,
      airDefenseEngagementStreamId({ ...IDENTITY, attackId: "atk_other" }),
    );
    const drawC = drawAirDefenseOutcome(engine, airDefenseEngagementStreamId(IDENTITY));
    expect(Number(drawA)).toBeGreaterThanOrEqual(0);
    expect(Number(drawA)).toBeLessThanOrEqual(9_999);
    expect(drawC).toBe(drawA);
    void drawB;
  });
});

describe("AC-11: resolveEngagement entry point (§19/§20)", () => {
  it("consumes roundsPerEngagement on a drawn engagement (KILL band)", () => {
    const system = makeSystem({ baseKillBp: SafeInt(10_000) });
    const state = makeState(system, [["sys_001", SafeInt(100)]]);
    const result = resolveEngagement({
      system,
      attack: makeAttack(),
      state,
      multipliers: neutralMultipliers(),
      engine: new RandomEngine("engagement-resolve-seed"),
      identity: IDENTITY,
    });

    expect(result.outcome).toBe("KILL");
    expect(Number(result.consumedRounds)).toBe(5);
    expect(Number(result.effectiveBp.kill)).toBe(10_000);
    expect(Number(result.state.ammunitionByType.get("sys_001"))).toBe(95);
    expect(result.state.stateHash).not.toBe(state.stateHash);
    expect(result.state.stateHash).toBe(computeAirDefenseStateHash(result.state));
    expect(Number(result.draw)).toBeGreaterThanOrEqual(0);
    expect(Number(result.draw)).toBeLessThanOrEqual(9_999);
  });

  it("consumes roundsPerEngagement on a drawn NO_EFFECT (draw beyond all bands, §20 line 334)", () => {
    const system = makeSystem({
      baseKillBp: SafeInt(30),
      baseDamageBp: SafeInt(10),
      baseAbortBp: SafeInt(5),
      baseDisruptionBp: SafeInt(3),
    });
    const state = makeState(system, [["sys_001", SafeInt(100)]]);
    const result = resolveEngagement({
      system,
      attack: makeAttack(),
      state,
      multipliers: neutralMultipliers(),
      engine: new FixedStreamEngine(0.5),
      identity: IDENTITY,
    });

    expect(result.outcome).toBe("NO_EFFECT");
    expect(Number(result.consumedRounds)).toBe(5);
    expect(Number(result.draw)).toBe(5_000);
    expect(Number(result.state.ammunitionByType.get("sys_001"))).toBe(95);
    expect(result.state.stateHash).not.toBe(state.stateHash);
    expect(result.state.stateHash).toBe(computeAirDefenseStateHash(result.state));
  });

  it("a drawn NO_EFFECT engagement still consumes rounds (§20 line 334)", () => {
    const system = makeSystem({
      baseKillBp: SafeInt(1),
      baseDamageBp: SafeInt(1),
      baseAbortBp: SafeInt(1),
      baseDisruptionBp: SafeInt(1),
      roundsPerEngagement: SafeInt(7),
    });
    const state = makeState(system, [["sys_001", SafeInt(20)]]);
    const result = resolveEngagement({
      system,
      attack: makeAttack(),
      state,
      multipliers: neutralMultipliers(),
      engine: new FixedStreamEngine(0.9),
      identity: IDENTITY,
    });

    expect(result.outcome).toBe("NO_EFFECT");
    expect(Number(result.draw)).toBe(9_000);
    expect(Number(result.consumedRounds)).toBe(7);
    expect(Number(result.state.ammunitionByType.get("sys_001"))).toBe(13);
    expect(result.state.stateHash).not.toBe(state.stateHash);
  });

  it("an empty system (0 rounds) contributes zero: all bp 0 → NO_EFFECT, no consumption", () => {
    const state = makeState(makeSystem(), [["sys_001", SafeInt.ZERO]]);
    const result = resolveEngagement({
      system: state.systems[0]!,
      attack: makeAttack(),
      state,
      multipliers: neutralMultipliers(),
      engine: new RandomEngine("engagement-resolve-seed"),
      identity: IDENTITY,
    });

    expect(result.outcome).toBe("NO_EFFECT");
    expect(Number(result.consumedRounds)).toBe(0);
    expect(Number(result.effectiveBp.kill)).toBe(0);
    expect(Number(result.effectiveBp.damage)).toBe(0);
    expect(Number(result.effectiveBp.abort)).toBe(0);
    expect(Number(result.effectiveBp.disruption)).toBe(0);
    expect(Number(result.draw)).toBe(0);
    expect(result.state.stateHash).toBe(state.stateHash);
  });

  it("is fully deterministic: identical inputs → identical outcome, draw, and state hash", () => {
    const system = makeSystem({ baseKillBp: SafeInt(10_000) });
    const run = (seed: string) => {
      const state = makeState(system, [["sys_001", SafeInt(100)]]);
      const result = resolveEngagement({
        system,
        attack: makeAttack(),
        state,
        multipliers: neutralMultipliers(),
        engine: new RandomEngine(seed),
        identity: IDENTITY,
      });
      return {
        outcome: result.outcome,
        draw: Number(result.draw),
        consumedRounds: Number(result.consumedRounds),
        stateHash: result.state.stateHash,
      };
    };
    expect(run("engagement-determinism-seed")).toEqual(run("engagement-determinism-seed"));
  });

  it("rejects a system that is not a member of the state (fail-closed)", () => {
    const state = makeState(makeSystem(), [["sys_001", SafeInt(10)]]);
    const outsider = makeSystem({ systemId: "sys_999" });
    let caught: unknown;
    try {
      resolveEngagement({
        system: outsider,
        attack: makeAttack(),
        state,
        multipliers: neutralMultipliers(),
        engine: new RandomEngine("engagement-resolve-seed"),
        identity: IDENTITY,
      });
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_STATE);
  });

  it("a DESTROYED system (damageBp >= 10_000) contributes zero even when the caller passes neutral damageBp 10_000", () => {
    const system = makeSystem({ baseKillBp: SafeInt(10_000) });
    const state = makeState(system, [["sys_001", SafeInt(100)]], {
      damageBp: SafeInt(10_000),
      powerBp: SafeInt(10_000),
    });
    const result = resolveEngagement({
      system,
      attack: makeAttack(),
      state,
      multipliers: neutralMultipliers(),
      engine: new RandomEngine("engagement-destroyed-seed"),
      identity: IDENTITY,
    });

    expect(result.outcome).toBe("NO_EFFECT");
    expect(Number(result.consumedRounds)).toBe(0);
    expect(Number(result.draw)).toBe(0);
    expect(Number(result.effectiveBp.kill)).toBe(0);
    expect(Number(result.effectiveBp.damage)).toBe(0);
    expect(Number(result.effectiveBp.abort)).toBe(0);
    expect(Number(result.effectiveBp.disruption)).toBe(0);
    expect(result.state.stateHash).toBe(state.stateHash);
  });

  it("an unpowered system (powerBp 0) contributes zero even when the caller passes neutral damageBp 10_000", () => {
    const system = makeSystem({ baseKillBp: SafeInt(10_000) });
    const state = makeState(system, [["sys_001", SafeInt(100)]], { powerBp: SafeInt.ZERO });
    const result = resolveEngagement({
      system,
      attack: makeAttack(),
      state,
      multipliers: neutralMultipliers(),
      engine: new RandomEngine("engagement-unpowered-seed"),
      identity: IDENTITY,
    });

    expect(result.outcome).toBe("NO_EFFECT");
    expect(Number(result.consumedRounds)).toBe(0);
    expect(Number(result.draw)).toBe(0);
    expect(Number(result.effectiveBp.kill)).toBe(0);
    expect(result.state.stateHash).toBe(state.stateHash);
  });
});
