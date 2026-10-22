import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  computeLaunchFailureChanceBp,
  EMPTY_TUBE,
  evaluateTubeLaunchDraw,
  NO_RELOAD_IN_PROGRESS,
  reserveSalvoTorpedoes,
  resolveTubeLaunches,
  salvoContinuesAfterFailure,
  TORPEDO_LAUNCH_FAILURE,
  TORPEDO_LAUNCH_FAILURE_BASE_BP,
  TORPEDO_LAUNCH_FAILURE_MAX_BP,
  TORPEDO_LAUNCH_FAILURE_MIN_BP,
  TORPEDO_LAUNCH_SUBSTEP,
  TORPEDO_STATE_INVARIANT_FAILED,
  TORPEDO_STUCK_IN_TUBE,
  torpedoLaunchFailureStreamId,
  withTorpedoLauncherStateHash,
  type TorpedoLauncherState,
  type TorpedoSalvoPolicyInputs,
} from "../../src/torpedoes/index.js";
import { COMPILED_TORPEDOES } from "../fixtures/compiledTorpedoes.js";

const G7A = "ger_533mm_g7a_1934";
const G7A_44KN_SETTING = { settingId: "44kn", speedMilliKnots: 44_000, rangeM: 6_000 };

function neutralPolicy(
  overrides: Partial<TorpedoSalvoPolicyInputs> = {},
): TorpedoSalvoPolicyInputs {
  return {
    missionObjective: "ATTACK",
    withdrawalState: "NORMAL",
    targetCombatValueBp: 0,
    targetSizeBp: 0,
    targetEstimatedRangeM: 1_000,
    solutionQualityBp: 10_000,
    remainingTotalAmmunition: 12,
    friendlyLauncherCount: 3,
    overkillEstimateBp: 0,
    ...overrides,
  };
}

function launcher(overrides: Partial<TorpedoLauncherState> = {}): TorpedoLauncherState {
  const surface: Omit<TorpedoLauncherState, "stateHash"> = {
    launcherId: "LCH-1",
    ownerPlatformId: "SHIP-ALPHA",
    launcherFamilyId: "533mm_underwater_trainable",
    mountPosition: "port_amidships",
    mountType: "UNDERWATER_TRAINABLE",
    tubeCount: 4,
    loadedPerTube: [G7A, G7A, EMPTY_TUBE, G7A],
    reserveAmmunition: { [G7A]: 6 },
    reloadState: NO_RELOAD_IN_PROGRESS,
    trainingLimitsMdeg: { min: -45_000, max: 45_000 },
    underwaterLaunchCapability: true,
    fireControlConnectionState: "CONNECTED",
    damageState: "OPERATIONAL",
    floodingIsolationState: "INTACT",
    activeFireSolution: "SOL-1",
    rulesetVersion: "torpedo_ruleset_v1",
    formulaVersion: "torpedo_formula_v1",
    ...overrides,
  };
  return withTorpedoLauncherStateHash(surface);
}

function tubeDraws(drawByTube: Record<number, number>): (stream: string) => number {
  return (stream: string) => {
    const m = /tube(\d+)$/.exec(stream);
    const tubeId = m ? Number(m[1]) : Number.NaN;
    const draw = drawByTube[tubeId];
    if (draw === undefined) throw new Error(`no stubbed draw for tube ${tubeId}: ${stream}`);
    return draw;
  };
}

function resolve(
  overrides: Partial<Parameters<typeof resolveTubeLaunches>[0]> = {},
): ReturnType<typeof resolveTubeLaunches> {
  const state = launcher();
  const reservation = reserveSalvoTorpedoes(state, overrides.tubeIndexes ?? [0, 1, 3]);
  return resolveTubeLaunches({
    battleId: "B1",
    firingShipId: "SHIP-ALPHA",
    firingSideId: "SIDE-A",
    reservation,
    torpedoes: COMPILED_TORPEDOES,
    tubeIndexes: [0, 1, 3],
    crewQualityBp: 5_000,
    salvoPolicy: neutralPolicy(),
    selectedSetting: G7A_44KN_SETTING,
    launchMinute: 5,
    firingSubstep: TORPEDO_LAUNCH_SUBSTEP,
    launchPosition: [0, 0],
    launchHeadingMdeg: 0,
    orderedGyroAngleMdeg: 0,
    depthSettingM: 5,
    targetContactId: "C1",
    keyedRng: tubeDraws({}),
    ...overrides,
  });
}

describe("AC-12: base launch-failure 100 bp + modifier composition", () => {
  it("ships the exact 100 bp base and the [0, 10_000] clamp bounds", () => {
    expect(TORPEDO_LAUNCH_FAILURE_BASE_BP).toBe(100);
    expect(TORPEDO_LAUNCH_FAILURE_MIN_BP).toBe(0);
    expect(TORPEDO_LAUNCH_FAILURE_MAX_BP).toBe(10_000);
  });

  it("the neutral composition starts from exactly the 100 bp base (G7a, OPERATIONAL, crew 5_000 -> 91 bp)", () => {
    expect(
      computeLaunchFailureChanceBp({
        launcherDamageState: "OPERATIONAL",
        modelReliabilityBp: 96_000,
        crewQualityBp: 5_000,
      }),
    ).toBe(91);
  });

  it("lower model reliability raises the failure chance", () => {
    const g7a = computeLaunchFailureChanceBp({
      launcherDamageState: "OPERATIONAL",
      modelReliabilityBp: 96_000,
      crewQualityBp: 5_000,
    });
    const whitehead = computeLaunchFailureChanceBp({
      launcherDamageState: "OPERATIONAL",
      modelReliabilityBp: 90_000,
      crewQualityBp: 5_000,
    });
    expect(whitehead).toBeGreaterThan(g7a);
    expect(g7a).toBe(91);
    expect(whitehead).toBe(165);
  });

  it("higher crew quality lowers the failure chance", () => {
    const green = computeLaunchFailureChanceBp({
      launcherDamageState: "OPERATIONAL",
      modelReliabilityBp: 96_000,
      crewQualityBp: 0,
    });
    const elite = computeLaunchFailureChanceBp({
      launcherDamageState: "OPERATIONAL",
      modelReliabilityBp: 96_000,
      crewQualityBp: 10_000,
    });
    expect(elite).toBeLessThan(green);
    expect(green).toBe(141);
    expect(elite).toBe(41);
  });

  it("a DAMAGED launcher adds the authored +75 bp damage adjustment", () => {
    const op = computeLaunchFailureChanceBp({
      launcherDamageState: "OPERATIONAL",
      modelReliabilityBp: 96_000,
      crewQualityBp: 5_000,
    });
    const damaged = computeLaunchFailureChanceBp({
      launcherDamageState: "DAMAGED",
      modelReliabilityBp: 96_000,
      crewQualityBp: 5_000,
    });
    expect(damaged).toBe(op + 75);
    expect(damaged).toBe(166);
  });

  it("rejects a DESTROYED launcher and invalid crew/reliability inputs (TORPEDO_STATE_INVARIANT_FAILED)", () => {
    expect(() =>
      computeLaunchFailureChanceBp({
        launcherDamageState: "DESTROYED",
        modelReliabilityBp: 96_000,
        crewQualityBp: 5_000,
      }),
    ).toThrow(BluewaveError);
    for (const crewQualityBp of [5_000.5, -1, 10_001]) {
      let err: BluewaveError | undefined;
      try {
        computeLaunchFailureChanceBp({
          launcherDamageState: "OPERATIONAL",
          modelReliabilityBp: 96_000,
          crewQualityBp,
        });
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
    }
    for (const modelReliabilityBp of [100_001, -1]) {
      let err: BluewaveError | undefined;
      try {
        computeLaunchFailureChanceBp({
          launcherDamageState: "OPERATIONAL",
          modelReliabilityBp,
          crewQualityBp: 5_000,
        });
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
    }
  });
});

describe("AC-12: the pure draw -> outcome mapping (evaluateTubeLaunchDraw)", () => {
  it("maps the keyed draw to SUCCESS / TORPEDO_LAUNCH_FAILURE / TORPEDO_STUCK_IN_TUBE exactly", () => {
    expect(evaluateTubeLaunchDraw({ failureChanceBp: 91, draw: 0.5 })).toEqual({
      outcome: "SUCCESS",
      drawBp: 5_000,
      stuckBoundaryBp: 27,
    });
    expect(evaluateTubeLaunchDraw({ failureChanceBp: 91, draw: 0.005 })).toEqual({
      outcome: "TORPEDO_LAUNCH_FAILURE",
      drawBp: 50,
      stuckBoundaryBp: 27,
    });
    expect(evaluateTubeLaunchDraw({ failureChanceBp: 91, draw: 0.001 })).toEqual({
      outcome: "TORPEDO_STUCK_IN_TUBE",
      drawBp: 10,
      stuckBoundaryBp: 27,
    });
    expect(evaluateTubeLaunchDraw({ failureChanceBp: 91, draw: 0.0091 }).outcome).toBe("SUCCESS");
  });

  it("rejects a non-integer failure chance or an out-of-range draw (TORPEDO_STATE_INVARIANT_FAILED)", () => {
    expect(() => evaluateTubeLaunchDraw({ failureChanceBp: 91.5, draw: 0.5 })).toThrow(
      BluewaveError,
    );
    expect(() => evaluateTubeLaunchDraw({ failureChanceBp: -1, draw: 0.5 })).toThrow(BluewaveError);
    expect(() => evaluateTubeLaunchDraw({ failureChanceBp: 91, draw: -0.1 })).toThrow(
      BluewaveError,
    );
    expect(() => evaluateTubeLaunchDraw({ failureChanceBp: 91, draw: 1 })).toThrow(BluewaveError);
  });
});

describe("AC-12: ascending tube-id fire order regardless of the declared salvo order", () => {
  it("fires a shuffled accepted salvo in ascending tube-id order", () => {
    const r = resolve({ tubeIndexes: [3, 1, 0], keyedRng: tubeDraws({ 0: 0.5, 1: 0.5, 3: 0.5 }) });
    expect(r.attempts.map((a) => a.tubeId)).toEqual([0, 1, 3]);
    expect(r.skippedTubeIds).toEqual([]);
    expect(r.state.loadedPerTube).toEqual([EMPTY_TUBE, EMPTY_TUBE, EMPTY_TUBE, EMPTY_TUBE]);
    expect(r.tracks.length).toBe(3);
  });

  it("records one attempt per tube, each with its own tube-bound stream id (battleId/minute/substep/launcherId/tubeId)", () => {
    const r = resolve({ tubeIndexes: [3, 1, 0], keyedRng: tubeDraws({ 0: 0.5, 1: 0.5, 3: 0.5 }) });
    expect(r.attempts.length).toBe(3);
    for (const a of r.attempts) {
      expect(a.drawStreamId).toBe(
        torpedoLaunchFailureStreamId({
          battleId: "B1",
          launchMinute: 5,
          firingSubstep: TORPEDO_LAUNCH_SUBSTEP,
          launcherId: "LCH-1",
          tubeId: a.tubeId,
        }),
      );
      expect(a.drawStreamId).toContain("B1");
      expect(a.drawStreamId).toContain(":5:");
      expect(a.drawStreamId).toContain(":4:");
      expect(a.drawStreamId).toContain("LCH-1");
      expect(a.drawStreamId).toContain(`tube${a.tubeId}`);
    }
    expect(new Set(r.attempts.map((a) => a.drawStreamId)).size).toBe(3);
  });

  it("is a deterministic pure-function: same inputs + same keyed RNG -> identical attempts/state/tracks", () => {
    const a = resolve({ tubeIndexes: [3, 1, 0], keyedRng: tubeDraws({ 0: 0.5, 1: 0.5, 3: 0.5 }) });
    const b = resolve({ tubeIndexes: [3, 1, 0], keyedRng: tubeDraws({ 0: 0.5, 1: 0.5, 3: 0.5 }) });
    expect(a.attempts).toEqual(b.attempts);
    expect(a.state).toEqual(b.state);
    expect(a.tracks).toEqual(b.tracks);
    expect(a.skippedTubeIds).toEqual(b.skippedTubeIds);
    expect(a.salvo).toEqual(b.salvo);
  });
});

describe("AC-12: per-tube mechanical failure consumes NO torpedo unless STUCK_IN_TUBE", () => {
  it("a non-stuck failure restores the torpedo; a stuck failure and a success keep the tube consumed", () => {
    const r = resolve({
      keyedRng: tubeDraws({ 0: 0.001, 1: 0.5, 3: 0.005 }),
    });
    expect(r.attempts.map((a) => a.tubeId)).toEqual([0, 1, 3]);
    expect(r.attempts[0].outcome).toBe("TORPEDO_STUCK_IN_TUBE");
    expect(r.attempts[0].reasonCode).toBe(TORPEDO_STUCK_IN_TUBE);
    expect(r.attempts[1].outcome).toBe("SUCCESS");
    expect(r.attempts[1].reasonCode).toBeNull();
    expect(r.attempts[2].outcome).toBe("TORPEDO_LAUNCH_FAILURE");
    expect(r.attempts[2].reasonCode).toBe(TORPEDO_LAUNCH_FAILURE);

    for (const a of r.attempts) {
      expect(a.failureChanceBp).toBe(91);
      expect(a.stuckBoundaryBp).toBe(27);
    }

    expect(r.state.loadedPerTube).toEqual([EMPTY_TUBE, EMPTY_TUBE, EMPTY_TUBE, G7A]);
    expect(r.tracks.length).toBe(1);
    expect(r.tracks[0].tubeId).toBe(1);
  });

  it("the resolver fails closed on a mis-accounted reservation (TORPEDO_STATE_INVARIANT_FAILED)", () => {
    const partial = reserveSalvoTorpedoes(launcher(), [0, 1]);
    let err: BluewaveError | undefined;
    try {
      resolveTubeLaunches({
        battleId: "B1",
        firingShipId: "SHIP-ALPHA",
        firingSideId: "SIDE-A",
        reservation: partial,
        torpedoes: COMPILED_TORPEDOES,
        tubeIndexes: [0, 1, 3],
        crewQualityBp: 5_000,
        salvoPolicy: neutralPolicy(),
        selectedSetting: G7A_44KN_SETTING,
        launchMinute: 5,
        firingSubstep: TORPEDO_LAUNCH_SUBSTEP,
        launchPosition: [0, 0],
        launchHeadingMdeg: 0,
        orderedGyroAngleMdeg: 0,
        depthSettingM: 5,
        targetContactId: "C1",
        keyedRng: tubeDraws({}),
      });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
  });
});

describe("AC-12: later tubes continue only per the salvo policy", () => {
  it("the continuation predicate permits below recommended size and aborts at/above it", () => {
    const defense = neutralPolicy({ missionObjective: "DEFENSE" });
    expect(
      salvoContinuesAfterFailure({
        salvoPolicy: defense,
        acceptedTubeCount: 3,
        successfulLaunchesSoFar: 0,
      }),
    ).toBe(true);
    expect(
      salvoContinuesAfterFailure({
        salvoPolicy: defense,
        acceptedTubeCount: 3,
        successfulLaunchesSoFar: 1,
      }),
    ).toBe(false);
  });

  it("after a mechanical failure the remaining tubes continue while successful launches are below the recommended size", () => {
    const r = resolve({
      keyedRng: tubeDraws({ 0: 0.005, 1: 0.5, 3: 0.5 }),
    });
    expect(r.salvo.recommendedSize).toBe(2);
    expect(r.skippedTubeIds).toEqual([]);
    expect(r.attempts.map((a) => a.tubeId)).toEqual([0, 1, 3]);
    expect(r.attempts[0].outcome).toBe("TORPEDO_LAUNCH_FAILURE");
    expect(r.state.loadedPerTube).toEqual([G7A, EMPTY_TUBE, EMPTY_TUBE, EMPTY_TUBE]);
    expect(r.tracks.length).toBe(2);
  });

  it("aborts (skips) the remaining tubes once the recommended size is reached and records no attempt for them", () => {
    const r = resolve({
      salvoPolicy: neutralPolicy({ missionObjective: "DEFENSE" }),
      keyedRng: tubeDraws({ 0: 0.5, 1: 0.005 }),
    });
    expect(r.salvo.recommendedSize).toBe(1);
    expect(r.skippedTubeIds).toEqual([3]);
    expect(r.attempts.map((a) => a.tubeId)).toEqual([0, 1]);
    expect(r.attempts[1].outcome).toBe("TORPEDO_LAUNCH_FAILURE");
    expect(r.state.loadedPerTube[1]).toBe(G7A);
    expect(r.state.loadedPerTube[0]).toBe(EMPTY_TUBE);
    expect(r.state.loadedPerTube[3]).toBe(G7A);
    expect(r.tracks.length).toBe(1);
  });

  it("a TORPEDO_STUCK_IN_TUBE tube triggers the abort like a non-stuck failure (stuck tube consumes, later tubes skipped)", () => {
    const r = resolve({
      salvoPolicy: neutralPolicy({ missionObjective: "DEFENSE" }),
      keyedRng: tubeDraws({ 0: 0.5, 1: 0.001 }),
    });
    expect(r.salvo.recommendedSize).toBe(1);
    expect(r.skippedTubeIds).toEqual([3]);
    expect(r.attempts.map((a) => a.tubeId)).toEqual([0, 1]);
    expect(r.attempts[0].outcome).toBe("SUCCESS");
    expect(r.attempts[1].outcome).toBe("TORPEDO_STUCK_IN_TUBE");
    expect(r.attempts[1].reasonCode).toBe(TORPEDO_STUCK_IN_TUBE);
    expect(r.state.loadedPerTube[0]).toBe(EMPTY_TUBE);
    expect(r.state.loadedPerTube[1]).toBe(EMPTY_TUBE);
    expect(r.state.loadedPerTube[3]).toBe(G7A);
    expect(r.tracks.length).toBe(1);
    expect(r.tracks[0].tubeId).toBe(0);
  });

  it("restores the torpedo to every tube the abort skipped (never fired), not just the mechanical-failure tube", () => {
    const r = resolve({
      salvoPolicy: neutralPolicy({ missionObjective: "DEFENSE" }),
      keyedRng: tubeDraws({ 0: 0.5, 1: 0.005 }),
    });
    expect(r.skippedTubeIds).toEqual([3]);
    for (const tubeId of r.skippedTubeIds) {
      expect(r.state.loadedPerTube[tubeId]).toBe(G7A);
    }
  });
});
