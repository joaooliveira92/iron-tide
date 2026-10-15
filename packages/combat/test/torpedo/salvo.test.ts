// AC-11: salvo policy (DESIGN-40 §11) — DETERMINISTIC recommendation over the
// nine §11 factors with authored constants (never random), clamped to
// [1, maxTubes]; exact-tube-id validation; launcher-arc enforcement
// (TORPEDO_LAUNCH_ARC_INVALID); ascending-tube selection over LOADED tubes; and
// ATOMIC ammunition reservation through the INC-1 consumeForLaunch (a salvo
// including an EMPTY tube consumes NOTHING).
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  assertSalvoTubesWithinArc,
  EMPTY_TUBE,
  evaluateLaunchEligibility,
  NO_RELOAD_IN_PROGRESS,
  recommendSalvoSize,
  reserveSalvoTorpedoes,
  selectSalvoTubes,
  TORPEDO_AMMUNITION_UNAVAILABLE,
  TORPEDO_LAUNCH_ARC_INVALID,
  TORPEDO_SALVO_BASE_TUBES,
  TORPEDO_STATE_INVARIANT_FAILED,
  validateSalvoTubeSelection,
  withTorpedoLauncherStateHash,
  type TorpedoLauncherState,
  type TorpedoSalvoPolicyInputs,
} from "../../src/torpedoes/index.js";
import { COMPILED_TORPEDOES } from "../fixtures/compiledTorpedoes.js";

const G7A = "ger_533mm_g7a_1934";

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

// A tactically-neutral salvo situation: coverage pressure (>= 3 friendly
// launchers -> 3_000 bp -> +300) is the only non-zero factor, so the
// recommended size equals the base tubes for the mission objective.
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

describe("AC-11: deterministic salvo-size recommendation over the nine §11 factors", () => {
  it("base tubes per mission objective with neutral factors", () => {
    expect(recommendSalvoSize(neutralPolicy(), 4).recommendedSize).toBe(
      TORPEDO_SALVO_BASE_TUBES.ATTACK,
    );
    expect(
      recommendSalvoSize(neutralPolicy({ missionObjective: "DEFENSE" }), 4).recommendedSize,
    ).toBe(TORPEDO_SALVO_BASE_TUBES.DEFENSE);
    expect(
      recommendSalvoSize(neutralPolicy({ missionObjective: "AREA_DENIAL" }), 4).recommendedSize,
    ).toBe(TORPEDO_SALVO_BASE_TUBES.AREA_DENIAL);
    expect(
      recommendSalvoSize(neutralPolicy({ missionObjective: "BREAKTHROUGH" }), 4).recommendedSize,
    ).toBe(TORPEDO_SALVO_BASE_TUBES.BREAKTHROUGH);
  });

  it("WITHDRAWING adds a parting-salvo tube", () => {
    const normal = recommendSalvoSize(neutralPolicy(), 4);
    const withdrawing = recommendSalvoSize(neutralPolicy({ withdrawalState: "WITHDRAWING" }), 4);
    expect(withdrawing.recommendedSize).toBe(normal.recommendedSize + 1);
  });

  it("is DETERMINISTIC: identical inputs produce identical results", () => {
    const a = recommendSalvoSize(neutralPolicy(), 4);
    const b = recommendSalvoSize(neutralPolicy(), 4);
    expect(a).toEqual(b);
  });

  it("high-value / large / long-range / poor-solution factors push MORE tubes", () => {
    const neutral = recommendSalvoSize(neutralPolicy(), 4).recommendedSize;
    const pressured = recommendSalvoSize(
      neutralPolicy({
        targetCombatValueBp: 10_000,
        targetSizeBp: 10_000,
        targetEstimatedRangeM: 15_000, // range-pressure 8_000 bp
        solutionQualityBp: 0, // full quality deficit
      }),
      4,
    ).recommendedSize;
    expect(pressured).toBeGreaterThan(neutral);
    expect(pressured).toBe(4); // clamped at maxTubes
  });

  it("ammo scarcity, friendly coverage, and overkill push FEWER tubes", () => {
    const neutral = recommendSalvoSize(neutralPolicy(), 4).recommendedSize;
    const conserving = recommendSalvoSize(
      neutralPolicy({
        remainingTotalAmmunition: 0, // scarcity 10_000 bp
        overkillEstimateBp: 10_000,
      }),
      4,
    ).recommendedSize;
    expect(conserving).toBeLessThan(neutral);
    expect(conserving).toBe(1); // clamped at the minimum
  });

  it("clamps to [1, maxTubes]", () => {
    expect(
      recommendSalvoSize(neutralPolicy({ missionObjective: "AREA_DENIAL" }), 2).recommendedSize,
    ).toBe(2);
    expect(
      recommendSalvoSize(neutralPolicy({ missionObjective: "DEFENSE" }), 8).recommendedSize,
    ).toBe(1);
  });

  it("reports the exact band lookups in the result", () => {
    const result = recommendSalvoSize(
      neutralPolicy({
        targetEstimatedRangeM: 6_000,
        remainingTotalAmmunition: 3,
        friendlyLauncherCount: 1,
      }),
      4,
    );
    expect(result.band.rangePressureBp).toBe(4_000); // 5_000 < 6_000 <= 8_000
    expect(result.band.ammoScarcityBp).toBe(6_000); // 2 <= 3 < 4
    expect(result.band.friendlyCoveragePressureBp).toBe(7_000); // 1 <= 1 < 2
  });

  it("rejects a non-positive maxTubes", () => {
    expect(() => recommendSalvoSize(neutralPolicy(), 0)).toThrow(BluewaveError);
    expect(() => recommendSalvoSize(neutralPolicy(), 1.5)).toThrow(BluewaveError);
  });

  it("rejects out-of-range or non-integer policy inputs (structured invariant, never a silent NaN)", () => {
    // basis-point fields must be integers within [0, 10_000]
    expect(() => recommendSalvoSize(neutralPolicy({ targetCombatValueBp: 10_001 }), 4)).toThrow(
      BluewaveError,
    );
    expect(() => recommendSalvoSize(neutralPolicy({ targetCombatValueBp: -1 }), 4)).toThrow(
      BluewaveError,
    );
    expect(() => recommendSalvoSize(neutralPolicy({ targetCombatValueBp: 5_000.5 }), 4)).toThrow(
      BluewaveError,
    );
    expect(() => recommendSalvoSize(neutralPolicy({ targetSizeBp: 10_001 }), 4)).toThrow(
      BluewaveError,
    );
    expect(() => recommendSalvoSize(neutralPolicy({ solutionQualityBp: -1 }), 4)).toThrow(
      BluewaveError,
    );
    expect(() => recommendSalvoSize(neutralPolicy({ overkillEstimateBp: 10_001 }), 4)).toThrow(
      BluewaveError,
    );
    // counts must be non-negative integers
    expect(() => recommendSalvoSize(neutralPolicy({ remainingTotalAmmunition: -1 }), 4)).toThrow(
      BluewaveError,
    );
    expect(() => recommendSalvoSize(neutralPolicy({ remainingTotalAmmunition: 2.5 }), 4)).toThrow(
      BluewaveError,
    );
    expect(() => recommendSalvoSize(neutralPolicy({ friendlyLauncherCount: -1 }), 4)).toThrow(
      BluewaveError,
    );
    // range must be a non-negative integer
    expect(() => recommendSalvoSize(neutralPolicy({ targetEstimatedRangeM: 0.5 }), 4)).toThrow(
      BluewaveError,
    );
    // a garbage objective/withdrawal must never index the tables into NaN
    expect(() =>
      recommendSalvoSize(neutralPolicy({ missionObjective: "RANDOM" as never }), 4),
    ).toThrow(BluewaveError);
    expect(() =>
      recommendSalvoSize(neutralPolicy({ withdrawalState: "PANICKING" as never }), 4),
    ).toThrow(BluewaveError);
  });
});

describe("AC-11: exact tube selection + validation", () => {
  it("validateSalvoTubeSelection rejects duplicates, out-of-range, empty, and over-capacity salvoes", () => {
    expect(() => validateSalvoTubeSelection([0, 0], 4)).toThrow(BluewaveError);
    expect(() => validateSalvoTubeSelection([9], 4)).toThrow(BluewaveError);
    expect(() => validateSalvoTubeSelection([], 4)).toThrow(BluewaveError);
    expect(() => validateSalvoTubeSelection([0, 1, 2, 3, 4], 4)).toThrow(BluewaveError);
    expect(() => validateSalvoTubeSelection([0.5], 4)).toThrow(BluewaveError);
    expect(() => validateSalvoTubeSelection([0], 0)).toThrow(BluewaveError);
    expect(() => validateSalvoTubeSelection([0, 1], 4)).not.toThrow();
  });

  it("selectSalvoTubes picks LOADED tubes in ascending tube-id order (§12 order)", () => {
    const state = launcher(); // tubes: [G7A, G7A, EMPTY, G7A]
    expect(selectSalvoTubes(state, 2)).toEqual([0, 1]);
    expect(selectSalvoTubes(state, 4)).toEqual([0, 1, 3]); // only 3 loaded tubes exist
    expect(selectSalvoTubes(state, 1)).toEqual([0]);
  });

  it("assertSalvoTubesWithinArc fails with TORPEDO_LAUNCH_ARC_INVALID outside the training limits", () => {
    const state = launcher(); // training limits [-45_000, 45_000]
    expect(() => assertSalvoTubesWithinArc(state, [0, 1], 45_000)).not.toThrow();
    expect(() => assertSalvoTubesWithinArc(state, [0, 1], 45_001)).toThrow(BluewaveError);
    let err: BluewaveError | undefined;
    try {
      assertSalvoTubesWithinArc(state, [0], -45_001);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_LAUNCH_ARC_INVALID);
  });
});

describe("AC-11: atomic salvo ammunition reservation (reuses INC-1 consumeForLaunch)", () => {
  it("reserves exactly one torpedo per selected tube and empties them", () => {
    const state = launcher();
    const before = state.stateHash;
    const result = reserveSalvoTorpedoes(state, [0, 1, 3]);
    expect(result.state.loadedPerTube).toEqual([EMPTY_TUBE, EMPTY_TUBE, EMPTY_TUBE, EMPTY_TUBE]);
    expect(result.accounts.map((a) => a.tubeIndex)).toEqual([0, 1, 3]);
    expect(result.accounts[0].after).toBe(EMPTY_TUBE);
    expect(state.loadedPerTube[0]).toBe(G7A); // the input state is untouched (immutable)
    expect(state.stateHash).toBe(before);
  });

  it("a salvo including an EMPTY tube is atomic: consumes NOTHING (TORPEDO_AMMUNITION_UNAVAILABLE)", () => {
    const state = launcher(); // tube 2 is EMPTY
    const beforeHash = state.stateHash;
    let err: BluewaveError | undefined;
    try {
      reserveSalvoTorpedoes(state, [0, 2]);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_AMMUNITION_UNAVAILABLE);
    expect(state.loadedPerTube).toEqual([G7A, G7A, EMPTY_TUBE, G7A]); // NOTHING consumed
    expect(state.stateHash).toBe(beforeHash);
  });

  it("policy -> selection -> reservation is one coherent path (integration)", () => {
    const state = launcher();
    const policy = recommendSalvoSize(neutralPolicy(), state.tubeCount);
    const tubes = selectSalvoTubes(state, policy.recommendedSize);
    expect(tubes.length).toBe(policy.recommendedSize);
    const result = reserveSalvoTorpedoes(state, tubes);
    for (const account of result.accounts) {
      expect(account.after).toBe(EMPTY_TUBE);
    }
  });

  it("structural violations fail with TORPEDO_STATE_INVARIANT_FAILED (never a raw error)", () => {
    let err: BluewaveError | undefined;
    try {
      reserveSalvoTorpedoes(launcher(), [0, 0]);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
  });
});

// The eligibility aggregate accepts a salvo tube selection; a duplicate index
// (which the salvo layer rejects) is also rejected by eligibility's input guard.
describe("AC-11 seam: the eligibility aggregate validates the salvo tube indexes", () => {
  it("duplicate tube indexes in a launch fail closed", () => {
    expect(() =>
      evaluateLaunchEligibility({
        torpedoes: COMPILED_TORPEDOES,
        state: launcher(),
        definition: {
          launcherFamilyId: "533mm_underwater_trainable",
          mountType: "UNDERWATER_TRAINABLE",
          tubeCount: 4,
          boreDiameterMm: 533,
          handlingMassLimitKg: 1_600,
          supportedPropulsionTypes: ["WET_HEATER"],
          fireControlSupportedGuidance: ["gyro"],
          underwaterLaunchCapability: true,
          requiredReloadTimeMs: 120_000,
          aboveWaterMaxLaunchSpeedKnots: null,
        },
        tubeIndexes: [0, 0],
        authorityGrant: {
          grantId: "G",
          platformId: "SHIP-ALPHA",
          mode: "CAPTAIN",
          policyId: "torpedo_launch_authority_v1",
        },
        manualLaunch: false,
        contactId: "C1",
        knownTracks: [],
        friendlyIdentities: [],
        targetRelativeBearingMdeg: 0,
        targetEstimatedRangeM: 5_000,
        selectedSetting: { settingId: "30kn", speedMilliKnots: 30_000, rangeM: 14_000 },
        launchKind: "AUTOMATED",
        fireSolutionQualityBp: 6_000,
        ownSpeedMicrometresPerSecond: 12_000_000,
        ownManeuverWithinFireControlLimit: true,
        seaState: 4,
        friendlyTracks: [],
        solutionUncertaintyM: 0,
        spreadHalfAngleMdeg: 0,
      }),
    ).toThrow(BluewaveError);
  });
});
