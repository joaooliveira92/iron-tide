import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { TACTICAL_FOG_OF_WAR_VIOLATION } from "../../src/reasonCodes.js";
import {
  ammunitionReservationSucceeds,
  armingDistanceSatisfiable,
  assessFriendlyFireRisk,
  EMPTY_TUBE,
  evaluateLaunchEligibility,
  fireSolutionQualitySufficient,
  friendlyFireSafetyVerdict,
  INVALID_TORPEDO_LAUNCHER_STATE,
  launcherAndTubesOperational,
  NO_RELOAD_IN_PROGRESS,
  ownSpeedWithinLauncherLimits,
  reloadAndSafetyInterlocksComplete,
  seaStatePermitsLaunch,
  targetContactConfidenceSufficient,
  targetNotIdentifiedFriendly,
  targetRangeWithinSetting,
  targetWithinLaunchArc,
  torpedoLaunchAuthorityPolicyId,
  TORPEDO_AMMUNITION_UNAVAILABLE,
  TORPEDO_FIRE_SOLUTION_INSUFFICIENT,
  TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED,
  TORPEDO_LAUNCH_ARC_INVALID,
  TORPEDO_LAUNCH_AUTHORITY_DENIED,
  TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED,
  TORPEDO_MODEL_INCOMPATIBLE,
  TORPEDO_TARGET_CONTACT_INSUFFICIENT,
  tubesCarryCompatibleTorpedoes,
  UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
  withTorpedoLauncherStateHash,
  type AuthorityGrant,
  type FriendlyTrack,
  type LaunchEligibilityInputs,
  type TorpedoLauncherDefinition,
  type TorpedoLauncherState,
} from "../../src/torpedoes/index.js";
import { COMPILED_TORPEDOES, compiledTorpedoOf } from "../fixtures/compiledTorpedoes.js";
import type { ContactTrack } from "../../src/targeting.js";

const G7A = "ger_533mm_g7a_1934";
const G7E = "ger_533mm_g7e_1936";
const G7A_30KN = { settingId: "30kn", speedMilliKnots: 30_000, rangeM: 14_000 };

function baseLauncher(overrides: Partial<TorpedoLauncherState> = {}): TorpedoLauncherState {
  const surface: Omit<TorpedoLauncherState, "stateHash"> = {
    launcherId: "LCH-1",
    ownerPlatformId: "SHIP-ALPHA",
    launcherFamilyId: "533mm_underwater_trainable",
    mountPosition: "port_amidships",
    mountType: "UNDERWATER_TRAINABLE",
    tubeCount: 4,
    loadedPerTube: [G7A, G7A, EMPTY_TUBE, G7A],
    reserveAmmunition: { [G7A]: 6, [G7E]: 3 },
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

function launcher533(
  overrides: Partial<TorpedoLauncherDefinition> = {},
): TorpedoLauncherDefinition {
  return {
    launcherFamilyId: "533mm_underwater_trainable",
    mountType: "UNDERWATER_TRAINABLE",
    tubeCount: 4,
    boreDiameterMm: 533,
    handlingMassLimitKg: 1_600,
    supportedPropulsionTypes: ["WET_HEATER", "ELECTRIC"],
    fireControlSupportedGuidance: ["gyro"],
    underwaterLaunchCapability: true,
    requiredReloadTimeMs: 120_000,
    aboveWaterMaxLaunchSpeedKnots: null,
    ...overrides,
  };
}

function aboveWaterLauncher(): TorpedoLauncherDefinition {
  return launcher533({
    launcherFamilyId: "533mm_above_water_trainable",
    mountType: "ABOVE_WATER_TRAINABLE",
    underwaterLaunchCapability: false,
  });
}

function aboveWaterState(): TorpedoLauncherState {
  return baseLauncher({
    launcherFamilyId: "533mm_above_water_trainable",
    mountType: "ABOVE_WATER_TRAINABLE",
    underwaterLaunchCapability: false,
  });
}

function track(overrides: Partial<ContactTrack> = {}): ContactTrack {
  return {
    contactId: "CONTACT-1",
    estimatedIdentity: "ger_ca_admiral_hipper",
    position: [0, 0],
    course: 90,
    speed: 10_000,
    confidence: 5_000,
    observationTime: "T+0",
    source: "lookout",
    uncertainty: 1_000,
    ...overrides,
  };
}

function grant(overrides: Partial<AuthorityGrant> = {}): AuthorityGrant {
  return {
    grantId: "GRANT-1",
    platformId: "SHIP-ALPHA",
    mode: "CAPTAIN",
    policyId: torpedoLaunchAuthorityPolicyId,
    ...overrides,
  };
}

function friendlyTrack(overrides: Partial<FriendlyTrack> = {}): FriendlyTrack {
  return {
    contactId: "FRIEND-1",
    estimatedIdentity: "rn_cl_arethusa",
    relativeBearingMdeg: 0,
    rangeM: 5_000,
    confidenceBp: 5_000,
    ...overrides,
  };
}

function inputs(overrides: Partial<LaunchEligibilityInputs> = {}): LaunchEligibilityInputs {
  return {
    state: baseLauncher(),
    definition: launcher533(),
    tubeIndexes: [0],
    authorityGrant: grant(),
    manualLaunch: false,
    contactId: "CONTACT-1",
    knownTracks: new Map([["CONTACT-1", track()]]),
    friendlyIdentities: ["rn_cl_arethusa", "rn_dd_amazon"],
    targetRelativeBearingMdeg: 0,
    targetEstimatedRangeM: 5_000,
    selectedSetting: G7A_30KN,
    torpedoes: COMPILED_TORPEDOES,
    launchKind: "AUTOMATED",
    fireSolutionQualityBp: 6_000,
    ownSpeedMicrometresPerSecond: 12_000_000,
    ownManeuverWithinFireControlLimit: true,
    seaState: 4,
    friendlyTracks: [],
    solutionUncertaintyM: 0,
    spreadHalfAngleMdeg: 0,
    ...overrides,
  };
}

describe("AC-6: a fully-eligible launch passes every §6 predicate", () => {
  it("returns eligible with every predicate a plain boolean true, no torpedo consumed", () => {
    const verdict = evaluateLaunchEligibility(inputs());
    expect(verdict.eligible).toBe(true);
    expect(verdict.failingPredicate).toBeNull();
    expect(verdict.reasonCode).toBeNull();
    expect(verdict.consumedTorpedo).toBe(false);
    for (const [predicate, result] of Object.entries(verdict.predicateResults)) {
      expect(result).toBe(true);
      void predicate;
    }
  });

  it("never mutates the authoritative state (immutable inputs)", () => {
    const state = baseLauncher();
    const before = state.stateHash;
    const verdict = evaluateLaunchEligibility(inputs({ state }));
    expect(verdict.eligible).toBe(true);
    expect(state.loadedPerTube).toEqual([G7A, G7A, EMPTY_TUBE, G7A]);
    expect(state.reserveAmmunition).toEqual({ [G7A]: 6, [G7E]: 3 });
    expect(state.stateHash).toBe(before);
  });
});

describe("AC-6: every §6 predicate fails with EXACTLY one explicit reason code and consumes NO torpedo", () => {
  it("authority: no grant -> TORPEDO_LAUNCH_AUTHORITY_DENIED", () => {
    const verdict = evaluateLaunchEligibility(inputs({ authorityGrant: null }));
    expect(verdict.eligible).toBe(false);
    expect(verdict.failingPredicate).toBe("authority");
    expect(verdict.reasonCode).toBe(TORPEDO_LAUNCH_AUTHORITY_DENIED);
    expect(verdict.consumedTorpedo).toBe(false);
  });

  it("authority: manual launch in ADMIRAL mode -> TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED", () => {
    const verdict = evaluateLaunchEligibility(
      inputs({ authorityGrant: grant({ mode: "ADMIRAL" }), manualLaunch: true }),
    );
    expect(verdict.failingPredicate).toBe("authority");
    expect(verdict.reasonCode).toBe(TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED);
  });

  it("launcher and tubes operational: a damaged launcher -> INVALID_TORPEDO_LAUNCHER_STATE", () => {
    const verdict = evaluateLaunchEligibility(
      inputs({ state: baseLauncher({ damageState: "DAMAGED" }) }),
    );
    expect(verdict.failingPredicate).toBe("launcherAndTubesOperational");
    expect(verdict.reasonCode).toBe(INVALID_TORPEDO_LAUNCHER_STATE);
  });

  it("compatible torpedoes loaded: an EMPTY selected tube -> TORPEDO_AMMUNITION_UNAVAILABLE", () => {
    const verdict = evaluateLaunchEligibility(inputs({ tubeIndexes: [2] }));
    expect(verdict.failingPredicate).toBe("compatibleTorpedoesLoaded");
    expect(verdict.reasonCode).toBe(TORPEDO_AMMUNITION_UNAVAILABLE);
    expect(verdict.predicateResults.ammunitionReservation).toBe(false);
  });

  it("compatible torpedoes loaded: a model the launcher family never declares -> TORPEDO_MODEL_INCOMPATIBLE", () => {
    const state = baseLauncher({ loadedPerTube: [G7E, G7A, EMPTY_TUBE, G7A] });
    const verdict = evaluateLaunchEligibility(inputs({ state, tubeIndexes: [0] }));
    expect(verdict.failingPredicate).toBe("compatibleTorpedoesLoaded");
    expect(verdict.reasonCode).toBe(TORPEDO_MODEL_INCOMPATIBLE);
  });

  it("reload and safety interlocks: reload in progress -> INVALID_TORPEDO_LAUNCHER_STATE", () => {
    const state = baseLauncher({
      reloadState: {
        status: "RELOAD_IN_PROGRESS",
        tubeIndex: 2,
        modelId: G7A,
        requiredReloadTimeMs: 120_000,
        progressMs: 0,
      },
    });
    const verdict = evaluateLaunchEligibility(inputs({ state }));
    expect(verdict.failingPredicate).toBe("reloadAndSafetyInterlocks");
    expect(verdict.reasonCode).toBe(INVALID_TORPEDO_LAUNCHER_STATE);
  });

  it("reload and safety interlocks: a disconnected fire-control connection blocks the launch", () => {
    const verdict = evaluateLaunchEligibility(
      inputs({ state: baseLauncher({ fireControlConnectionState: "DISCONNECTED" }) }),
    );
    expect(verdict.failingPredicate).toBe("reloadAndSafetyInterlocks");
    expect(verdict.reasonCode).toBe(INVALID_TORPEDO_LAUNCHER_STATE);
  });

  it("reload and safety interlocks: failed flooding isolation blocks the launch", () => {
    const verdict = evaluateLaunchEligibility(
      inputs({ state: baseLauncher({ floodingIsolationState: "FAILED" }) }),
    );
    expect(verdict.failingPredicate).toBe("reloadAndSafetyInterlocks");
    expect(verdict.reasonCode).toBe(INVALID_TORPEDO_LAUNCHER_STATE);
  });

  it("target contact confidence: known contact below 4_000 bp -> TORPEDO_TARGET_CONTACT_INSUFFICIENT", () => {
    const knownTracks = new Map([["CONTACT-1", track({ confidence: 3_999 })]]);
    const verdict = evaluateLaunchEligibility(inputs({ knownTracks }));
    expect(verdict.failingPredicate).toBe("targetContactConfidence");
    expect(verdict.reasonCode).toBe(TORPEDO_TARGET_CONTACT_INSUFFICIENT);
  });

  it("fog gate: an unknown contact throws the reused TACTICAL_FOG_OF_WAR_VIOLATION", () => {
    let err: BluewaveError | undefined;
    try {
      evaluateLaunchEligibility(inputs({ contactId: "GHOST" }));
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TACTICAL_FOG_OF_WAR_VIOLATION);
  });

  it("fog gate: a zero-confidence contact throws the reused TACTICAL_FOG_OF_WAR_VIOLATION", () => {
    const knownTracks = new Map([["CONTACT-1", track({ confidence: 0 })]]);
    let err: BluewaveError | undefined;
    try {
      evaluateLaunchEligibility(inputs({ knownTracks }));
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TACTICAL_FOG_OF_WAR_VIOLATION);
  });

  it("target not friendly: a confirmed-friendly target reports the §24 family code TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED", () => {
    const knownTracks = new Map([["CONTACT-1", track({ estimatedIdentity: "rn_cl_arethusa" })]]);
    const verdict = evaluateLaunchEligibility(inputs({ knownTracks }));
    expect(verdict.failingPredicate).toBe("targetNotFriendly");
    expect(verdict.reasonCode).toBe(TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED);
    expect(verdict.predicateResults.targetNotFriendly).toBe(false);
    expect(verdict.predicateResults.friendlyFireSafety).toBe(true);
  });

  it("friendly-fire safety: a confirmed friendly inside the danger sector below 1_000 m predicted separation is PROHIBITED", () => {
    const verdict = evaluateLaunchEligibility(
      inputs({
        friendlyTracks: [friendlyTrack({ relativeBearingMdeg: 0, rangeM: 5_000 })],
        fireSolutionQualityBp: 7_500,
      }),
    );
    expect(verdict.failingPredicate).toBe("friendlyFireSafety");
    expect(verdict.reasonCode).toBe(TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED);
    expect(verdict.predicateResults.friendlyFireSafety).toBe(false);
  });

  it("friendly-fire safety: manual launch does NOT waive the §24 prohibition", () => {
    const verdict = evaluateLaunchEligibility(
      inputs({
        manualLaunch: true,
        friendlyTracks: [friendlyTrack({ relativeBearingMdeg: 0, rangeM: 5_000 })],
        fireSolutionQualityBp: 7_500,
      }),
    );
    expect(verdict.failingPredicate).toBe("friendlyFireSafety");
    expect(verdict.reasonCode).toBe(TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED);
  });

  it("predicate order: with a friendly in the sector AND low quality, predicate 10 (quality) fires FIRST per §6 order", () => {
    const verdict = evaluateLaunchEligibility(
      inputs({
        friendlyTracks: [friendlyTrack({ relativeBearingMdeg: 0, rangeM: 5_000 })],
        fireSolutionQualityBp: 7_499,
      }),
    );
    expect(verdict.failingPredicate).toBe("fireSolutionQuality");
    expect(verdict.reasonCode).toBe(TORPEDO_FIRE_SOLUTION_INSUFFICIENT);
    expect(verdict.predicateResults.friendlyFireSafety).toBe(true);
  });

  it("friendly-fire safety: a confirmed friendly inside the sector at exactly 1_000 m predicted separation is NOT prohibited", () => {
    const verdict = evaluateLaunchEligibility(
      inputs({
        friendlyTracks: [friendlyTrack({ relativeBearingMdeg: 5_000, rangeM: 11_460 })],
        spreadHalfAngleMdeg: 6_000,
        targetEstimatedRangeM: 11_460,
        selectedSetting: { settingId: "30kn", speedMilliKnots: 30_000, rangeM: 14_000 },
        fireSolutionQualityBp: 7_500,
      }),
    );
    expect(verdict.eligible).toBe(true);
    expect(verdict.predicateResults.friendlyFireSafety).toBe(true);
  });

  it("fire solution: a friendly in the danger sector raises the §10 minimum to 7_500 bp", () => {
    const friendlyTracks = [
      friendlyTrack({
        contactId: "GHOST-1",
        estimatedIdentity: "UNIDENTIFIED",
        relativeBearingMdeg: 500,
        rangeM: 4_000,
      }),
    ];
    const below = evaluateLaunchEligibility(
      inputs({ friendlyTracks, spreadHalfAngleMdeg: 1_000, fireSolutionQualityBp: 7_499 }),
    );
    expect(below.failingPredicate).toBe("fireSolutionQuality");
    expect(below.reasonCode).toBe(TORPEDO_FIRE_SOLUTION_INSUFFICIENT);
    const at = evaluateLaunchEligibility(
      inputs({ friendlyTracks, spreadHalfAngleMdeg: 1_000, fireSolutionQualityBp: 7_500 }),
    );
    expect(at.eligible).toBe(true);
  });

  it("fire solution: a confirmed friendly in the sector raises the §10 minimum even when NOT prohibited", () => {
    const friendlyTracks = [friendlyTrack({ relativeBearingMdeg: 5_000, rangeM: 12_000 })];
    const below = evaluateLaunchEligibility(
      inputs({ friendlyTracks, spreadHalfAngleMdeg: 6_000, fireSolutionQualityBp: 7_499 }),
    );
    expect(below.failingPredicate).toBe("fireSolutionQuality");
    expect(below.reasonCode).toBe(TORPEDO_FIRE_SOLUTION_INSUFFICIENT);
    expect(below.predicateResults.friendlyFireSafety).toBe(true);
  });

  it("fire solution: a track outside the danger sector neither raises the minimum nor prohibits", () => {
    const friendlyTracks = [
      friendlyTrack({ relativeBearingMdeg: 45_000, rangeM: 5_000, confidenceBp: 1_000 }),
    ];
    const verdict = evaluateLaunchEligibility(
      inputs({ friendlyTracks, spreadHalfAngleMdeg: 1_000, fireSolutionQualityBp: 4_999 }),
    );
    expect(verdict.failingPredicate).toBe("fireSolutionQuality");
    expect(verdict.predicateResults.friendlyFireSafety).toBe(true);
  });

  it("launch arc: bearing outside the training limits -> TORPEDO_LAUNCH_ARC_INVALID", () => {
    const verdict = evaluateLaunchEligibility(inputs({ targetRelativeBearingMdeg: 45_001 }));
    expect(verdict.failingPredicate).toBe("launchArc");
    expect(verdict.reasonCode).toBe(TORPEDO_LAUNCH_ARC_INVALID);
  });

  it("range within setting: beyond the selected setting's maximum run -> TORPEDO_TARGET_CONTACT_INSUFFICIENT", () => {
    const verdict = evaluateLaunchEligibility(inputs({ targetEstimatedRangeM: 14_001 }));
    expect(verdict.failingPredicate).toBe("rangeWithinSetting");
    expect(verdict.reasonCode).toBe(TORPEDO_TARGET_CONTACT_INSUFFICIENT);
  });

  it("arming distance: a target closer than the model's minimum arming distance cannot be engaged", () => {
    const verdict = evaluateLaunchEligibility(inputs({ targetEstimatedRangeM: 149 }));
    expect(verdict.failingPredicate).toBe("armingDistanceSatisfiable");
    expect(verdict.reasonCode).toBe(TORPEDO_TARGET_CONTACT_INSUFFICIENT);
  });

  it("fire solution: below the §10 minimum for the launch kind -> TORPEDO_FIRE_SOLUTION_INSUFFICIENT", () => {
    const verdict = evaluateLaunchEligibility(
      inputs({ launchKind: "AUTOMATED", fireSolutionQualityBp: 4_999 }),
    );
    expect(verdict.failingPredicate).toBe("fireSolutionQuality");
    expect(verdict.reasonCode).toBe(TORPEDO_FIRE_SOLUTION_INSUFFICIENT);
  });

  it("own speed: above 25 kn on an underwater tube -> UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED", () => {
    const verdict = evaluateLaunchEligibility(inputs({ ownSpeedMicrometresPerSecond: 12_861_101 }));
    expect(verdict.failingPredicate).toBe("ownSpeedWithinLauncherLimits");
    expect(verdict.reasonCode).toBe(UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED);
  });

  it("own speed: above the resolved §8 limit on an above-water mount fails the same predicate", () => {
    const verdict = evaluateLaunchEligibility(
      inputs({
        state: aboveWaterState(),
        definition: aboveWaterLauncher(),
        ownSpeedMicrometresPerSecond: 18_005_541,
      }),
    );
    expect(verdict.failingPredicate).toBe("ownSpeedWithinLauncherLimits");
    expect(verdict.reasonCode).toBe(UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED);
  });

  it("own speed: exactly 35 kn on an above-water trainable mount is legal", () => {
    const verdict = evaluateLaunchEligibility(
      inputs({
        state: aboveWaterState(),
        definition: aboveWaterLauncher(),
        ownSpeedMicrometresPerSecond: 18_005_540,
      }),
    );
    expect(verdict.eligible).toBe(true);
  });

  it("own maneuver: a fire-control-limit violation -> TORPEDO_FIRE_SOLUTION_INSUFFICIENT (§9 input)", () => {
    const verdict = evaluateLaunchEligibility(inputs({ ownManeuverWithinFireControlLimit: false }));
    expect(verdict.failingPredicate).toBe("ownManeuverWithinFireControlLimit");
    expect(verdict.reasonCode).toBe(TORPEDO_FIRE_SOLUTION_INSUFFICIENT);
  });

  it("sea state: above the authored §6 ceiling -> TORPEDO_FIRE_SOLUTION_INSUFFICIENT (§9 input)", () => {
    const verdict = evaluateLaunchEligibility(inputs({ seaState: 6 }));
    expect(verdict.failingPredicate).toBe("seaStatePermitsLaunch");
    expect(verdict.reasonCode).toBe(TORPEDO_FIRE_SOLUTION_INSUFFICIENT);
  });

  it("every failed verdict reports consumedTorpedo false — the state is never touched", () => {
    for (const broken of [
      { authorityGrant: null },
      { ownSpeedMicrometresPerSecond: 12_861_101 },
      { seaState: 6 },
      { targetRelativeBearingMdeg: 45_001 },
      { tubeIndexes: [2] },
    ]) {
      const verdict = evaluateLaunchEligibility(inputs(broken));
      expect(verdict.consumedTorpedo).toBe(false);
      expect(verdict.reasonCode).toBeTruthy();
      expect(verdict.failingPredicate).toBeTruthy();
    }
  });
});

describe("AC-6: structurally-invalid inputs fail closed (TORPEDO_STATE_INVARIANT_FAILED)", () => {
  it("rejects an out-of-range or non-integer tube index", () => {
    expect(() => evaluateLaunchEligibility(inputs({ tubeIndexes: [9] }))).toThrow(BluewaveError);
    expect(() => evaluateLaunchEligibility(inputs({ tubeIndexes: [1.5] }))).toThrow(BluewaveError);
    expect(() => evaluateLaunchEligibility(inputs({ tubeIndexes: [] }))).toThrow(BluewaveError);
  });

  it("rejects a non-integer speed, bearing, range, quality, or out-of-scale sea state", () => {
    expect(() =>
      evaluateLaunchEligibility(inputs({ ownSpeedMicrometresPerSecond: 12_861_100.5 })),
    ).toThrow(BluewaveError);
    expect(() => evaluateLaunchEligibility(inputs({ targetRelativeBearingMdeg: 0.5 }))).toThrow(
      BluewaveError,
    );
    expect(() => evaluateLaunchEligibility(inputs({ targetEstimatedRangeM: -1 }))).toThrow(
      BluewaveError,
    );
    expect(() => evaluateLaunchEligibility(inputs({ fireSolutionQualityBp: 10_001 }))).toThrow(
      BluewaveError,
    );
    expect(() => evaluateLaunchEligibility(inputs({ seaState: 10 }))).toThrow(BluewaveError);
    expect(() => evaluateLaunchEligibility(inputs({ seaState: -1 }))).toThrow(BluewaveError);
  });

  it("rejects a definition whose family does not match the state", () => {
    expect(() =>
      evaluateLaunchEligibility(
        inputs({ definition: launcher533({ launcherFamilyId: "61cm_x" }) }),
      ),
    ).toThrow(BluewaveError);
  });
});

describe("AC-6: shape-guards fail closed — never a raw TypeError (hardening item 2)", () => {
  it("rejects duplicate tube indexes (a tube may be fired at most once per launch)", () => {
    expect(() => evaluateLaunchEligibility(inputs({ tubeIndexes: [0, 0] }))).toThrow(BluewaveError);
  });

  it("rejects a missing or non-string contactId", () => {
    expect(() => evaluateLaunchEligibility(inputs({ contactId: "" }))).toThrow(BluewaveError);
    expect(() => evaluateLaunchEligibility(inputs({ contactId: 42 as never }))).toThrow(
      BluewaveError,
    );
  });

  it("rejects a malformed knownTracks surface (neither Map nor track array)", () => {
    expect(() => evaluateLaunchEligibility(inputs({ knownTracks: 42 as never }))).toThrow(
      BluewaveError,
    );
    expect(() => evaluateLaunchEligibility(inputs({ knownTracks: [null] as never }))).toThrow(
      BluewaveError,
    );
  });

  it("rejects a malformed friendlyIdentities surface", () => {
    expect(() =>
      evaluateLaunchEligibility(inputs({ friendlyIdentities: "rn_cl_arethusa" as never })),
    ).toThrow(BluewaveError);
    expect(() => evaluateLaunchEligibility(inputs({ friendlyIdentities: [42] as never }))).toThrow(
      BluewaveError,
    );
  });

  it("rejects a malformed friendlyTracks surface (non-array, bad bearing/range/confidence)", () => {
    expect(() => evaluateLaunchEligibility(inputs({ friendlyTracks: 42 as never }))).toThrow(
      BluewaveError,
    );
    expect(() => evaluateLaunchEligibility(inputs({ friendlyTracks: [null] as never }))).toThrow(
      BluewaveError,
    );
    expect(() =>
      evaluateLaunchEligibility(
        inputs({ friendlyTracks: [friendlyTrack({ relativeBearingMdeg: 0.5 })] }),
      ),
    ).toThrow(BluewaveError);
    expect(() =>
      evaluateLaunchEligibility(inputs({ friendlyTracks: [friendlyTrack({ rangeM: -1 })] })),
    ).toThrow(BluewaveError);
    expect(() =>
      evaluateLaunchEligibility(
        inputs({ friendlyTracks: [friendlyTrack({ confidenceBp: 10_001 })] }),
      ),
    ).toThrow(BluewaveError);
  });

  it("rejects non-integer solutionUncertaintyM or spreadHalfAngleMdeg", () => {
    expect(() => evaluateLaunchEligibility(inputs({ solutionUncertaintyM: 0.5 }))).toThrow(
      BluewaveError,
    );
    expect(() => evaluateLaunchEligibility(inputs({ solutionUncertaintyM: -1 }))).toThrow(
      BluewaveError,
    );
    expect(() => evaluateLaunchEligibility(inputs({ spreadHalfAngleMdeg: 0.5 }))).toThrow(
      BluewaveError,
    );
    expect(() => evaluateLaunchEligibility(inputs({ spreadHalfAngleMdeg: -1 }))).toThrow(
      BluewaveError,
    );
  });

  it("rejects a malformed selectedSetting surface (missing range, non-integer speed, empty id)", () => {
    expect(() =>
      evaluateLaunchEligibility(
        inputs({ selectedSetting: { settingId: "30kn", speedMilliKnots: 30_000 } as never }),
      ),
    ).toThrow(BluewaveError);
    expect(() =>
      evaluateLaunchEligibility(
        inputs({
          selectedSetting: {
            settingId: "30kn",
            speedMilliKnots: 30_000.5,
            rangeM: 14_000,
          } as never,
        }),
      ),
    ).toThrow(BluewaveError);
    expect(() =>
      evaluateLaunchEligibility(
        inputs({
          selectedSetting: { settingId: "", speedMilliKnots: 30_000, rangeM: 14_000 } as never,
        }),
      ),
    ).toThrow(BluewaveError);
  });
});

describe("AC-6: per-predicate functions (boundary cases)", () => {
  it("contact confidence gate: 4_000 bp is legal, 3_999 is not", () => {
    expect(targetContactConfidenceSufficient(track({ confidence: 4_000 }))).toBe(true);
    expect(targetContactConfidenceSufficient(track({ confidence: 3_999 }))).toBe(false);
  });

  it("launch arc: training-limit boundaries are inclusive", () => {
    const state = baseLauncher();
    expect(targetWithinLaunchArc(state, -45_000)).toBe(true);
    expect(targetWithinLaunchArc(state, 45_000)).toBe(true);
    expect(targetWithinLaunchArc(state, -45_001)).toBe(false);
    expect(targetWithinLaunchArc(state, 45_001)).toBe(false);
  });

  it("range within setting: the setting maximum is inclusive", () => {
    expect(targetRangeWithinSetting(14_000, G7A_30KN)).toBe(true);
    expect(targetRangeWithinSetting(14_001, G7A_30KN)).toBe(false);
  });

  it("arming distance: exactly the minimum arming distance is satisfiable", () => {
    const g7a = compiledTorpedoOf(G7A);
    expect(armingDistanceSatisfiable(150, [g7a])).toBe(true);
    expect(armingDistanceSatisfiable(149, [g7a])).toBe(false);
    const g7e = compiledTorpedoOf(G7E);
    expect(armingDistanceSatisfiable(150, [g7a, g7e])).toBe(true);
  });

  it("fire-solution thresholds per §10 launch kind (boundaries inclusive)", () => {
    expect(fireSolutionQualitySufficient(5_000, "AUTOMATED")).toBe(true);
    expect(fireSolutionQualitySufficient(4_999, "AUTOMATED")).toBe(false);
    expect(fireSolutionQualitySufficient(4_000, "MANUAL_CAPTAIN")).toBe(true);
    expect(fireSolutionQualitySufficient(3_999, "MANUAL_CAPTAIN")).toBe(false);
    expect(fireSolutionQualitySufficient(3_000, "AREA_DENIAL")).toBe(true);
    expect(fireSolutionQualitySufficient(3_000, "SPREAD")).toBe(true);
    expect(fireSolutionQualitySufficient(2_999, "SPREAD")).toBe(false);
  });

  it("fire-solution thresholds: the §24 friendly-danger-sector raise applies to EVERY launch kind", () => {
    expect(fireSolutionQualitySufficient(7_499, "AUTOMATED", true)).toBe(false);
    expect(fireSolutionQualitySufficient(7_500, "AUTOMATED", true)).toBe(true);
    expect(fireSolutionQualitySufficient(7_499, "AREA_DENIAL", true)).toBe(false);
    expect(fireSolutionQualitySufficient(7_500, "AREA_DENIAL", true)).toBe(true);
    expect(fireSolutionQualitySufficient(3_000, "AREA_DENIAL", false)).toBe(true);
  });

  it("sea-state gate: the authored ceiling 5 permits, 6 does not", () => {
    expect(seaStatePermitsLaunch(5)).toBe(true);
    expect(seaStatePermitsLaunch(6)).toBe(false);
  });

  it("interlocks: reload, fire-control, and isolation gates each fail independently", () => {
    expect(reloadAndSafetyInterlocksComplete(baseLauncher())).toBe(true);
    expect(
      reloadAndSafetyInterlocksComplete(
        baseLauncher({
          reloadState: {
            status: "RELOAD_IN_PROGRESS",
            tubeIndex: 2,
            modelId: G7A,
            requiredReloadTimeMs: 120_000,
            progressMs: 0,
          },
        }),
      ),
    ).toBe(false);
    expect(
      reloadAndSafetyInterlocksComplete(baseLauncher({ fireControlConnectionState: "DEGRADED" })),
    ).toBe(false);
    expect(
      reloadAndSafetyInterlocksComplete(baseLauncher({ floodingIsolationState: "FAILED" })),
    ).toBe(false);
  });

  it("mechanical load compatibility + ammunition reservation", () => {
    const state = baseLauncher();
    expect(launcherAndTubesOperational(state)).toBe(true);
    expect(launcherAndTubesOperational(baseLauncher({ damageState: "DESTROYED" }))).toBe(false);
    expect(tubesCarryCompatibleTorpedoes(state, launcher533(), [0, 3], COMPILED_TORPEDOES)).toBe(
      true,
    );
    expect(tubesCarryCompatibleTorpedoes(state, launcher533(), [2], COMPILED_TORPEDOES)).toBe(
      false,
    );
    expect(
      tubesCarryCompatibleTorpedoes(
        baseLauncher({ loadedPerTube: [G7E, G7A, EMPTY_TUBE, G7A] }),
        launcher533(),
        [0],
        COMPILED_TORPEDOES,
      ),
    ).toBe(false);
    expect(ammunitionReservationSucceeds(state, [0, 3])).toBe(true);
    expect(ammunitionReservationSucceeds(state, [2])).toBe(false);
  });

  it("targetNotIdentifiedFriendly: an unidentified identity is not *identified* friendly", () => {
    const friendly = ["rn_cl_arethusa"];
    expect(targetNotIdentifiedFriendly(track({ estimatedIdentity: "ger_ca" }), friendly)).toBe(
      true,
    );
    expect(
      targetNotIdentifiedFriendly(track({ estimatedIdentity: "rn_cl_arethusa" }), friendly),
    ).toBe(false);
  });

  it("own-speed predicate: §7 governs underwater, §8 governs above-water, SUBMARINE_INTERNAL is C-3-deferred", () => {
    const underwater = baseLauncher();
    expect(ownSpeedWithinLauncherLimits(underwater, launcher533(), 12_861_100).passes).toBe(true);
    expect(ownSpeedWithinLauncherLimits(underwater, launcher533(), 12_861_101).passes).toBe(false);
    const sub = baseLauncher({
      launcherFamilyId: "533mm_submarine_internal",
      mountType: "SUBMARINE_INTERNAL",
    });
    expect(
      ownSpeedWithinLauncherLimits(
        sub,
        launcher533({
          launcherFamilyId: "533mm_submarine_internal",
          mountType: "SUBMARINE_INTERNAL",
        }),
        99_000_000,
      ).passes,
    ).toBe(true);
    const narrow = aboveWaterLauncher();
    narrow.aboveWaterMaxLaunchSpeedKnots = 28;
    expect(ownSpeedWithinLauncherLimits(aboveWaterState(), narrow, 14_404_432).passes).toBe(true);
    expect(ownSpeedWithinLauncherLimits(aboveWaterState(), narrow, 14_404_433).passes).toBe(false);
  });
});

describe("AC-19: friendlyFireSafetyVerdict is the single source of truth for §6 predicate 14", () => {
  it("passes when the assessment is not prohibited and fails exactly when it is", () => {
    const safe = assessFriendlyFireRisk({
      targetRelativeBearingMdeg: 0,
      targetEstimatedRangeM: 5_000,
      solutionUncertaintyM: 0,
      spreadHalfAngleMdeg: 0,
      friendlyTracks: [],
      friendlyIdentities: ["rn_cl_arethusa"],
      manualLaunch: false,
    });
    expect(safe.prohibited).toBe(false);
    expect(friendlyFireSafetyVerdict(safe)).toBe(true);

    const dangerous = assessFriendlyFireRisk({
      targetRelativeBearingMdeg: 0,
      targetEstimatedRangeM: 5_000,
      solutionUncertaintyM: 0,
      spreadHalfAngleMdeg: 0,
      friendlyTracks: [friendlyTrack({ relativeBearingMdeg: 0, rangeM: 5_000 })],
      friendlyIdentities: ["rn_cl_arethusa"],
      manualLaunch: true,
    });
    expect(dangerous.prohibited).toBe(true);
    expect(friendlyFireSafetyVerdict(dangerous)).toBe(false);
  });
});
