// AC-13 (part 2): §14 hit resolution (DESIGN-40). A torpedo hit requires ALL
// of: track intersection with the target's authoritative collision geometry,
// arming distance traveled, depth/draft compatibility, no explicit
// avoidance/decoy/interception/failure result, a legal physical target, and
// valid impact substep ordering. TORPEDO_HIT_RESOLVED on success. Contact
// does NOT guarantee detonation (proved by the detonation seam tests in
// detonation.test.ts). Hit resolution is fully deterministic (geometry/time/
// legality predicates only — §14 ships no probability draw).
//
// The collision test is the exact integer circle test in micrometres; its
// squared offsets exceed Number.MAX_SAFE_INTEGER on any large map, so the
// boolean comparison runs in bigint (documented bound analysis in
// hit-resolution.ts) — the tests include an overflow-scale case.
//
// All arithmetic/positions are integers (µm / metres / milli-degrees); the
// tile fixture mirrors track.test.ts (G7a 44-kn, one-minute advance ->
// position [0, 1_358_132_160] on a 90° heading, depthSettingM 5, armed).
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import type { ContactTrack } from "../../src/targeting.js";
import {
  advanceTorpedoTrack,
  assertTargetHitProfile,
  contactBlockersClear,
  createTorpedoTrack,
  depthDraftCompatible,
  impactOrderingValid,
  intersectsCollisionGeometry,
  isLegalTarget,
  legalContactPosition,
  NO_TARGET_CONTACT,
  TORPEDO_CONTACT_BLOCKERS,
  TORPEDO_HIT_RESOLVED,
  TORPEDO_MINUTE_MS,
  TORPEDO_STATE_INVARIANT_FAILED,
  resolveTorpedoHit,
  setTorpedoTerminalResult,
  traveledArmingDistance,
  type TargetHitProfile,
  type TorpedoContactBlocker,
  type TorpedoTrack,
} from "../../src/torpedoes/index.js";
import type { CompiledTorpedoSpeedSetting } from "@bluewave/armament";

const G7A = "ger_533mm_g7a_1934";
const G7A_RELIABILITY_BP = 96_000; // -> track reliability 9_600 (10_000 bp roll scale)
const G7A_44KN_SETTING: CompiledTorpedoSpeedSetting = {
  settingId: "44kn",
  speedMilliKnots: 44_000,
  rangeM: 6_000,
};
const G7A_ARMING_M = 150;
// One minute of the 44-kn setting: 22_635_536 µm/s * 60_000 ms / 1_000 =
// 1_358_132_160 µm traveled; heading 90_000 mdeg (90°) -> +Y.
const ONE_MINUTE_TRACK_POSITION: [number, number] = [0, 1_358_132_160];

function buildArmedTrack(
  overrides: Partial<Parameters<typeof createTorpedoTrack>[0]> = {},
): TorpedoTrack {
  const created = createTorpedoTrack({
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
  return advanceTorpedoTrack(created, TORPEDO_MINUTE_MS);
}

function contact(contactId: string, position: [number, number], confidence = 8_000): ContactTrack {
  return {
    contactId,
    estimatedIdentity: "TARGET",
    position,
    course: 0,
    speed: 0,
    confidence,
    observationTime: "t0",
    source: "visual",
    uncertainty: 0,
  };
}

function fixtureTarget(): TargetHitProfile {
  return {
    targetId: "SHIP-TAU",
    contactId: "C1",
    collisionRadiusM: 100,
    draftM: 8,
    terminalStatus: null,
  };
}

// The standard §14 fixture: an armed track AT the legal contact position, a
// closed 100 m collision circle, draft 8 m, depth setting 5 m, no blocker,
// impact at (6, 4) strictly after launch (5, 4). Every predicate passes.
function hitFn(
  overrides: Partial<Parameters<typeof resolveTorpedoHit>[0]> = {},
): ReturnType<typeof resolveTorpedoHit> {
  const track = buildArmedTrack();
  return resolveTorpedoHit({
    track,
    target: fixtureTarget(),
    knownTracks: new Map([["C1", contact("C1", track.currentPosition)]]),
    blocker: null,
    impactMinute: 6,
    impactSubstep: 4,
    ...overrides,
  });
}

describe("AC-13p2: §14(1) collision geometry — exact integer circle test", () => {
  it("centre/inside/exact-radius are hits; beyond the radius is a miss", () => {
    expect(intersectsCollisionGeometry([0, 0], [0, 0], 100)).toBe(true);
    // 3-4-5 triangle: (3 m, 4 m) from the centre, radius 100 m
    expect(intersectsCollisionGeometry([3_000_000, 4_000_000], [0, 0], 100)).toBe(true);
    // exact-radius boundary (100 m) is INCLUSIVE — a tangent pass contacts
    expect(intersectsCollisionGeometry([100_000_000, 0], [0, 0], 100)).toBe(true);
    expect(intersectsCollisionGeometry([100_000_001, 0], [0, 0], 100)).toBe(false);
    expect(intersectsCollisionGeometry([0, 200_000_000], [0, 0], 100)).toBe(false);
  });

  it("stays exact on an oversized map (offsets of ~2000-3000 km — Number-safe-integer overflow territory)", () => {
    const centre: [number, number] = [2_000_000_000_000, 3_000_000_000_000];
    // (50 m, 40 m) offset: distance = sqrt(1600 + 2500) = ~64 m < 100 m — hit
    const inside: [number, number] = [2_000_000_050_000, 3_000_000_040_000];
    expect(intersectsCollisionGeometry(inside, centre, 100)).toBe(true);
    // 200 m out in x — miss
    const outside: [number, number] = [2_000_200_000_000, 3_000_000_000_000]; // 200 m out
    expect(intersectsCollisionGeometry(outside, centre, 100)).toBe(false);
  });

  it("rejects malformed geometry inputs (TORPEDO_STATE_INVARIANT_FAILED)", () => {
    expect(() => intersectsCollisionGeometry([0, 0.5], [0, 0], 100)).toThrow(BluewaveError);
    expect(() => intersectsCollisionGeometry([0, 0] as never, [0] as never, 100)).toThrow(
      BluewaveError,
    );
    expect(() => intersectsCollisionGeometry([0, 0], [0, 0], 0)).toThrow(BluewaveError);
    expect(() => intersectsCollisionGeometry([0, 0], [0, 0], 100.5)).toThrow(BluewaveError);
  });
});

describe("resolveTorpedoHit: the neutral §14 fixture resolves a HIT with TORPEDO_HIT_RESOLVED", () => {
  it("all six predicates pass and the resolution records the §14 proof surface", () => {
    const r = hitFn();
    expect(r.hit).toBe(true);
    expect(r.outcome).toBe("HIT");
    expect(r.rejection).toBeNull();
    expect(r.reasonCode).toBe(TORPEDO_HIT_RESOLVED);
    expect(r.predicates).toEqual({
      blockersClear: true,
      orderingValid: true,
      targetLegal: true,
      geometryIntersects: true,
      depthCompatible: true,
      traveledArmingDistance: true,
    });
    expect(r.trackId).toBe("B1:5:4:torpedo:LCH-1:tube0");
    expect(r.targetContactId).toBe("C1");
    expect(r.impactMinute).toBe(6);
    expect(r.impactSubstep).toBe(4);
    // geometry provenance: the legal contact position anchors the shape
    expect(r.collisionCentre).toEqual(ONE_MINUTE_TRACK_POSITION);
    expect(r.collisionRadiusM).toBe(100);
    expect(r.draftM).toBe(8);
  });

  it("is deterministic: identical inputs -> identical verdict (pure function)", () => {
    const a = hitFn();
    const b = hitFn();
    expect(a).toEqual(b);
  });

  it("anchors the collision shape at the LEGAL CONTACT position (hidden true state never consulted)", () => {
    // contact placed downrange at [0,0]; the track sits ~1.36 km away -> miss
    const r = hitFn({ knownTracks: new Map([["C1", contact("C1", [0, 0])]]) });
    expect(r.hit).toBe(false);
    expect(r.rejection).toBe("GEOMETRY_MISS");
    expect(r.predicates.geometryIntersects).toBe(false);
  });
});

describe("resolveTorpedoHit: each §14 predicate rejects with its own recorded reason", () => {
  it("NOT_ARMED — the arming distance has not been traveled", () => {
    const unarmed = createTorpedoTrack({
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
      armingDistanceM: 2_000, // > 1_358 m traveled in one minute
      launchMinute: 5,
      launchSubstep: 4,
      launchPosition: [0, 0],
      launchHeadingMdeg: 90_000,
      orderedGyroAngleMdeg: 90_000,
      depthSettingM: 5,
    });
    const advanced = advanceTorpedoTrack(unarmed, TORPEDO_MINUTE_MS);
    expect(advanced.armed).toBe(false);
    expect(traveledArmingDistance(advanced)).toBe(false);
    const r = hitFn({ track: advanced });
    expect(r.hit).toBe(false);
    expect(r.rejection).toBe("NOT_ARMED");
    expect(r.predicates.traveledArmingDistance).toBe(false);
  });

  it("traveledArmingDistance boundary: arming distance exactly equal to the traveled floor-metres arms the torpedo", () => {
    const created = createTorpedoTrack({
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
      armingDistanceM: 1_358, // exactly the floor-metre distance of one advance
      launchMinute: 5,
      launchSubstep: 4,
      launchPosition: [0, 0],
      launchHeadingMdeg: 90_000,
      orderedGyroAngleMdeg: 90_000,
      depthSettingM: 5,
    });
    const advanced = advanceTorpedoTrack(created, TORPEDO_MINUTE_MS);
    expect(advanced.armed).toBe(true); // 1_358 >= 1_358
    expect(traveledArmingDistance(advanced)).toBe(true);
  });

  it("DEPTH_INCOMPATIBLE — the torpedo runs below the draft", () => {
    const r = hitFn({ track: buildArmedTrack({ depthSettingM: 9 }) }); // draft 8
    expect(r.hit).toBe(false);
    expect(r.rejection).toBe("DEPTH_INCOMPATIBLE");
    expect(r.predicates.depthCompatible).toBe(false);
  });

  it("depthDraftCompatible boundary: depth == draft is compatible; deeper is not", () => {
    expect(depthDraftCompatible(5, 8)).toBe(true);
    expect(depthDraftCompatible(8, 8)).toBe(true); // keel-line contact
    expect(depthDraftCompatible(9, 8)).toBe(false);
    expect(depthDraftCompatible(0, 0)).toBe(true);
    expect(() => depthDraftCompatible(5.5, 8)).toThrow(BluewaveError);
    expect(() => depthDraftCompatible(5, -1)).toThrow(BluewaveError);
  });

  it("each explicit §14 blocker rejects with its own reason (avoidance/decoy/interception/failure)", () => {
    const cases: Array<[TorpedoContactBlocker, string]> = [
      ["TARGET_AVOIDANCE", "TARGET_AVOIDED"],
      ["TARGET_DECOY", "TARGET_DECOYED"],
      ["TARGET_INTERCEPTION", "TARGET_INTERCEPTED"],
      ["TORPEDO_FAILURE", "TORPEDO_FAILURE"],
    ];
    for (const [blocker, rejection] of cases) {
      const r = hitFn({ blocker });
      expect(r.hit, blocker).toBe(false);
      expect(r.rejection, blocker).toBe(rejection);
      expect(r.predicates.blockersClear, blocker).toBe(false);
    }
    expect(TORPEDO_CONTACT_BLOCKERS).toEqual([
      "TARGET_AVOIDANCE",
      "TARGET_DECOY",
      "TARGET_INTERCEPTION",
      "TORPEDO_FAILURE",
    ]);
    expect(contactBlockersClear(null)).toBe(true);
    expect(() => contactBlockersClear("BOGUS" as never)).toThrow(BluewaveError);
  });

  it("GEOMETRY_MISS — the track leaves the closed circle (90° vs 0° heading)", () => {
    const r = hitFn({
      // heading 0° -> the run continues along +X while the contact sits at
      // (0, +1_358_132_160): > 1 km outside the 100 m circle
      track: buildArmedTrack({ launchHeadingMdeg: 0, orderedGyroAngleMdeg: 0 }),
    });
    expect(r.hit).toBe(false);
    expect(r.rejection).toBe("GEOMETRY_MISS");
    expect(r.predicates.geometryIntersects).toBe(false);
  });

  it("NO_LEGAL_TARGET — the profile references a contact outside the legal surface (fog/decay)", () => {
    const r = hitFn({ knownTracks: new Map() });
    expect(r.hit).toBe(false);
    expect(r.rejection).toBe("NO_LEGAL_TARGET");
    expect(r.predicates.targetLegal).toBe(false);
  });

  it("NO_LEGAL_TARGET — a zero-confidence contact is fog (legal requires confidence > 0)", () => {
    const track = buildArmedTrack();
    const r = hitFn({
      knownTracks: new Map([["C1", contact("C1", track.currentPosition, 0)]]),
    });
    expect(r.hit).toBe(false);
    expect(r.rejection).toBe("NO_LEGAL_TARGET");
    expect(r.predicates.targetLegal).toBe(false);
  });

  it("TARGET_NOT_PHYSICAL — a foundered target is not a legal physical object; a SINKING one still is", () => {
    const foundered = hitFn({
      target: { ...fixtureTarget(), terminalStatus: "FOUNDERED" },
    });
    expect(foundered.hit).toBe(false);
    expect(foundered.rejection).toBe("TARGET_NOT_PHYSICAL");
    expect(foundered.predicates.targetLegal).toBe(false);
    const sinking = hitFn({ target: { ...fixtureTarget(), terminalStatus: "SINKING" } });
    expect(sinking.hit).toBe(true); // still a physical object
  });

  it("NO_LEGAL_TARGET — area fire (no target) can never resolve a contact", () => {
    const track = buildArmedTrack({ targetContactId: null });
    expect(track.targetContactId).toBe(NO_TARGET_CONTACT);
    const r = resolveTorpedoHit({
      track,
      target: null,
      knownTracks: new Map(),
      blocker: null,
      impactMinute: 6,
      impactSubstep: 4,
    });
    expect(r.hit).toBe(false);
    expect(r.rejection).toBe("NO_LEGAL_TARGET");
  });
});

describe("resolveTorpedoHit: impact (minute, substep) ordering (§14(6))", () => {
  it("impactOrderingValid is strictly-after-launch on both axes", () => {
    expect(
      impactOrderingValid({ launchMinute: 5, launchSubstep: 4, impactMinute: 6, impactSubstep: 4 }),
    ).toBe(true);
    expect(
      impactOrderingValid({ launchMinute: 5, launchSubstep: 4, impactMinute: 5, impactSubstep: 5 }),
    ).toBe(true);
    expect(
      impactOrderingValid({ launchMinute: 5, launchSubstep: 4, impactMinute: 5, impactSubstep: 4 }),
    ).toBe(false); // same instant
    expect(
      impactOrderingValid({ launchMinute: 5, launchSubstep: 4, impactMinute: 5, impactSubstep: 3 }),
    ).toBe(false);
    expect(
      impactOrderingValid({
        launchMinute: 5,
        launchSubstep: 4,
        impactMinute: 4,
        impactSubstep: 60,
      }),
    ).toBe(false); // before launch
  });

  it("a hit at the launch instant is INVALID_IMPACT_ORDER; the next substep passes", () => {
    const sameInsta = hitFn({ impactMinute: 5, impactSubstep: 4 });
    expect(sameInsta.hit).toBe(false);
    expect(sameInsta.rejection).toBe("INVALID_IMPACT_ORDER");
    const nextSubstep = hitFn({ impactMinute: 5, impactSubstep: 5 });
    expect(nextSubstep.hit).toBe(true);
  });
});

describe("resolveTorpedoHit: fail-closed guards + deterministic rejection order", () => {
  it("a terminal track cannot be hit-resolved (TORPEDO_STATE_INVARIANT_FAILED)", () => {
    const terminal = setTorpedoTerminalResult(buildArmedTrack(), "DUD");
    let err: BluewaveError | undefined;
    try {
      hitFn({ track: terminal });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
    expect(err!.context.field).toBe("track");
  });

  it("assertTargetHitProfile fails closed on malformed geometry", () => {
    const cases: Array<[string, unknown]> = [
      ["collisionRadiusM", 0],
      ["collisionRadiusM", -1],
      ["collisionRadiusM", 100.5],
      ["draftM", -1],
      ["draftM", 8.5],
      ["targetId", ""],
      ["contactId", ""],
    ];
    for (const [field, value] of cases) {
      const bad: TargetHitProfile = {
        targetId: "SHIP-TAU",
        contactId: "C1",
        collisionRadiusM: 100,
        draftM: 8,
        terminalStatus: null,
        [field]: value,
      };
      let err: BluewaveError | undefined;
      try {
        assertTargetHitProfile(bad);
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err, field).toBeDefined();
      expect(err!.message, field).toBe(TORPEDO_STATE_INVARIANT_FAILED);
      expect(err!.context.field, field).toBe(field);
    }
  });

  it("invalid impact integers fail closed (impactSubstep < 1 / non-integer)", () => {
    expect(() => hitFn({ impactSubstep: 0 })).toThrow(BluewaveError);
    expect(() => hitFn({ impactMinute: 6.5 })).toThrow(BluewaveError);
  });

  it("recorded rejection order is deterministic: a blocker beats a legality miss; a legality miss beats a geometry miss", () => {
    const blocked = hitFn({ blocker: "TARGET_AVOIDANCE", knownTracks: new Map() });
    expect(blocked.rejection).toBe("TARGET_AVOIDED");
    const illegalGeo = hitFn({
      knownTracks: new Map(),
      track: buildArmedTrack({ launchHeadingMdeg: 0, orderedGyroAngleMdeg: 0 }),
    });
    expect(illegalGeo.rejection).toBe("NO_LEGAL_TARGET");
    expect(illegalGeo.predicates.geometryIntersects).toBe(false); // still recorded
  });

  it("isLegalTarget + legalContactPosition expose the reused fog-rule helpers", () => {
    const track = buildArmedTrack();
    const legal = new Map<string, ContactTrack>([["C1", contact("C1", track.currentPosition)]]);
    expect(isLegalTarget({ contactId: "C1", knownTracks: legal, terminalStatus: null })).toBe(true);
    expect(isLegalTarget({ contactId: "DROP", knownTracks: legal, terminalStatus: null })).toBe(
      false,
    );
    expect(
      isLegalTarget({ contactId: "C1", knownTracks: legal, terminalStatus: "FOUNDERED" }),
    ).toBe(false);
    expect(legalContactPosition(legal, "C1")).toEqual(track.currentPosition);
    expect(legalContactPosition(legal, "DROP")).toBeNull();
  });
});
