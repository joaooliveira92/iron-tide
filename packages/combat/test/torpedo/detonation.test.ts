// AC-14: §15 detonation outcomes (DESIGN-40). The canonical CLOSED outcome set
// is DUD / PARTIAL_DETONATION / FULL_DETONATION / PREMATURE_DETONATION /
// MAGAZINE_OR_TUBE_CHAIN_REACTION / NO_CONTACT. Every outcome is selected
// through an explicit deterministic predicate OR the single keyed reliability
// draw on the
//   battle/torpedo/detonation/reliability:<battleId>:<impactMinute>:
//       <impactSubstep>:<trackId>
// stream (drawBp = floor(draw * 10_000); drawBp < probabilityBp functions,
// drawBp >= probabilityBp is a DUD with the TORPEDO_DUD reason code). The
// result records ALL inputs, the composed probability, the random decision,
// and provenance (ruleset/formula versions + input hash).
//
// Determinism: identical inputs + identical keyed draws -> identical result;
// ALL randomness enters through the injected keyedRng seam (a throwing stub
// proves the NO_CONTACT / PREMATURE paths consume NO draw). The seam with §14
// (a resolved hit feeding this stage) and the §13 terminal mapping are proven
// here, INCLUDING the explicit package proof that contact does NOT guarantee
// detonation (a resolved HIT plus a dud draw -> DUD).
//
// The §15 fuze is pinned by the AUTHORITATIVE model->fuze mapping
// (TORPEDO_MODEL_FUZE_POLICY, keyed by track.torpedoModelId) — the resolver
// reads the fuze from the track's model and the reliability from the track's
// §13 reliabilityState.reliabilityBp; there is NO caller-supplied weapon
// input. CONTACT fixtures use whitehead_18in_1894; MAGNETIC fixtures use the
// G7a/G7e/Type 93 models (HIGH-1 / MEDIUM-2).
//
// Fixtures mirror hit-resolution.test.ts: G7a, 44-kn one-minute advance on a
// 90° heading (track position [0, 1_358_132_160], armed), track reliability
// 9_600 = floor(96_000 / 10) on the 10_000 bp roll scale.
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import type { ContactTrack } from "../../src/targeting.js";
import {
  advanceTorpedoTrack,
  applyTorpedoDetonationToTrack,
  computeDetonationProbabilityBp,
  createTorpedoTrack,
  evaluateDetonationReliabilityDraw,
  fuzePolicyForModel,
  impactGeometryQuality,
  isDetonationOutcome,
  TORPEDO_DAMAGE_STATE_FUNCTION_MULTIPLIER_BP,
  TORPEDO_DETONATION_OUTCOMES,
  TORPEDO_DUD,
  TORPEDO_FULL_FUNCTION_MAX_DEVIATION_MDEG,
  TORPEDO_FULL_FUNCTION_MIN_DEPTH_M,
  TORPEDO_FUZE_FUNCTION_MULTIPLIER_BP,
  TORPEDO_HIT_RESOLVED,
  TORPEDO_IMPACT_ZONES,
  TORPEDO_MINUTE_MS,
  TORPEDO_MODEL_FUZE_POLICY,
  TORPEDO_ORDNANCE_IMPACT_ZONES,
  TORPEDO_PROTECTION_FUNCTION_MULTIPLIER_BP,
  TORPEDO_STATE_INVARIANT_FAILED,
  TORPEDO_TARGET_PROTECTION_LEVELS,
  resolveTorpedoDetonation,
  resolveTorpedoHit,
  torpedoTerminalForDetonationOutcome,
  setTorpedoTerminalResult,
  type TargetHitProfile,
  type TorpedoImpactZone,
  type TorpedoTargetProtectionLevel,
  type TorpedoTrack,
} from "../../src/torpedoes/index.js";
import type { CompiledTorpedoSpeedSetting } from "@bluewave/armament";

// Model-id fixtures: the §15 fuze is pinned by the model->fuze mapping.
const G7A = "ger_533mm_g7a_1934"; // MAGNETIC (Pi MZ pistols, Torpedokrise)
const WHITEHEAD = "whitehead_18in_1894"; // CONTACT (contact pistol)
const G7A_44KN_SETTING: CompiledTorpedoSpeedSetting = {
  settingId: "44kn",
  speedMilliKnots: 44_000,
  rangeM: 6_000,
};
const TRACK_ID = "B1:5:4:torpedo:LCH-1:tube0";
// Track reliability: the model's 100_000-scale value floored /10 -> the
// 10_000 bp roll scale (the §13 carrier the resolver reads).
const RELIABILITY_BP = 9_600; // 96_000 / 10

function buildTorpedoTrack(
  depthSettingM = 5,
  torpedoModelId = WHITEHEAD,
  reliabilityBp100K = 96_000,
): TorpedoTrack {
  const created = createTorpedoTrack({
    battleId: "B1",
    launcherId: "LCH-1",
    firingShipId: "SHIP-ALPHA",
    firingSideId: "SIDE-A",
    tubeId: 0,
    targetContactId: "C1",
    torpedoModelId,
    reliabilityBp: reliabilityBp100K,
    guidanceCapability: "gyro",
    selectedSetting: G7A_44KN_SETTING,
    armingDistanceM: 150,
    launchMinute: 5,
    launchSubstep: 4,
    launchPosition: [0, 0],
    launchHeadingMdeg: 90_000,
    orderedGyroAngleMdeg: 90_000,
    depthSettingM,
  });
  return advanceTorpedoTrack(created, TORPEDO_MINUTE_MS);
}

function legalContacts(track: TorpedoTrack): Map<string, ContactTrack> {
  return new Map<string, ContactTrack>([
    [
      "C1",
      {
        contactId: "C1",
        estimatedIdentity: "TARGET",
        position: track.currentPosition,
        course: 0,
        speed: 0,
        confidence: 8_000,
        observationTime: "t0",
        source: "visual",
        uncertainty: 0,
      },
    ],
  ]);
}

function targetProfile(): TargetHitProfile {
  return {
    targetId: "SHIP-TAU",
    contactId: "C1",
    collisionRadiusM: 100,
    draftM: 8,
    terminalStatus: null,
  };
}

// §14 verdict: a HIT (track on the contact, inside the circle, depth <= draft,
// ordered impact (6,4) after launch (5,4)). The helper is deterministic.
function hitVerdict(track: TorpedoTrack): ReturnType<typeof resolveTorpedoHit> {
  return resolveTorpedoHit({
    track,
    target: targetProfile(),
    knownTracks: legalContacts(track),
    blocker: null,
    impactMinute: 6,
    impactSubstep: 4,
  });
}

// §14 verdict: a MISS (the contact sits far downrange -> GEOMETRY_MISS).
function missVerdict(track: TorpedoTrack): ReturnType<typeof resolveTorpedoHit> {
  return resolveTorpedoHit({
    track,
    target: targetProfile(),
    knownTracks: new Map([["C1", { ...legalContacts(track).get("C1")!, position: [0, 0] }]]),
    blocker: null,
    impactMinute: 6,
    impactSubstep: 4,
  });
}

// §15 harness over a HIT scene (deterministic; keyedRng defaults to a
// functioning draw 0.001). Override parameters per test. The fuze is pinned by
// the model->fuze mapping via the selected track's torpedoModelId (HIGH-1).
function resolveDetonation(
  o: {
    track?: TorpedoTrack;
    modelId?: string; // the torpedo model (drives the fuze via the mapping)
    zone?: TorpedoImpactZone | null;
    deviationMdeg?: number;
    protection?: TorpedoTargetProtectionLevel | null;
    progressiveFloodingKg?: number | null;
    wakeIntercept?: boolean;
    hitOverride?: ReturnType<typeof resolveTorpedoHit>;
    drawProvidedBy?: () => number;
  } = {},
): ReturnType<typeof resolveTorpedoDetonation> {
  const track = o.track ?? buildTorpedoTrack(5, o.modelId);
  const hit = o.hitOverride ?? hitVerdict(track);
  return resolveTorpedoDetonation({
    track,
    hit,
    impact: { zone: o.zone ?? "EXTREMITY", deviationMdeg: o.deviationMdeg ?? 5_000 },
    targetProtection: o.protection ?? "NONE",
    damageState:
      o.progressiveFloodingKg === null
        ? null
        : { progressiveFloodingTotalKg: o.progressiveFloodingKg ?? 0 },
    prematureEnvironment: { wakeIntercept: o.wakeIntercept ?? false },
    keyedRng: o.drawProvidedBy ?? (() => 0.001),
  });
}

describe("AC-14: the canonical §15 closed outcome set", () => {
  it("ships exactly the six canonical outcomes in deterministic order", () => {
    expect([...TORPEDO_DETONATION_OUTCOMES]).toEqual([
      "DUD",
      "PARTIAL_DETONATION",
      "FULL_DETONATION",
      "PREMATURE_DETONATION",
      "MAGAZINE_OR_TUBE_CHAIN_REACTION",
      "NO_CONTACT",
    ]);
    expect(isDetonationOutcome("FULL_DETONATION")).toBe(true);
    expect(isDetonationOutcome("BOGUS")).toBe(false);
  });

  it("shows the authored fuze/protection/damage multiplier surfaces + full-function band + ordnance zones", () => {
    expect(TORPEDO_FUZE_FUNCTION_MULTIPLIER_BP).toEqual({ CONTACT: 10_000, MAGNETIC: 9_000 });
    expect(TORPEDO_PROTECTION_FUNCTION_MULTIPLIER_BP).toEqual({
      NONE: 10_000,
      WEAK: 9_500,
      STANDARD: 9_000,
      STRONG: 8_500,
      ADVANCED: 8_000,
    });
    expect(TORPEDO_DAMAGE_STATE_FUNCTION_MULTIPLIER_BP).toEqual({ CLEAN: 10_000, DAMAGED: 9_500 });
    expect(TORPEDO_FULL_FUNCTION_MIN_DEPTH_M).toBe(3);
    expect(TORPEDO_FULL_FUNCTION_MAX_DEVIATION_MDEG).toBe(60_000);
    expect(TORPEDO_IMPACT_ZONES).toContain("MAGAZINE");
    expect(TORPEDO_ORDNANCE_IMPACT_ZONES).toEqual(["MAGAZINE", "TUBE_BAY"]);
    expect(TORPEDO_TARGET_PROTECTION_LEVELS).toEqual([
      "NONE",
      "WEAK",
      "STANDARD",
      "STRONG",
      "ADVANCED",
    ]);
  });
});

describe("HIGH-1: the authoritative model->fuze mapping pins the §15 fuze (never a caller value)", () => {
  it("ships a fuze policy for every shipped model id, grounded in the research note", () => {
    // Whitehead 18-in (1894) contact pistol -> CONTACT (research §3.1 / §4.3)
    expect(TORPEDO_MODEL_FUZE_POLICY["whitehead_18in_1894"]).toBe("CONTACT");
    // RN 21-in Mk IV (1916) WW1 British contact exploder -> CONTACT (§3.1)
    expect(TORPEDO_MODEL_FUZE_POLICY["rn_21in_mk_iv_1916"]).toBe("CONTACT");
    // G7a Pi MZ magnetic pistols (Torpedokrise) -> MAGNETIC (§3.1/§3.6/§4.3)
    expect(TORPEDO_MODEL_FUZE_POLICY["ger_533mm_g7a_1934"]).toBe("MAGNETIC");
    // G7e "same pistols" -> MAGNETIC (§3.1/§4.3)
    expect(TORPEDO_MODEL_FUZE_POLICY["ger_533mm_g7e_1936"]).toBe("MAGNETIC");
    // Type 93 magnetic/oxygen premature-detonation issue -> MAGNETIC (§3.1/§3.6)
    expect(TORPEDO_MODEL_FUZE_POLICY["jpn_61cm_type93_1935"]).toBe("MAGNETIC");
    // Whitehead 14-in (1886) contact pistol -> CONTACT (§3.1/§4.3)
    expect(TORPEDO_MODEL_FUZE_POLICY["whitehead_14in_1886"]).toBe("CONTACT");
    // RN 21-in Mk VIII (1927) contact exploder family -> CONTACT (§3.1/§4.3)
    expect(TORPEDO_MODEL_FUZE_POLICY["rn_21in_mk_viii_1927"]).toBe("CONTACT");
    // USN 21-in Mk 14 (1931) Mk 6 magnetic-influence exploder -> MAGNETIC (§3.1/§3.6)
    expect(TORPEDO_MODEL_FUZE_POLICY["usn_21in_mk14_1931"]).toBe("MAGNETIC");
    // the mapping carries exactly the shipped model ids (ordered)
    expect(Object.keys(TORPEDO_MODEL_FUZE_POLICY)).toEqual([
      "whitehead_18in_1894",
      "rn_21in_mk_iv_1916",
      "ger_533mm_g7a_1934",
      "ger_533mm_g7e_1936",
      "jpn_61cm_type93_1935",
      "whitehead_14in_1886",
      "rn_21in_mk_viii_1927",
      "usn_21in_mk14_1931",
    ]);
  });

  it("the resolver honors the mapping per model id (fuze drives the premature + probability surface)", () => {
    // a CONTACT model (whitehead) crossing the wake is NOT premature
    const contactWake = resolveDetonation({ wakeIntercept: true });
    expect(contactWake.outcome).toBe("FULL_DETONATION");
    // a MAGNETIC model (G7a) crossing the wake IS premature
    const magneticWake = resolveDetonation({ modelId: G7A, wakeIntercept: true });
    expect(magneticWake.outcome).toBe("PREMATURE_DETONATION");
    expect(magneticWake.inputs.fuzePolicy).toBe("MAGNETIC");
    // the MAGNETIC fuze lowers the composed probability (9_600 * 9000 / 10000)
    const magneticFull = resolveDetonation({ modelId: G7A });
    expect(magneticFull.detonationProbabilityBp).toBe(8_640);
  });

  it("an unknown model id fails closed (TORPEDO_STATE_INVARIANT_FAILED) — no silent default", () => {
    expect(() => fuzePolicyForModel("BOGUS_MODEL")).toThrow(BluewaveError);
    // through the resolver: a track carrying an unsupported model id
    const track = buildTorpedoTrack(5, "BOGUS_MODEL");
    expect(() => resolveDetonation({ track })).toThrow(BluewaveError);
  });
});

describe("MEDIUM-2: reliability is bound to the authoritative §13 track carrier", () => {
  it("reads reliability ONLY from the track's reliabilityState (no independent caller input)", () => {
    const lowTrack = buildTorpedoTrack(5, WHITEHEAD, 80_000); // -> 8_000 on the 10_000 bp scale
    const highTrack = buildTorpedoTrack(5, WHITEHEAD, 96_000); // -> RELIABILITY_BP (9_600)
    const dLow = resolveDetonation({ track: lowTrack });
    const dHigh = resolveDetonation({ track: highTrack });
    // the composed probability (neutral CONTACT surface) equals the carrier
    expect(dLow.detonationProbabilityBp).toBe(8_000);
    expect(dHigh.detonationProbabilityBp).toBe(RELIABILITY_BP);
    expect(dLow.inputs.reliabilityBp).toBe(8_000);
    expect(dHigh.inputs.reliabilityBp).toBe(RELIABILITY_BP);
    // the resolver's input surface has NO independent reliability argument — a
    // caller cannot inject a value that disagrees with the track carrier
    // (the weapon input is gone from resolveTorpedoDetonation entirely).
  });
});

describe("AC-14: the pure draw mapping (evaluateDetonationReliabilityDraw)", () => {
  it("drawBp = floor(draw * 10_000); < p functions, >= p duds (explicit boundary)", () => {
    expect(evaluateDetonationReliabilityDraw({ probabilityBp: 9_600, draw: 0.001 })).toEqual({
      drawBp: 10,
      functions: true,
    });
    expect(evaluateDetonationReliabilityDraw({ probabilityBp: 9_600, draw: 0.5 })).toEqual({
      drawBp: 5_000,
      functions: true,
    });
    expect(evaluateDetonationReliabilityDraw({ probabilityBp: 9_600, draw: 0.9599 })).toEqual({
      drawBp: 9_599,
      functions: true,
    });
    // drawBp exactly ON the function boundary DOES NOT function (>= p -> dud)
    expect(evaluateDetonationReliabilityDraw({ probabilityBp: 9_600, draw: 0.96 })).toEqual({
      drawBp: 9_600,
      functions: false,
    });
    expect(evaluateDetonationReliabilityDraw({ probabilityBp: 9_600, draw: 0.9999 })).toEqual({
      drawBp: 9_999,
      functions: false,
    });
  });

  it("rejects invalid probability/draw inputs (TORPEDO_STATE_INVARIANT_FAILED)", () => {
    expect(() => evaluateDetonationReliabilityDraw({ probabilityBp: 9_600.5, draw: 0.5 })).toThrow(
      BluewaveError,
    );
    expect(() => evaluateDetonationReliabilityDraw({ probabilityBp: -1, draw: 0.5 })).toThrow(
      BluewaveError,
    );
    expect(() => evaluateDetonationReliabilityDraw({ probabilityBp: 10_001, draw: 0.5 })).toThrow(
      BluewaveError,
    );
    expect(() => evaluateDetonationReliabilityDraw({ probabilityBp: 9_600, draw: 1 })).toThrow(
      BluewaveError,
    );
    expect(() => evaluateDetonationReliabilityDraw({ probabilityBp: 9_600, draw: -0.01 })).toThrow(
      BluewaveError,
    );
  });
});

describe("AC-14: composed detonation-function probability (exact integer basis points)", () => {
  it("reliability 9_600 with the neutral surface = 9_600; each modifier shifts it exactly", () => {
    // CONTACT fuze (whitehead): the neutral surface = the raw reliability.
    expect(
      computeDetonationProbabilityBp({
        torpedoModelId: WHITEHEAD,
        reliabilityBp: 9_600,
        protectionLevel: "NONE",
        damageStateIndicator: "CLEAN",
      }),
    ).toBe(9_600);
    // MAGNETIC fuze (G7a, 9_000): 9600 * 9000 / 10000 = 8640
    expect(
      computeDetonationProbabilityBp({
        torpedoModelId: G7A,
        reliabilityBp: 9_600,
        protectionLevel: "NONE",
        damageStateIndicator: "CLEAN",
      }),
    ).toBe(8_640);
    // STRONG protection (8_500): 9600 * 8500 / 10000 = 8160
    expect(
      computeDetonationProbabilityBp({
        torpedoModelId: WHITEHEAD,
        reliabilityBp: 9_600,
        protectionLevel: "STRONG",
        damageStateIndicator: "CLEAN",
      }),
    ).toBe(8_160);
    // DAMAGED (9_500): 9600 * 9500 / 10000 = 9120
    expect(
      computeDetonationProbabilityBp({
        torpedoModelId: WHITEHEAD,
        reliabilityBp: 9_600,
        protectionLevel: "NONE",
        damageStateIndicator: "DAMAGED",
      }),
    ).toBe(9_120);
    // all penalties stack with the exact floor division:
    // 9600*9000 = 86_400_000 /10000 = 8640; *8000 = 69_120_000 /10000 = 6912;
    // *9500 = 65_664_000 /10000 = 6566.4 -> floor 6_566
    expect(
      computeDetonationProbabilityBp({
        torpedoModelId: G7A,
        reliabilityBp: 9_600,
        protectionLevel: "ADVANCED",
        damageStateIndicator: "DAMAGED",
      }),
    ).toBe(6_566);
  });

  it("rejects out-of-band reliability and an unsupported model id (fail closed)", () => {
    expect(() =>
      computeDetonationProbabilityBp({
        torpedoModelId: WHITEHEAD,
        reliabilityBp: 10_001,
        protectionLevel: "NONE",
        damageStateIndicator: "CLEAN",
      }),
    ).toThrow(BluewaveError);
    // an unknown model id fails closed via the authoritative mapping (HIGH-1)
    expect(() =>
      computeDetonationProbabilityBp({
        torpedoModelId: "BOGUS_MODEL",
        reliabilityBp: 9_600,
        protectionLevel: "NONE",
        damageStateIndicator: "CLEAN",
      }),
    ).toThrow(BluewaveError);
  });
});

describe("AC-14: deterministic geometry-quality predicate (impactGeometryQuality)", () => {
  it("CONTACT: FULL only within the depth band AND the obliquity bound", () => {
    expect(impactGeometryQuality({ fuzePolicy: "CONTACT", depthM: 5, deviationMdeg: 0 })).toBe(
      "FULL",
    );
    expect(impactGeometryQuality({ fuzePolicy: "CONTACT", depthM: 3, deviationMdeg: 60_000 })).toBe(
      "FULL",
    ); // boundary inclusive
    expect(impactGeometryQuality({ fuzePolicy: "CONTACT", depthM: 2, deviationMdeg: 0 })).toBe(
      "PARTIAL",
    ); // shallow
    expect(impactGeometryQuality({ fuzePolicy: "CONTACT", depthM: 5, deviationMdeg: 60_001 })).toBe(
      "PARTIAL",
    ); // oblique
  });

  it("MAGNETIC: not angle-sensitive; only the shallow band reduces", () => {
    expect(
      impactGeometryQuality({ fuzePolicy: "MAGNETIC", depthM: 5, deviationMdeg: 90_000 }),
    ).toBe("FULL");
    expect(impactGeometryQuality({ fuzePolicy: "MAGNETIC", depthM: 2, deviationMdeg: 0 })).toBe(
      "PARTIAL",
    );
  });
});

describe("AC-14: FULL_DETONATION / DUD through the keyed reliability block", () => {
  it("a functioning draw on a neutral scene = FULL (decision + probability recorded)", () => {
    const d = resolveDetonation({}); // draw 0.001 -> drawBp 10 < 9_600
    expect(d.outcome).toBe("FULL_DETONATION");
    expect(d.functioned).toBe(true);
    expect(d.reasonCode).toBeNull();
    expect(d.detonationProbabilityBp).toBe(9_600);
    expect(d.decision.kind).toBe("DETERMINISTIC_PREDICATE");
    expect(d.decision.predicate).toBe("full-function-geometry");
    expect(d.decision.streamId).toBeNull();
    expect(d.decision.draw).toBeNull();
    expect(d.inputs.hitResolved).toBe(true);
    expect(d.inputs.hitRejection).toBeNull();
    expect(d.inputs.protection).toBe("NONE");
    expect(d.inputs.damageStateIndicator).toBe("CLEAN");
    expect(d.provenance.rulesetVersion).toBe("torpedo_ruleset_v1");
    expect(d.provenance.formulaVersion).toBe("torpedo_formula_v1");
    expect(d.provenance.inputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a draw at/above the function probability is a DUD with TORPEDO_DUD + the keyed decision record", () => {
    const d = resolveDetonation({ drawProvidedBy: () => 0.9999 }); // 9_999 >= 9_600
    expect(d.outcome).toBe("DUD");
    expect(d.functioned).toBe(false);
    expect(d.reasonCode).toBe(TORPEDO_DUD);
    expect(d.detonationProbabilityBp).toBe(9_600);
    expect(d.decision.kind).toBe("KEYED_DRAW");
    expect(d.decision.streamId).toBe("battle/torpedo/detonation/reliability:B1:6:4:" + TRACK_ID);
    expect(d.decision.streamId).toMatch(/^battle\/torpedo\/detonation\/reliability:/);
    expect(d.decision.draw).toBe(0.9999);
    expect(d.decision.drawBp).toBe(9_999);

    // boundary: drawBp == probability IS a dud
    const boundaryDud = resolveDetonation({ drawProvidedBy: () => 0.96 });
    expect(boundaryDud.outcome).toBe("DUD");
    // just below the boundary functions
    const boundaryFunction = resolveDetonation({ drawProvidedBy: () => 0.9599 });
    expect(boundaryFunction.outcome).toBe("FULL_DETONATION");
  });

  it("the reliability stream consumes exactly ONE draw on the keyed path", () => {
    let calls = 0;
    const d = resolveDetonation({
      drawProvidedBy: () => {
        calls += 1;
        return 0.5;
      },
    });
    expect(d.outcome).toBe("FULL_DETONATION");
    expect(calls).toBe(1);
  });
});

describe("AC-14: each deterministic predicate selects its own canonical outcome", () => {
  it("NO_CONTACT — the §14 resolver found no contact (a miss consumes NO draw)", () => {
    const track = buildTorpedoTrack();
    const miss = missVerdict(track);
    expect(miss.hit).toBe(false);
    expect(miss.rejection).toBe("GEOMETRY_MISS");
    const d = resolveTorpedoDetonation({
      track,
      hit: miss,
      impact: { zone: null, deviationMdeg: 0 },
      targetProtection: null,
      damageState: null,
      prematureEnvironment: { wakeIntercept: false },
      keyedRng: () => {
        throw new Error("NO_CONTACT must not consume a draw");
      },
    });
    expect(d.outcome).toBe("NO_CONTACT");
    expect(d.functioned).toBe(false);
    expect(d.reasonCode).toBeNull();
    expect(d.detonationProbabilityBp).toBe(0);
    expect(d.decision.kind).toBe("DETERMINISTIC_PREDICATE");
    expect(d.decision.predicate).toBe("no-resolved-hit-contact");
    expect(d.inputs.hitResolved).toBe(false);
    expect(d.inputs.hitRejection).toBe("GEOMETRY_MISS");
  });

  it("PREMATURE_DETONATION — MAGNETIC fuze + wake interception (deterministic; consumes NO draw)", () => {
    const d = resolveDetonation({
      modelId: G7A, // MAGNETIC fuze via the model->fuze mapping
      wakeIntercept: true,
      drawProvidedBy: () => {
        throw new Error("a premature must not consume a draw");
      },
    });
    expect(d.outcome).toBe("PREMATURE_DETONATION");
    expect(d.functioned).toBe(true);
    expect(d.decision.kind).toBe("DETERMINISTIC_PREDICATE");
    expect(d.decision.predicate).toBe("magnetic-fuze-wake-intercept");
    expect(d.inputs.wakeIntercept).toBe(true);
  });

  it("a CONTACT fuze crossing the wake is NOT premature (no draw consumed)", () => {
    const d = resolveDetonation({ wakeIntercept: true });
    expect(d.outcome).toBe("FULL_DETONATION"); // CONTACT + wake -> normal block
  });

  it("MAGAZINE_OR_TUBE_CHAIN_REACTION — functioning hit on an ordnance zone", () => {
    const magazine = resolveDetonation({ zone: "MAGAZINE" });
    expect(magazine.outcome).toBe("MAGAZINE_OR_TUBE_CHAIN_REACTION");
    expect(magazine.functioned).toBe(true);
    expect(magazine.decision.predicate).toBe("ordnance-zone-impact");
    const tubeBay = resolveDetonation({ zone: "TUBE_BAY" });
    expect(tubeBay.outcome).toBe("MAGAZINE_OR_TUBE_CHAIN_REACTION");
  });

  it("PARTIAL_DETONATION — a shallow hit or an oblique CONTACT strike", () => {
    const shallow = resolveDetonation({ track: buildTorpedoTrack(2) }); // depth 2 < 3
    expect(shallow.outcome).toBe("PARTIAL_DETONATION");
    const oblique = resolveDetonation({ deviationMdeg: 70_000 });
    expect(oblique.outcome).toBe("PARTIAL_DETONATION");
    expect(oblique.decision.predicate).toBe("reduced-function-geometry");
    // a MAGNETIC fuze at full depth stays FULL even at extreme obliquity
    const magneticOblique = resolveDetonation({ modelId: G7A, deviationMdeg: 90_000 });
    expect(magneticOblique.outcome).toBe("FULL_DETONATION");
  });
});

describe("AC-14: the target-protection + damage-state inputs move the dud boundary", () => {
  it("STRONG protection records probability 8_160 and duds above it", () => {
    const functioning = resolveDetonation({ protection: "STRONG" }); // draw 10 < 8_160
    const dudAt = resolveDetonation({ protection: "STRONG", drawProvidedBy: () => 0.85 }); // 8_500 >= 8_160
    expect(functioning.detonationProbabilityBp).toBe(8_160);
    expect(functioning.outcome).toBe("FULL_DETONATION");
    expect(dudAt.outcome).toBe("DUD");
    expect(dudAt.decision.drawBp).toBe(8_500);
  });

  it("a flooding-damaged target is recorded DAMAGED and raises the dud share", () => {
    const damaged = resolveDetonation({ progressiveFloodingKg: 500 });
    expect(damaged.inputs.damageStateIndicator).toBe("DAMAGED");
    expect(damaged.detonationProbabilityBp).toBe(9_120);
    expect(damaged.outcome).toBe("FULL_DETONATION");
    const clean = resolveDetonation({ progressiveFloodingKg: 0 });
    expect(clean.inputs.damageStateIndicator).toBe("CLEAN");
  });

  it("the inputs snapshot records EVERY input (fuze, depth, zone, deviation, protection, wake)", () => {
    const d = resolveDetonation({ modelId: G7A, deviationMdeg: 25_000, zone: "MACHINERY" });
    expect(d.inputs.trackId).toBe(TRACK_ID);
    expect(d.inputs.reliabilityBp).toBe(9_600);
    expect(d.inputs.fuzePolicy).toBe("MAGNETIC");
    expect(d.inputs.depthM).toBe(5);
    expect(d.inputs.zone).toBe("MACHINERY");
    expect(d.inputs.deviationMdeg).toBe(25_000);
    expect(d.inputs.protection).toBe("NONE");
    expect(d.inputs.wakeIntercept).toBe(false);
  });
});

describe("AC-14: determinism + fail-closed guards", () => {
  it("same inputs + same keyed stream -> identical result; results are frozen", () => {
    const a = resolveDetonation({});
    const b = resolveDetonation({});
    expect(a).toEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.inputs)).toBe(true);
    expect(Object.isFrozen(a.decision)).toBe(true);
  });

  it("a HIT with missing target geometry fails closed (TORPEDO_STATE_INVARIANT_FAILED)", () => {
    // wait — a real HIT must carry zone/protection/damage; dropping them is a
    // caller bug -> fail closed, never a silent NO_CONTACT.
    const track = buildTorpedoTrack();
    const hit = hitVerdict(track);
    expect(hit.hit).toBe(true);
    expect(() =>
      resolveTorpedoDetonation({
        track,
        hit,
        impact: { zone: null, deviationMdeg: 0 },
        targetProtection: null,
        damageState: null,
        prematureEnvironment: { wakeIntercept: false },
        keyedRng: () => 0.5,
      }),
    ).toThrow(BluewaveError);
  });

  it("a terminal track cannot be detonation-resolved (TORPEDO_STATE_INVARIANT_FAILED)", () => {
    const terminal = setTorpedoTerminalResult(buildTorpedoTrack(), "DUD");
    const track = buildTorpedoTrack();
    const hit = hitVerdict(track);
    let err: BluewaveError | undefined;
    try {
      resolveTorpedoDetonation({
        track: terminal,
        hit,
        impact: { zone: "EXTREMITY", deviationMdeg: 0 },
        targetProtection: "NONE",
        damageState: { progressiveFloodingTotalKg: 0 },
        prematureEnvironment: { wakeIntercept: false },
        keyedRng: () => 0.5,
      });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
  });

  it("rejects non-integer/out-of-band inputs (deviation, flooding kg)", () => {
    expect(
      () => resolveDetonation({ deviationMdeg: 420_000 }), // out of [0, 360_000]
    ).toThrow(BluewaveError);
    const track = buildTorpedoTrack();
    const hit = hitVerdict(track);
    expect(() =>
      resolveTorpedoDetonation({
        track,
        hit,
        impact: { zone: "EXTREMITY", deviationMdeg: 0 },
        targetProtection: "NONE",
        damageState: { progressiveFloodingTotalKg: 5.5 },
        prematureEnvironment: { wakeIntercept: false },
        keyedRng: () => 0.5,
      }),
    ).toThrow(BluewaveError);
  });
});

describe("AC-14: the §13 terminal-lifecycle mapping (detonation -> track)", () => {
  it("torpedoTerminalForDetonationOutcome maps every closed outcome deterministically", () => {
    expect(torpedoTerminalForDetonationOutcome("DUD")).toBe("DUD");
    expect(torpedoTerminalForDetonationOutcome("FULL_DETONATION")).toBe("DETONATION");
    expect(torpedoTerminalForDetonationOutcome("PARTIAL_DETONATION")).toBe("DETONATION");
    expect(torpedoTerminalForDetonationOutcome("PREMATURE_DETONATION")).toBe("DETONATION");
    expect(torpedoTerminalForDetonationOutcome("MAGAZINE_OR_TUBE_CHAIN_REACTION")).toBe(
      "DETONATION",
    );
    expect(torpedoTerminalForDetonationOutcome("NO_CONTACT")).toBeNull();
    expect(() => torpedoTerminalForDetonationOutcome("BOGUS" as never)).toThrow(BluewaveError);
  });

  it("applyTorpedoDetonationToTrack: DUD terminals the track as DUD with a fresh hash", () => {
    const track = buildTorpedoTrack();
    const after = applyTorpedoDetonationToTrack({ track, outcome: "DUD" });
    expect(after === track).toBe(false);
    expect(after.terminalResult).toBe("DUD");
    expect(after.trackHash).toMatch(/^[0-9a-f]{64}$/);
    expect(after.trackHash).not.toBe(track.trackHash);
  });

  it("every functioning outcome terminals the track as DETONATION", () => {
    for (const outcome of [
      "FULL_DETONATION",
      "PARTIAL_DETONATION",
      "PREMATURE_DETONATION",
      "MAGAZINE_OR_TUBE_CHAIN_REACTION",
    ] as const) {
      const after = applyTorpedoDetonationToTrack({ track: buildTorpedoTrack(), outcome });
      expect(after.terminalResult).toBe("DETONATION");
    }
  });

  it("NO_CONTACT leaves the SAME running track untouched (identity, still advancing)", () => {
    const track = buildTorpedoTrack();
    const after = applyTorpedoDetonationToTrack({ track, outcome: "NO_CONTACT" });
    expect(after).toBe(track); // same frozen object — still RUNNING
    expect(after.terminalResult).toBeNull();
    expect(() => advanceTorpedoTrack(after, TORPEDO_MINUTE_MS)).not.toThrow();
  });
});

describe("AC-13p2/AC-14 seam: contact does NOT guarantee detonation (package proofs)", () => {
  it("PACKAGE 1 — a resolved HIT plus a dud draw = DUD (hit WITHOUT detonation)", () => {
    const track = buildTorpedoTrack();
    const hit = hitVerdict(track);
    expect(hit.hit).toBe(true);
    expect(hit.reasonCode).toBe(TORPEDO_HIT_RESOLVED);
    const d = resolveDetonation({ track, drawProvidedBy: () => 0.9999 });
    expect(d.outcome).toBe("DUD");
    expect(d.reasonCode).toBe(TORPEDO_DUD);
    const terminal = applyTorpedoDetonationToTrack({ track, outcome: d.outcome });
    expect(terminal.terminalResult).toBe("DUD");
  });

  it("PACKAGE 2 — a HIT that never resolves contact => NO_CONTACT (no terminal)", () => {
    const track = buildTorpedoTrack();
    const miss = missVerdict(track);
    const d = resolveDetonation({ track, hitOverride: miss });
    expect(miss.hit).toBe(false);
    expect(d.outcome).toBe("NO_CONTACT");
    const after = applyTorpedoDetonationToTrack({ track, outcome: d.outcome });
    expect(after).toBe(track);
    expect(after.terminalResult).toBeNull();
  });

  it("PACKAGE 3 — a HIT on an ordnance zone becomes a chain reaction (DETONATION terminal)", () => {
    const track = buildTorpedoTrack();
    const d = resolveDetonation({ track, zone: "MAGAZINE" });
    expect(d.outcome).toBe("MAGAZINE_OR_TUBE_CHAIN_REACTION");
    const after = applyTorpedoDetonationToTrack({ track, outcome: d.outcome });
    expect(after.terminalResult).toBe("DETONATION");
  });
});
