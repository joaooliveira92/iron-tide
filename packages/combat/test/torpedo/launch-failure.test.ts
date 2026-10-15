// AC-12: launch timing/failure (DESIGN-40 §12). Deterministic per-tube launch
// outcomes for an ACCEPTED salvo (post atomic reservation): tubes fire in
// ASCENDING tube-id order at the declared firing substep; per-tube mechanical
// failure consumes NO torpedo unless the outcome is TORPEDO_STUCK_IN_TUBE;
// later tubes continue only per the salvo policy; every result is recorded
// separately; a random branch can never change the canonical tube order; the
// base launch-failure probability is exactly 100 bp per tube before modifiers.
//
// All arithmetic is exact integer basis-point (floor steps are explicit). The
// keyed RNG is stubbed per-stream (a controlled float per tube) so every
// success / mechanical-failure / stuck branch is hit deterministically — no
// randomness at test level.
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

const G7A = "ger_533mm_g7a_1934"; // reliabilityBp 96_000, guidance "gyro"
const G7A_44KN_SETTING = { settingId: "44kn", speedMilliKnots: 44_000, rangeM: 6_000 };

// A tactically-neutral salvo policy (mirrors salvo.test.ts): with the neutral
// factor set the recommended size equals the mission-objective base tubes.
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

// OPERATIONAL, neutral crew, 4 tubes [G7A, G7A, EMPTY, G7A].
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

// Deterministic keyed-RNG stub: returns a caller-controlled float per tube id.
// The stream identity is parsed for the trailing `tube<N>` so the stub is bound
// to the tube exactly like the real engine stream.
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
    // G7a: model floor((100_000-96_000)/250)=16; damage OPERATIONAL 0;
    // crew floor((5_000-5_000)/100)=0; reliability band 96_000>=95_000 -> -25.
    // 100 + 16 + 0 + 0 - 25 = 91.
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
      modelReliabilityBp: 90_000, // worse model (whitehead)
      crewQualityBp: 5_000,
    });
    expect(whitehead).toBeGreaterThan(g7a);
    expect(g7a).toBe(91);
    expect(whitehead).toBe(165); // 100 + 40 (model) + 25 (band) + 0 + 0
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
    expect(green).toBe(141); // 100 + 16 + 0 + 50 - 25
    expect(elite).toBe(41); // 100 + 16 + 0 - 50 - 25
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
    // failureChanceBp 91, stuck share 3_000 -> stuckBoundaryBp floor(91*3000/10000)=27.
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
    // drawBp exactly on the failure boundary (91) succeeds.
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
    // All draws succeed (draw 0.5), so every accepted tube attempts.
    const r = resolve({ tubeIndexes: [3, 1, 0], keyedRng: tubeDraws({ 0: 0.5, 1: 0.5, 3: 0.5 }) });
    expect(r.attempts.map((a) => a.tubeId)).toEqual([0, 1, 3]);
    expect(r.skippedTubeIds).toEqual([]);
    // every success consumed its tube
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

  // In-process determinism: identical inputs + identical keyed stream produce
  // identical attempts/state/tracks. Cross-process (byte-identical across
  // engines/OS) determinism is AC-23, verified by the INC-7 engine-stage
  // two-process determinism proof — this pure function's in-process equality
  // is the per-call contract honoured on every engine invocation.
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
      // ATTACK neutral -> recommendedSize 2, so after tube 0 (stuck) the later
      // tubes continue while successfulLaunchesSoFar (0) < 2.
      keyedRng: tubeDraws({ 0: 0.001, 1: 0.5, 3: 0.005 }),
    });
    expect(r.attempts.map((a) => a.tubeId)).toEqual([0, 1, 3]);
    expect(r.attempts[0].outcome).toBe("TORPEDO_STUCK_IN_TUBE");
    expect(r.attempts[0].reasonCode).toBe(TORPEDO_STUCK_IN_TUBE);
    expect(r.attempts[1].outcome).toBe("SUCCESS");
    expect(r.attempts[1].reasonCode).toBeNull();
    expect(r.attempts[2].outcome).toBe("TORPEDO_LAUNCH_FAILURE");
    expect(r.attempts[2].reasonCode).toBe(TORPEDO_LAUNCH_FAILURE);

    // The exact composed chance (G7a, OPERATIONAL, crew 5_000) and the stuck
    // boundary are recorded on the attempts.
    for (const a of r.attempts) {
      expect(a.failureChanceBp).toBe(91);
      expect(a.stuckBoundaryBp).toBe(27);
    }

    // State: tube 0 STUCK consumed (EMPTY), tube 1 SUCCESS consumed (EMPTY),
    // tube 3 non-stuck MECHANICAL FAILURE restored (still G7A).
    expect(r.state.loadedPerTube).toEqual([EMPTY_TUBE, EMPTY_TUBE, EMPTY_TUBE, G7A]);
    // Only the successful launch produced a track.
    expect(r.tracks.length).toBe(1);
    expect(r.tracks[0].tubeId).toBe(1);
  });

  it("the resolver fails closed on a mis-accounted reservation (TORPEDO_STATE_INVARIANT_FAILED)", () => {
    // Reservation accounts only tubes 0,1 but the accepted salvo also fires
    // tube 3 — the resolver must not silently fire an un-accounted tube.
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
    const defense = neutralPolicy({ missionObjective: "DEFENSE" }); // recommendedSize 1
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
    // ATTACK neutral -> recommendedSize 2. tube 0 mechanical failure
    // (successfulLaunchesSoFar 0 < 2) -> continue; tubes 1 and 3 both succeed.
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
    // DEFENSE -> recommendedSize 1. tube 0 succeeds (successfulLaunchesSoFar 1),
    // tube 1 mechanical failure (1 >= 1) -> skip tubes after tube 1.
    const r = resolve({
      salvoPolicy: neutralPolicy({ missionObjective: "DEFENSE" }),
      keyedRng: tubeDraws({ 0: 0.5, 1: 0.005 }),
    });
    expect(r.salvo.recommendedSize).toBe(1);
    expect(r.skippedTubeIds).toEqual([3]);
    expect(r.attempts.map((a) => a.tubeId)).toEqual([0, 1]);
    expect(r.attempts[1].outcome).toBe("TORPEDO_LAUNCH_FAILURE");
    // the mechanical-failure tube is restored
    expect(r.state.loadedPerTube[1]).toBe(G7A);
    // the successful tube stays consumed
    expect(r.state.loadedPerTube[0]).toBe(EMPTY_TUBE);
    // every tube the abort skipped never fired — its atomically-reserved
    // torpedo is restored (kept loaded), never expended.
    expect(r.state.loadedPerTube[3]).toBe(G7A);
    expect(r.tracks.length).toBe(1);
  });

  it("a TORPEDO_STUCK_IN_TUBE tube triggers the abort like a non-stuck failure (stuck tube consumes, later tubes skipped)", () => {
    // DEFENSE -> recommendedSize 1. tube 0 succeeds (successfulLaunchesSoFar 1),
    // then tube 1 STUCK_IN_TUBE (a mechanical failure; 1 >= 1) -> the abort
    // skips every later tube — exactly the continuation rule a non-stuck
    // failure obeys, with the consuming failure outcome. NOTE: a stuck tube
    // cannot abort BEFORE any success (0 < recommendedSize permits
    // continuation): the shipped §12 rule aborts once successfulLaunchesSoFar
    // has reached recommendedSize, so this test pins the stuck-triggered abort
    // at that boundary.
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
    // SUCCESS keeps its tube consumed; STUCK consumes its torpedo too (EMPTY)
    expect(r.state.loadedPerTube[0]).toBe(EMPTY_TUBE);
    expect(r.state.loadedPerTube[1]).toBe(EMPTY_TUBE);
    // the skipped tube never fired — its atomically-reserved torpedo restored
    expect(r.state.loadedPerTube[3]).toBe(G7A);
    // only the successful launch produced a track
    expect(r.tracks.length).toBe(1);
    expect(r.tracks[0].tubeId).toBe(0);
  });

  it("restores the torpedo to every tube the abort skipped (never fired), not just the mechanical-failure tube", () => {
    // DEFENSE -> recommendedSize 1. tube 0 succeeds (successfulLaunchesSoFar 1),
    // tube 1 mechanical failure (1 >= 1) -> skip tubes after tube 1: [3].
    const r = resolve({
      salvoPolicy: neutralPolicy({ missionObjective: "DEFENSE" }),
      keyedRng: tubeDraws({ 0: 0.5, 1: 0.005 }),
    });
    // every skipped tube is STILL LOADED (its torpedo restored, not EMPTY)
    expect(r.skippedTubeIds).toEqual([3]);
    for (const tubeId of r.skippedTubeIds) {
      expect(r.state.loadedPerTube[tubeId]).toBe(G7A);
    }
  });
});
