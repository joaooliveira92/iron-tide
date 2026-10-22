import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  advanceTorpedoTrack,
  assertAuthoritativeTorpedoTrack,
  assertTorpedoTrackSurface,
  computeTorpedoTrackHash,
  createTorpedoTrack,
  foldMdeg,
  NO_TARGET_CONTACT,
  projectAlongHeading,
  setTorpedoTerminalResult,
  TORPEDO_MINUTE_MS,
  TORPEDO_STATE_INVARIANT_FAILED,
  TORPEDO_TERMINAL_RESULTS,
  TORPEDO_TRACK_MDEG_PER_DEGREE,
  torpedoTrackId,
  verifyTorpedoTrackHash,
  type TorpedoTrack,
} from "@bluewave/combat/torpedoes";
import type { CompiledTorpedoSpeedSetting } from "@bluewave/armament";

const G7A = "ger_533mm_g7a_1934";
const G7A_RELIABILITY_BP = 96_000;
const G7A_44KN_SETTING: CompiledTorpedoSpeedSetting = {
  settingId: "44kn",
  speedMilliKnots: 44_000,
  rangeM: 6_000,
};
const G7A_ARMING_M = 150;

const ONE_MINUTE_DISTANCE_UM = 1_358_132_160;
const ONE_MINUTE_DISTANCE_M = 1_358;

function buildTrack(
  overrides: Partial<Parameters<typeof createTorpedoTrack>[0]> = {},
): TorpedoTrack {
  return createTorpedoTrack({
    battleId: "B1",
    launcherId: "LCH-1",
    firingShipId: "SHIP-ALPHA",
    firingSideId: "SIDE-A",
    tubeId: 0,
    targetContactId: "C1",
    torpedoModelId: G7A,
    reliabilityBp: G7A_RELIABILITY_BP,
    guidanceCapability: "gyro",
    selectedSetting: G7A_44KN_SETTING,
    armingDistanceM: G7A_ARMING_M,
    launchMinute: 5,
    launchSubstep: 4,
    launchPosition: [0, 0],
    launchHeadingMdeg: 90_000,
    orderedGyroAngleMdeg: 90_000,
    depthSettingM: 5,
    ...overrides,
  });
}

describe("AC-13: every launched torpedo creates one authoritative track with all §13 fields", () => {
  it("populates every §13 field on a created track", () => {
    const t = buildTrack();
    expect(t.torpedoTrackId).toBe("B1:5:4:torpedo:LCH-1:tube0");
    expect(t.battleId).toBe("B1");
    expect(t.launcherId).toBe("LCH-1");
    expect(t.firingShipId).toBe("SHIP-ALPHA");
    expect(t.firingSideId).toBe("SIDE-A");
    expect(t.tubeId).toBe(0);
    expect(t.targetContactId).toBe("C1");
    expect(t.torpedoModelId).toBe(G7A);
    expect(t.selectedSettingId).toBe(G7A_44KN_SETTING.settingId);
    expect(t.launchMinute).toBe(5);
    expect(t.launchSubstep).toBe(4);
    expect(t.launchPosition).toEqual([0, 0]);
    expect(t.launchHeadingMdeg).toBe(90_000);
    expect(t.orderedGyroAngleMdeg).toBe(90_000);
    expect(t.speedKnotsBp).toBe(G7A_44KN_SETTING.speedMilliKnots);
    expect(t.maxRunDistanceM).toBe(G7A_44KN_SETTING.rangeM);
    expect(t.armingDistanceM).toBe(G7A_ARMING_M);
    expect(t.depthSettingM).toBe(5);
    expect(t.reliabilityState).toEqual({ reliabilityBp: 9_600 });
    expect(t.guidanceState).toEqual({ capabilityId: "gyro", orderedGyroAngleMdeg: 90_000 });
    expect(t.detectionState).toEqual({ detectedByParticipant: {} });
    expect(t.currentPosition).toEqual([0, 0]);
    expect(t.distanceTraveledUm).toBe(0);
    expect(t.runDistanceRemainingM).toBe(G7A_44KN_SETTING.rangeM);
    expect(t.armed).toBe(false);
    expect(t.terminalResult).toBeNull();
    expect(t.trackHash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyTorpedoTrackHash(t)).toBe(true);
  });

  it("a created track is deep-frozen and passes the authoritative guard", () => {
    const t = buildTrack();
    expect(Object.isFrozen(t)).toBe(true);
    expect(() => assertAuthoritativeTorpedoTrack(t)).not.toThrow();
  });

  it("area fire (targetContactId null) sets the §13 NO_TARGET_CONTACT marker", () => {
    const t = buildTrack({ targetContactId: null });
    expect(t.targetContactId).toBe(NO_TARGET_CONTACT);
    expect(t.targetContactId).toBe("NONE");
  });
});

describe("AC-13: deterministic track id derivation", () => {
  it("produces the stable tuple shape battleId:launchMinute:launchSubstep:torpedo:launcherId:tubeN", () => {
    expect(
      torpedoTrackId({
        battleId: "B1",
        launcherId: "LCH-1",
        tubeId: 0,
        launchMinute: 5,
        launchSubstep: 4,
      }),
    ).toBe("B1:5:4:torpedo:LCH-1:tube0");
    const a = torpedoTrackId({
      battleId: "B1",
      launcherId: "LCH-1",
      tubeId: 0,
      launchMinute: 5,
      launchSubstep: 4,
    });
    const b = torpedoTrackId({
      battleId: "B1",
      launcherId: "LCH-1",
      tubeId: 0,
      launchMinute: 5,
      launchSubstep: 4,
    });
    expect(a).toBe(b);
  });

  it("is collision-free across distinct tubes and distinct (minute, substep)", () => {
    const ids = [
      torpedoTrackId({
        battleId: "B1",
        launcherId: "LCH-1",
        tubeId: 0,
        launchMinute: 5,
        launchSubstep: 4,
      }),
      torpedoTrackId({
        battleId: "B1",
        launcherId: "LCH-1",
        tubeId: 1,
        launchMinute: 5,
        launchSubstep: 4,
      }),
      torpedoTrackId({
        battleId: "B1",
        launcherId: "LCH-1",
        tubeId: 2,
        launchMinute: 5,
        launchSubstep: 4,
      }),
      torpedoTrackId({
        battleId: "B1",
        launcherId: "LCH-1",
        tubeId: 0,
        launchMinute: 6,
        launchSubstep: 4,
      }),
      torpedoTrackId({
        battleId: "B1",
        launcherId: "LCH-1",
        tubeId: 0,
        launchMinute: 5,
        launchSubstep: 3,
      }),
      torpedoTrackId({
        battleId: "B2",
        launcherId: "LCH-1",
        tubeId: 0,
        launchMinute: 5,
        launchSubstep: 4,
      }),
      torpedoTrackId({
        battleId: "B1",
        launcherId: "LCH-2",
        tubeId: 0,
        launchMinute: 5,
        launchSubstep: 4,
      }),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("B1:5:4:torpedo:LCH-1:tube0");
    expect(ids).toContain("B1:5:4:torpedo:LCH-1:tube1");
    expect(ids).toContain("B1:6:4:torpedo:LCH-1:tube0");
    expect(ids).toContain("B1:5:3:torpedo:LCH-1:tube0");
  });
});

describe("AC-13: track hash — deterministic, tamper-proof, fail-closed guards", () => {
  it("computes a stable hash and verifies for a created track", () => {
    const a = buildTrack();
    const b = buildTrack();
    expect(computeTorpedoTrackHash(a)).toBe(a.trackHash);
    expect(verifyTorpedoTrackHash(a)).toBe(true);
    expect(computeTorpedoTrackHash(b)).toBe(b.trackHash);
    expect(a.trackHash).toBe(b.trackHash);
  });

  it("tampering any authoritative field changes the hash and fails verification", () => {
    const tamperedCases: Array<[string, TorpedoTrack]> = [
      ["currentPosition", { ...buildTrack(), currentPosition: [1, 0] }],
      ["launchHeadingMdeg", { ...buildTrack(), launchHeadingMdeg: 90_001 }],
      ["depthSettingM", { ...buildTrack(), depthSettingM: 6 }],
      ["speedKnotsBp", { ...buildTrack(), speedKnotsBp: 44_001 }],
      ["runDistanceRemainingM", { ...buildTrack(), runDistanceRemainingM: 5_999 }],
      ["distanceTraveledUm", { ...buildTrack(), distanceTraveledUm: 1 }],
      ["armed", { ...buildTrack(), armed: true }],
    ];
    for (const [field, tampered] of tamperedCases) {
      expect(verifyTorpedoTrackHash(tampered), `field ${field}`).toBe(false);
      expect(computeTorpedoTrackHash(tampered), `field ${field}`).not.toBe(
        computeTorpedoTrackHash(buildTrack()),
      );
    }
  });

  it("assertAuthoritativeTorpedoTrack rejects a missing/empty track hash", () => {
    for (const hash of ["", undefined]) {
      const t = { ...buildTrack(), trackHash: hash } as unknown as TorpedoTrack;
      let err: BluewaveError | undefined;
      try {
        assertAuthoritativeTorpedoTrack(t);
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
      expect(err!.context.field).toBe("trackHash");
    }
  });

  it("assertTorpedoTrackSurface rejects malformed fields (boundary tests)", () => {
    const cases: Array<[string, TorpedoTrack]> = [
      ["tubeId", { ...buildTrack(), tubeId: -1 }],
      ["tubeId", { ...buildTrack(), tubeId: 1.5 }],
      ["launchMinute", { ...buildTrack(), launchMinute: -1 }],
      ["launchMinute", { ...buildTrack(), launchMinute: 5.5 }],
      ["launchSubstep", { ...buildTrack(), launchSubstep: 0 }],
      ["launchSubstep", { ...buildTrack(), launchSubstep: 1.5 }],
      ["speedKnotsBp", { ...buildTrack(), speedKnotsBp: 0 }],
      ["speedKnotsBp", { ...buildTrack(), speedKnotsBp: 44_000.5 }],
      ["maxRunDistanceM", { ...buildTrack(), maxRunDistanceM: 6_000.5 }],
      ["maxRunDistanceM", { ...buildTrack(), maxRunDistanceM: -1 }],
      ["armingDistanceM", { ...buildTrack(), armingDistanceM: 150.5 }],
      ["armingDistanceM", { ...buildTrack(), armingDistanceM: -1 }],
      ["depthSettingM", { ...buildTrack(), depthSettingM: 5.5 }],
      ["depthSettingM", { ...buildTrack(), depthSettingM: -1 }],
      ["launchPosition", { ...buildTrack(), launchPosition: [0] } as unknown as TorpedoTrack],
      ["launchPosition", { ...buildTrack(), launchPosition: [0, 0.5] } as unknown as TorpedoTrack],
      ["currentPosition", { ...buildTrack(), currentPosition: [0] } as unknown as TorpedoTrack],
      [
        "currentPosition",
        { ...buildTrack(), currentPosition: [0, 0.5] } as unknown as TorpedoTrack,
      ],
      ["terminalResult", { ...buildTrack(), terminalResult: "BOGUS" } as unknown as TorpedoTrack],
      ["reliabilityState", { ...buildTrack(), reliabilityState: { reliabilityBp: 10_001 } }],
      ["reliabilityState", { ...buildTrack(), reliabilityState: { reliabilityBp: -1 } }],
      ["targetContactId", { ...buildTrack(), targetContactId: "" }],
      [
        "detectionState",
        {
          ...buildTrack(),
          detectionState: {
            detectedByParticipant: { P1: { detected: true, confidenceBp: 10_001 } },
          },
        },
      ],
      [
        "detectionState",
        {
          ...buildTrack(),
          detectionState: { detectedByParticipant: { P1: { detected: true, confidenceBp: -1 } } },
        },
      ],
    ];
    for (const [field, bad] of cases) {
      let err: BluewaveError | undefined;
      try {
        assertTorpedoTrackSurface(bad);
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err, `field ${field}`).toBeDefined();
      expect(err!.message, `field ${field}`).toBe(TORPEDO_STATE_INVARIANT_FAILED);
      expect(err!.context.field, `field ${field}`).toBe(field);
    }
    expect(() => assertTorpedoTrackSurface(buildTrack())).not.toThrow();
  });

  it("assertTorpedoTrackSurface fails closed when orderedGyroAngleMdeg diverges from launchHeadingMdeg", () => {
    const divergent = { ...buildTrack(), orderedGyroAngleMdeg: 90_001 } as unknown as TorpedoTrack;
    let err: BluewaveError | undefined;
    try {
      assertTorpedoTrackSurface(divergent);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
    expect(err!.context.field).toBe("orderedGyroAngleMdeg");
    expect(err!.context.reason).toBe(
      "a gyro-guided torpedo's ordered course must equal its launch heading while running",
    );
    const equal = buildTrack();
    expect(equal.launchHeadingMdeg).toBe(equal.orderedGyroAngleMdeg);
    expect(() => assertTorpedoTrackSurface(equal)).not.toThrow();
  });
});

describe("AC-13: lifecycle state machine — advance + exhaustion + terminal one-way", () => {
  it("a created track is running (terminalResult null)", () => {
    expect(buildTrack().terminalResult).toBeNull();
  });

  it("advanceTorpedoTrack moves pure integer µm along the launch heading and accumulates accounting", () => {
    const t = buildTrack();
    const advanced = advanceTorpedoTrack(t, TORPEDO_MINUTE_MS);
    expect(advanced.currentPosition).toEqual(
      projectAlongHeading([0, 0], 90_000, ONE_MINUTE_DISTANCE_UM),
    );
    expect(advanced.currentPosition).toEqual([0, ONE_MINUTE_DISTANCE_UM]);
    expect(advanced.distanceTraveledUm).toBe(ONE_MINUTE_DISTANCE_UM);
    expect(advanced.runDistanceRemainingM).toBe(6_000 - ONE_MINUTE_DISTANCE_M);
    expect(advanced.armed).toBe(true);
    expect(advanced.terminalResult).toBeNull();
    expect(advanced.trackHash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyTorpedoTrackHash(advanced)).toBe(true);
    expect(t.distanceTraveledUm).toBe(0);
    expect(t.currentPosition).toEqual([0, 0]);
  });

  it("keeps the launch/track identity fields stable across an advance", () => {
    const t = buildTrack();
    const advanced = advanceTorpedoTrack(t, TORPEDO_MINUTE_MS);
    expect(advanced.torpedoTrackId).toBe(t.torpedoTrackId);
    expect(advanced.battleId).toBe(t.battleId);
    expect(advanced.launcherId).toBe(t.launcherId);
    expect(advanced.tubeId).toBe(t.tubeId);
    expect(advanced.launchMinute).toBe(t.launchMinute);
    expect(advanced.launchSubstep).toBe(t.launchSubstep);
    expect(advanced.launchPosition).toEqual(t.launchPosition);
    expect(advanced.launchHeadingMdeg).toBe(t.launchHeadingMdeg);
    expect(advanced.speedKnotsBp).toBe(t.speedKnotsBp);
    expect(advanced.maxRunDistanceM).toBe(t.maxRunDistanceM);
    expect(advanced.armingDistanceM).toBe(t.armingDistanceM);
    expect(advanced.depthSettingM).toBe(t.depthSettingM);
    expect(advanced.reliabilityState).toEqual(t.reliabilityState);
  });

  it("is deterministic: two advances with identical inputs produce identical tracks", () => {
    const a = advanceTorpedoTrack(buildTrack(), TORPEDO_MINUTE_MS);
    const b = advanceTorpedoTrack(buildTrack(), TORPEDO_MINUTE_MS);
    expect(a).toEqual(b);
    expect(a.trackHash).toBe(b.trackHash);
  });

  it("recomputes a NEW track hash on advance", () => {
    const t = buildTrack();
    const advanced = advanceTorpedoTrack(t, TORPEDO_MINUTE_MS);
    expect(advanced.trackHash).not.toBe(t.trackHash);
    expect(verifyTorpedoTrackHash(advanced)).toBe(true);
  });

  it("stays unarmed until the arming distance is traveled", () => {
    const t = buildTrack({ armingDistanceM: 2_000 });
    const advanced = advanceTorpedoTrack(t, TORPEDO_MINUTE_MS);
    expect(advanced.armed).toBe(false);
    expect(advanced.terminalResult).toBeNull();
  });

  it("transitions deterministically to EXHAUSTION when the run distance is consumed and cannot advance again", () => {
    const t = buildTrack({ selectedSetting: { ...G7A_44KN_SETTING, rangeM: 1_000 } });
    const exhausted = advanceTorpedoTrack(t, TORPEDO_MINUTE_MS);
    expect(exhausted.terminalResult).toBe("EXHAUSTION");
    expect(exhausted.runDistanceRemainingM).toBe(0);
    expect(exhausted.armed).toBe(true);
    let err: BluewaveError | undefined;
    try {
      advanceTorpedoTrack(exhausted, TORPEDO_MINUTE_MS);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
  });

  it("rejects a non-positive or non-integer advance dt (TORPEDO_STATE_INVARIANT_FAILED)", () => {
    expect(() => advanceTorpedoTrack(buildTrack(), 0)).toThrow(BluewaveError);
    expect(() => advanceTorpedoTrack(buildTrack(), -1)).toThrow(BluewaveError);
    expect(() => advanceTorpedoTrack(buildTrack(), 1.5)).toThrow(BluewaveError);
  });

  it("setTorpedoTerminalResult sets each closed-union member on a running track", () => {
    for (const terminal of TORPEDO_TERMINAL_RESULTS) {
      const t = setTorpedoTerminalResult(buildTrack(), terminal);
      expect(t.terminalResult).toBe(terminal);
      expect(t.trackHash).toMatch(/^[0-9a-f]{64}$/);
      expect(verifyTorpedoTrackHash(t)).toBe(true);
    }
    expect(TORPEDO_TERMINAL_RESULTS).toEqual([
      "HIT",
      "DETONATION",
      "DUD",
      "GROUNDING",
      "EXHAUSTION",
      "DESTRUCTION",
      "BATTLE_END",
    ]);
  });

  it("the terminal transition is one-way: re-terminalizing or advancing a terminal track throws", () => {
    const terminal = setTorpedoTerminalResult(buildTrack(), "HIT");
    expect(() => setTorpedoTerminalResult(terminal, "DUD")).toThrow(BluewaveError);
    expect(() => setTorpedoTerminalResult(terminal, "HIT")).toThrow(BluewaveError);
    expect(() => advanceTorpedoTrack(terminal, TORPEDO_MINUTE_MS)).toThrow(BluewaveError);
    let err: BluewaveError | undefined;
    try {
      setTorpedoTerminalResult(terminal, "DETONATION");
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
  });

  it("a non-canonical terminal result fails closed (TORPEDO_STATE_INVARIANT_FAILED)", () => {
    let err: BluewaveError | undefined;
    try {
      setTorpedoTerminalResult(buildTrack(), "MISSED" as never);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
  });
});

describe("AC-13: mdeg folding + heading projection (projectAlongHeading)", () => {
  it("folds any integer milli-degrees into [0, 360_000)", () => {
    expect(foldMdeg(90_000)).toBe(90_000);
    expect(foldMdeg(-1)).toBe(359_999);
    expect(foldMdeg(360_000)).toBe(0);
    expect(foldMdeg(361_000)).toBe(1_000);
    expect(foldMdeg(-90_000)).toBe(270_000);
    expect(TORPEDO_TRACK_MDEG_PER_DEGREE).toBe(1_000);
  });

  it("projects pure integer µm along 0° (+X) and 90° (+Y)", () => {
    expect(projectAlongHeading([0, 0], 0, ONE_MINUTE_DISTANCE_UM)).toEqual([
      ONE_MINUTE_DISTANCE_UM,
      0,
    ]);
    expect(projectAlongHeading([10, 20], 90_000, 1_000_000)).toEqual([10, 1_000_020]);
  });

  it("an out-of-range angle folds to the same projection as its equivalent in-range angle", () => {
    const dist = 5_000_000;
    expect(projectAlongHeading([0, 0], 450_000, dist)).toEqual(
      projectAlongHeading([0, 0], 90_000, dist),
    );
    expect(projectAlongHeading([0, 0], -90_000, dist)).toEqual(
      projectAlongHeading([0, 0], 270_000, dist),
    );
    expect(projectAlongHeading([0, 0], -90_000, dist)).toEqual([0, -dist]);
  });

  it("rejects a non-integer or negative displacement (TORPEDO_STATE_INVARIANT_FAILED)", () => {
    expect(() => projectAlongHeading([0, 0], 0, 1.5)).toThrow(BluewaveError);
    expect(() => projectAlongHeading([0, 0], 0, -1)).toThrow(BluewaveError);
  });
});
