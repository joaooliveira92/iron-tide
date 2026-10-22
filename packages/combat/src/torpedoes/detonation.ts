import { BluewaveError } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import {
  SEED_TORPEDO_MODEL_IDS,
  TORPEDO_BASIS_POINTS_PER_UNIT,
  TORPEDO_FORMULA_VERSION,
  TORPEDO_RULESET_VERSION,
  type TorpedoTerminalResult,
} from "./constants.js";
import { TORPEDO_DUD, TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";
import {
  assertAuthoritativeTorpedoTrack,
  setTorpedoTerminalResult,
  type TorpedoTrack,
} from "./track.js";
import type { TorpedoHitResolution } from "./hit-resolution.js";

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

export const TORPEDO_DETONATION_OUTCOMES = [
  "DUD",
  "PARTIAL_DETONATION",
  "FULL_DETONATION",
  "PREMATURE_DETONATION",
  "MAGAZINE_OR_TUBE_CHAIN_REACTION",
  "NO_CONTACT",
] as const;
export type TorpedoDetonationOutcome = (typeof TORPEDO_DETONATION_OUTCOMES)[number];

export function isDetonationOutcome(v: string): v is TorpedoDetonationOutcome {
  return (TORPEDO_DETONATION_OUTCOMES as readonly string[]).includes(v);
}

export const TORPEDO_FUZE_POLICIES = ["CONTACT", "MAGNETIC"] as const;
export type TorpedoFuzePolicy = (typeof TORPEDO_FUZE_POLICIES)[number];

export const TORPEDO_MODEL_FUZE_POLICY: Record<string, TorpedoFuzePolicy> = {
  whitehead_18in_1894: "CONTACT",
  rn_21in_mk_iv_1916: "CONTACT",
  ger_533mm_g7a_1934: "MAGNETIC",
  ger_533mm_g7e_1936: "MAGNETIC",
  jpn_61cm_type93_1935: "MAGNETIC",
  whitehead_14in_1886: "CONTACT",
  rn_21in_mk_viii_1927: "CONTACT",
  usn_21in_mk14_1931: "MAGNETIC",
};

export function fuzePolicyForModel(torpedoModelId: string): TorpedoFuzePolicy {
  const fuze = TORPEDO_MODEL_FUZE_POLICY[torpedoModelId];
  if (fuze === undefined) {
    invariant(
      "torpedoModelId",
      torpedoModelId,
      `no shipped model->fuze policy for torpedo model id ${torpedoModelId}`,
    );
  }
  return fuze;
}

export const TORPEDO_IMPACT_ZONES = [
  "EXTREMITY",
  "MACHINERY",
  "MAGAZINE",
  "TUBE_BAY",
  "CENTRAL",
  "BREACHED",
] as const;
export type TorpedoImpactZone = (typeof TORPEDO_IMPACT_ZONES)[number];
export const TORPEDO_ORDNANCE_IMPACT_ZONES = ["MAGAZINE", "TUBE_BAY"] as const;

export const TORPEDO_TARGET_PROTECTION_LEVELS = [
  "NONE",
  "WEAK",
  "STANDARD",
  "STRONG",
  "ADVANCED",
] as const;
export type TorpedoTargetProtectionLevel = (typeof TORPEDO_TARGET_PROTECTION_LEVELS)[number];

export type TorpedoDamageStateIndicator = "CLEAN" | "DAMAGED";

export const TORPEDO_FUZE_FUNCTION_MULTIPLIER_BP: Record<TorpedoFuzePolicy, number> = {
  CONTACT: 10_000,
  MAGNETIC: 9_000,
};
export const TORPEDO_PROTECTION_FUNCTION_MULTIPLIER_BP: Record<
  TorpedoTargetProtectionLevel,
  number
> = {
  NONE: 10_000,
  WEAK: 9_500,
  STANDARD: 9_000,
  STRONG: 8_500,
  ADVANCED: 8_000,
};
export const TORPEDO_DAMAGE_STATE_FUNCTION_MULTIPLIER_BP: Record<
  TorpedoDamageStateIndicator,
  number
> = {
  CLEAN: 10_000,
  DAMAGED: 9_500,
};
export const TORPEDO_FULL_FUNCTION_MIN_DEPTH_M = 3 as const;
export const TORPEDO_FULL_FUNCTION_MAX_DEVIATION_MDEG = 60_000 as const;

export interface TorpedoDetonationContract {
  fuzePolicies: readonly TorpedoFuzePolicy[];
  fuzeFunctionMultiplierBp: Record<TorpedoFuzePolicy, number>;
  targetProtectionLevels: readonly TorpedoTargetProtectionLevel[];
  protectionFunctionMultiplierBp: Record<TorpedoTargetProtectionLevel, number>;
  damageStateFunctionMultiplierBp: Record<TorpedoDamageStateIndicator, number>;
  fullFunctionMinDepthM: number;
  fullFunctionMaxDeviationMdeg: number;
  modelFuzePolicy: Record<string, TorpedoFuzePolicy>;
}

export const SHIPPED_TORPEDO_DETONATION_CONTRACT: TorpedoDetonationContract = {
  fuzePolicies: TORPEDO_FUZE_POLICIES,
  fuzeFunctionMultiplierBp: TORPEDO_FUZE_FUNCTION_MULTIPLIER_BP,
  targetProtectionLevels: TORPEDO_TARGET_PROTECTION_LEVELS,
  protectionFunctionMultiplierBp: TORPEDO_PROTECTION_FUNCTION_MULTIPLIER_BP,
  damageStateFunctionMultiplierBp: TORPEDO_DAMAGE_STATE_FUNCTION_MULTIPLIER_BP,
  fullFunctionMinDepthM: TORPEDO_FULL_FUNCTION_MIN_DEPTH_M,
  fullFunctionMaxDeviationMdeg: TORPEDO_FULL_FUNCTION_MAX_DEVIATION_MDEG,
  modelFuzePolicy: TORPEDO_MODEL_FUZE_POLICY,
};

function throwContractMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

function contractArrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function contractRecordEquals(
  a: Record<string, number> | null | undefined,
  b: Record<string, number>,
): boolean {
  if (!a) return false;
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (!contractArrayEquals(aKeys, bKeys)) return false;
  return bKeys.every((k) => a[k] === b[k]);
}

export function validateTorpedoDetonationContract(
  c: Partial<TorpedoDetonationContract> | null | undefined,
): asserts c is TorpedoDetonationContract {
  if (!c) throwContractMismatch(c, "torpedo_v1 detonation contract missing");
  if (!c.fuzePolicies || !contractArrayEquals(c.fuzePolicies, TORPEDO_FUZE_POLICIES))
    throwContractMismatch(c, "torpedo_v1 §15 fuze-policy closed enum");
  if (!contractRecordEquals(c.fuzeFunctionMultiplierBp, TORPEDO_FUZE_FUNCTION_MULTIPLIER_BP))
    throwContractMismatch(c, "torpedo_v1 §15 fuze-function multiplier");
  if (
    !c.targetProtectionLevels ||
    !contractArrayEquals(c.targetProtectionLevels, TORPEDO_TARGET_PROTECTION_LEVELS)
  )
    throwContractMismatch(c, "torpedo_v1 §17 target-protection closed enum");
  if (
    !contractRecordEquals(
      c.protectionFunctionMultiplierBp,
      TORPEDO_PROTECTION_FUNCTION_MULTIPLIER_BP,
    )
  )
    throwContractMismatch(c, "torpedo_v1 §15 target-protection function multiplier");
  if (
    !contractRecordEquals(
      c.damageStateFunctionMultiplierBp,
      TORPEDO_DAMAGE_STATE_FUNCTION_MULTIPLIER_BP,
    )
  )
    throwContractMismatch(c, "torpedo_v1 §15 damage-state function multiplier");
  if (c.fullFunctionMinDepthM !== TORPEDO_FULL_FUNCTION_MIN_DEPTH_M)
    throwContractMismatch(c, "torpedo_v1 §15 full-function min depth");
  if (c.fullFunctionMaxDeviationMdeg !== TORPEDO_FULL_FUNCTION_MAX_DEVIATION_MDEG)
    throwContractMismatch(c, "torpedo_v1 §15 full-function max deviation");
  if (!c.modelFuzePolicy) throwContractMismatch(c, "torpedo_v1 model->fuze mapping missing");
  if (!contractArrayEquals(Object.keys(c.modelFuzePolicy), [...SEED_TORPEDO_MODEL_IDS]))
    throwContractMismatch(c, "torpedo_v1 model->fuze mapping shipped model key set");
  for (const modelId of SEED_TORPEDO_MODEL_IDS) {
    const fuze = c.modelFuzePolicy[modelId];
    if (fuze !== TORPEDO_MODEL_FUZE_POLICY[modelId])
      throwContractMismatch(c, `torpedo_v1 model->fuze mapping for ${modelId}`);
  }
}

export function torpedoDetonationReliabilityStreamId(o: {
  battleId: string;
  impactMinute: number;
  impactSubstep: number;
  torpedoTrackId: string;
}): string {
  return `battle/torpedo/detonation/reliability:${o.battleId}:${o.impactMinute}:${o.impactSubstep}:${o.torpedoTrackId}`;
}

export function evaluateDetonationReliabilityDraw(o: { probabilityBp: number; draw: number }): {
  drawBp: number;
  functions: boolean;
} {
  if (
    !isInt(o.probabilityBp) ||
    o.probabilityBp < 0 ||
    o.probabilityBp > TORPEDO_BASIS_POINTS_PER_UNIT
  )
    invariant(
      "probabilityBp",
      o.probabilityBp,
      `detonation probability must be an integer bp within [0, ${TORPEDO_BASIS_POINTS_PER_UNIT}]`,
    );
  if (typeof o.draw !== "number" || o.draw < 0 || o.draw >= 1)
    invariant("draw", o.draw, "the keyed draw must be a float within [0, 1)");
  const drawBp = Math.floor(o.draw * TORPEDO_BASIS_POINTS_PER_UNIT);
  return { drawBp, functions: drawBp < o.probabilityBp };
}

export function computeDetonationProbabilityBp(o: {
  torpedoModelId: string;
  reliabilityBp: number;
  protectionLevel: TorpedoTargetProtectionLevel;
  damageStateIndicator: TorpedoDamageStateIndicator;
}): number {
  if (
    !isInt(o.reliabilityBp) ||
    o.reliabilityBp < 0 ||
    o.reliabilityBp > TORPEDO_BASIS_POINTS_PER_UNIT
  )
    invariant(
      "reliabilityBp",
      o.reliabilityBp,
      "reliability must be an integer bp within [0, 10_000]",
    );
  const fuzePolicy = fuzePolicyForModel(o.torpedoModelId);
  if (!(TORPEDO_TARGET_PROTECTION_LEVELS as readonly string[]).includes(o.protectionLevel))
    invariant("protectionLevel", o.protectionLevel, "protection must be a canonical §17 level");
  if (o.damageStateIndicator !== "CLEAN" && o.damageStateIndicator !== "DAMAGED")
    invariant(
      "damageStateIndicator",
      o.damageStateIndicator,
      "damage-state indicator must be CLEAN or DAMAGED",
    );
  const num =
    BigInt(o.reliabilityBp) *
    BigInt(TORPEDO_FUZE_FUNCTION_MULTIPLIER_BP[fuzePolicy]) *
    BigInt(TORPEDO_PROTECTION_FUNCTION_MULTIPLIER_BP[o.protectionLevel]) *
    BigInt(TORPEDO_DAMAGE_STATE_FUNCTION_MULTIPLIER_BP[o.damageStateIndicator]);
  const den = BigInt(TORPEDO_BASIS_POINTS_PER_UNIT) ** 3n;
  const raw = Number(num / den);
  return Math.min(TORPEDO_BASIS_POINTS_PER_UNIT, Math.max(0, raw));
}

function damageStateIndicatorOf(progressiveFloodingTotalKg: number): TorpedoDamageStateIndicator {
  if (!isInt(progressiveFloodingTotalKg) || progressiveFloodingTotalKg < 0)
    invariant(
      "progressiveFloodingTotalKg",
      progressiveFloodingTotalKg,
      "progressive flooding must be a non-negative integer kg",
    );
  return progressiveFloodingTotalKg > 0 ? "DAMAGED" : "CLEAN";
}

export function impactGeometryQuality(o: {
  fuzePolicy: TorpedoFuzePolicy;
  depthM: number;
  deviationMdeg: number;
}): "FULL" | "PARTIAL" {
  if (!(TORPEDO_FUZE_POLICIES as readonly string[]).includes(o.fuzePolicy))
    invariant("fuzePolicy", o.fuzePolicy, "fuze policy must be a canonical §15 fuze");
  if (!isInt(o.depthM) || o.depthM < 0)
    invariant("depthM", o.depthM, "impact depth must be a non-negative integer metre");
  if (!isInt(o.deviationMdeg) || o.deviationMdeg < 0 || o.deviationMdeg > 360_000)
    invariant(
      "deviationMdeg",
      o.deviationMdeg,
      "strike deviation must be an integer milli-degree within [0, 360_000]",
    );
  const shallow = o.depthM < TORPEDO_FULL_FUNCTION_MIN_DEPTH_M;
  if (o.fuzePolicy === "MAGNETIC") return shallow ? "PARTIAL" : "FULL";
  const oblique = o.deviationMdeg > TORPEDO_FULL_FUNCTION_MAX_DEVIATION_MDEG;
  return shallow || oblique ? "PARTIAL" : "FULL";
}

export interface TorpedoDetonationDecision {
  kind: "DETERMINISTIC_PREDICATE" | "KEYED_DRAW";
  predicate: string | null;
  streamId: string | null;
  draw: number | null;
  drawBp: number | null;
}

export interface TorpedoDetonationResolution {
  outcome: TorpedoDetonationOutcome;
  reasonCode: string | null;
  detonationProbabilityBp: number;
  functioned: boolean;
  decision: TorpedoDetonationDecision;
  inputs: {
    trackId: string;
    hitResolved: boolean;
    hitRejection: string | null;
    reliabilityBp: number;
    fuzePolicy: TorpedoFuzePolicy;
    depthM: number;
    zone: TorpedoImpactZone | null;
    deviationMdeg: number;
    protection: TorpedoTargetProtectionLevel | null;
    damageStateIndicator: TorpedoDamageStateIndicator | null;
    wakeIntercept: boolean;
  };
  provenance: { rulesetVersion: string; formulaVersion: string; inputHash: string };
}

function buildResolution(o: {
  outcome: TorpedoDetonationOutcome;
  reasonCode: string | null;
  detonationProbabilityBp: number;
  functioned: boolean;
  decision: TorpedoDetonationDecision;
  inputs: TorpedoDetonationResolution["inputs"];
  provenance: TorpedoDetonationResolution["provenance"];
}): TorpedoDetonationResolution {
  return Object.freeze({
    outcome: o.outcome,
    reasonCode: o.reasonCode,
    detonationProbabilityBp: o.detonationProbabilityBp,
    functioned: o.functioned,
    decision: Object.freeze(o.decision),
    inputs: Object.freeze(o.inputs),
    provenance: Object.freeze(o.provenance),
  });
}

export function resolveTorpedoDetonation(o: {
  track: TorpedoTrack;
  hit: TorpedoHitResolution;
  impact: { zone: TorpedoImpactZone | null; deviationMdeg: number };
  targetProtection: TorpedoTargetProtectionLevel | null;
  damageState: { progressiveFloodingTotalKg: number } | null;
  prematureEnvironment: { wakeIntercept: boolean };
  keyedRng: (stream: string) => number;
}): TorpedoDetonationResolution {
  assertAuthoritativeTorpedoTrack(o.track);
  if (o.track.terminalResult !== null)
    invariant("track", o.track.torpedoTrackId, "detonation resolution requires the RUNNING track");
  const reliabilityBp = o.track.reliabilityState.reliabilityBp;
  const fuzePolicy = fuzePolicyForModel(o.track.torpedoModelId);
  if (
    !isInt(o.impact.deviationMdeg) ||
    o.impact.deviationMdeg < 0 ||
    o.impact.deviationMdeg > 360_000
  )
    invariant(
      "deviationMdeg",
      o.impact.deviationMdeg,
      "strike deviation must be an integer milli-degree within [0, 360_000]",
    );
  if (
    o.impact.zone !== null &&
    !(TORPEDO_IMPACT_ZONES as readonly string[]).includes(o.impact.zone)
  )
    invariant("zone", o.impact.zone, "impact zone must be a canonical §17 zone or null");
  if (
    o.targetProtection !== null &&
    !(TORPEDO_TARGET_PROTECTION_LEVELS as readonly string[]).includes(o.targetProtection)
  )
    invariant(
      "targetProtection",
      o.targetProtection,
      "target protection must be a canonical level",
    );
  if (o.damageState !== null && typeof o.damageState !== "object")
    invariant("damageState", o.damageState, "damage state must be null or a record");
  if (typeof o.keyedRng !== "function")
    invariant("keyedRng", o.keyedRng, "a deterministic keyed RNG stream function is required");
  if (typeof o.prematureEnvironment.wakeIntercept !== "boolean")
    invariant(
      "wakeIntercept",
      o.prematureEnvironment.wakeIntercept,
      "wake intercept must be a boolean",
    );
  if (
    o.hit.hit &&
    (o.impact.zone === null || o.targetProtection === null || o.damageState === null)
  )
    invariant(
      "hitGeometry",
      o.hit.trackId,
      "a resolved hit requires impact zone + target protection + damage state; a miss requires none of them",
    );

  const damageStateIndicator: TorpedoDamageStateIndicator | null =
    o.damageState === null
      ? null
      : damageStateIndicatorOf(o.damageState.progressiveFloodingTotalKg);
  const probabilityBp =
    o.hit.hit && o.targetProtection !== null && damageStateIndicator !== null
      ? computeDetonationProbabilityBp({
          torpedoModelId: o.track.torpedoModelId,
          reliabilityBp,
          protectionLevel: o.targetProtection,
          damageStateIndicator,
        })
      : 0;
  const depthM = o.track.depthSettingM;

  const inputsSnapshot: TorpedoDetonationResolution["inputs"] = {
    trackId: o.track.torpedoTrackId,
    hitResolved: o.hit.hit,
    hitRejection: o.hit.rejection,
    reliabilityBp,
    fuzePolicy,
    depthM,
    zone: o.impact.zone,
    deviationMdeg: o.impact.deviationMdeg,
    protection: o.targetProtection,
    damageStateIndicator,
    wakeIntercept: o.prematureEnvironment.wakeIntercept,
  };
  const provenance: TorpedoDetonationResolution["provenance"] = {
    rulesetVersion: TORPEDO_RULESET_VERSION,
    formulaVersion: TORPEDO_FORMULA_VERSION,
    inputHash: sha256Hex(
      canonicalSerialize({
        inputs: inputsSnapshot,
        rulesetVersion: TORPEDO_RULESET_VERSION,
        formulaVersion: TORPEDO_FORMULA_VERSION,
      }),
    ),
  };

  if (!o.hit.hit) {
    return buildResolution({
      outcome: "NO_CONTACT",
      reasonCode: null,
      detonationProbabilityBp: 0,
      functioned: false,
      decision: {
        kind: "DETERMINISTIC_PREDICATE",
        predicate: "no-resolved-hit-contact",
        streamId: null,
        draw: null,
        drawBp: null,
      },
      inputs: inputsSnapshot,
      provenance,
    });
  }

  if (fuzePolicy === "MAGNETIC" && o.prematureEnvironment.wakeIntercept) {
    return buildResolution({
      outcome: "PREMATURE_DETONATION",
      reasonCode: null,
      detonationProbabilityBp: probabilityBp,
      functioned: true,
      decision: {
        kind: "DETERMINISTIC_PREDICATE",
        predicate: "magnetic-fuze-wake-intercept",
        streamId: null,
        draw: null,
        drawBp: null,
      },
      inputs: inputsSnapshot,
      provenance,
    });
  }

  const streamId = torpedoDetonationReliabilityStreamId({
    battleId: o.track.battleId,
    impactMinute: o.hit.impactMinute,
    impactSubstep: o.hit.impactSubstep,
    torpedoTrackId: o.track.torpedoTrackId,
  });
  const draw = o.keyedRng(streamId);
  const { drawBp, functions } = evaluateDetonationReliabilityDraw({
    probabilityBp,
    draw,
  });
  if (!functions) {
    return buildResolution({
      outcome: "DUD",
      reasonCode: TORPEDO_DUD,
      detonationProbabilityBp: probabilityBp,
      functioned: false,
      decision: {
        kind: "KEYED_DRAW",
        predicate: null,
        streamId,
        draw,
        drawBp,
      },
      inputs: inputsSnapshot,
      provenance,
    });
  }

  if (
    o.impact.zone !== null &&
    (TORPEDO_ORDNANCE_IMPACT_ZONES as readonly string[]).includes(o.impact.zone)
  ) {
    return buildResolution({
      outcome: "MAGAZINE_OR_TUBE_CHAIN_REACTION",
      reasonCode: null,
      detonationProbabilityBp: probabilityBp,
      functioned: true,
      decision: {
        kind: "DETERMINISTIC_PREDICATE",
        predicate: "ordnance-zone-impact",
        streamId: null,
        draw: null,
        drawBp: null,
      },
      inputs: inputsSnapshot,
      provenance,
    });
  }

  const grade = impactGeometryQuality({
    fuzePolicy,
    depthM,
    deviationMdeg: o.impact.deviationMdeg,
  });
  return buildResolution({
    outcome: grade === "FULL" ? "FULL_DETONATION" : "PARTIAL_DETONATION",
    reasonCode: null,
    detonationProbabilityBp: probabilityBp,
    functioned: true,
    decision: {
      kind: "DETERMINISTIC_PREDICATE",
      predicate: grade === "FULL" ? "full-function-geometry" : "reduced-function-geometry",
      streamId: null,
      draw: null,
      drawBp: null,
    },
    inputs: inputsSnapshot,
    provenance,
  });
}

export function torpedoTerminalForDetonationOutcome(
  outcome: TorpedoDetonationOutcome,
): TorpedoTerminalResult | null {
  if (!isDetonationOutcome(outcome))
    invariant("outcome", outcome, "outcome must be a canonical §15 outcome");
  switch (outcome) {
    case "DUD":
      return "DUD";
    case "FULL_DETONATION":
    case "PARTIAL_DETONATION":
    case "PREMATURE_DETONATION":
    case "MAGAZINE_OR_TUBE_CHAIN_REACTION":
      return "DETONATION";
    case "NO_CONTACT":
      return null;
  }
}

export function applyTorpedoDetonationToTrack(o: {
  track: TorpedoTrack;
  outcome: TorpedoDetonationOutcome;
}): TorpedoTrack {
  const terminal = torpedoTerminalForDetonationOutcome(o.outcome);
  if (terminal === null) return o.track;
  return setTorpedoTerminalResult(o.track, terminal);
}
