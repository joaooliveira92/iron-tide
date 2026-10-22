import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import {
  RandomEngine,
  type RandomDecision,
  type RandomLedger,
  drawUniform,
} from "@bluewave/random";
import {
  MINE_BASIS_POINTS_PER_UNIT,
  MINE_FORMULA_VERSION,
  MINE_REPORT_SIGNATURE_POLICY_ID,
  MINE_RULESET_VERSION,
} from "./constants.js";
import { INVALID_MINE_PRESSURE_STATE, MINE_REPORT_CAUSE_UNCERTAIN } from "./reasonCodes.js";
import { MINE_REPORT_CAUSE_CERTAIN_CONFIDENCE_BP } from "./mine-report.js";

export const underwaterExplosionIdentificationPolicyId = MINE_REPORT_SIGNATURE_POLICY_ID;

export const underwaterExplosionReportStreamId =
  "mine_warfare/report/underwater_explosion" as const;

export const MINE_WARFARE_REPORT_PHASE = "mine_warfare_report" as const;

export const MINE_STRIKE = "MINE_STRIKE" as const;
export const TORPEDO_ATTACK = "TORPEDO_ATTACK" as const;
export const UNDERWATER_EXPLOSION_UNKNOWN = "UNDERWATER_EXPLOSION_UNKNOWN" as const;
export const EXPLOSION_CAUSE_LABELS = [
  MINE_STRIKE,
  TORPEDO_ATTACK,
  UNDERWATER_EXPLOSION_UNKNOWN,
] as const;
export type ExplosionCauseLabel = (typeof EXPLOSION_CAUSE_LABELS)[number];

export const UNDERWATER_EXPLOSION_BASE_WEIGHTS_BP: Readonly<Record<ExplosionCauseLabel, number>> = {
  MINE_STRIKE: 6_000,
  TORPEDO_ATTACK: 3_000,
  UNDERWATER_EXPLOSION_UNKNOWN: 1_000,
};

export const KNOWN_HOSTILE_MINE_PRESSURE_MODIFIER_BP = 2_000 as const;
export const OBSERVED_TORPEDO_TRACK_MODIFIER_BP = 5_000 as const;
export const NO_SUBMARINE_CONTACT_MODIFIER_BP = -1_000 as const;
export const PORT_OR_CHOKE_POINT_LOCATION_MODIFIER_BP = 1_000 as const;
export const MULTIPLE_SIMULTANEOUS_EXPLOSIONS_STATUS = "EVENT_DEFINED" as const;
export const UNDERWATER_EXPLOSION_WEIGHT_FLOOR = 0 as const;

export const UNDERWATER_EXPLOSION_MODIFIER_KEYS = [
  "knownHostileMinePressure",
  "observedTorpedoTrack",
  "noSubmarineContact",
  "portOrChokePointLocation",
  "multipleSimultaneousExplosions",
] as const;

export interface UnderwaterExplosionContext {
  reportId: string;
  knownHostileMinePressure: boolean;
  observedTorpedoTrack: boolean;
  noSubmarineContact: boolean;
  portOrChokePointLocation: boolean;
  multipleSimultaneousExplosions: boolean;
}

export interface UnderwaterExplosionWeights {
  exactWeights: Readonly<Record<ExplosionCauseLabel, number>>;
  normalizedWeightsBp: Readonly<Record<ExplosionCauseLabel, number>>;
  total: number;
  multipleSimultaneousExplosionsRecognizedUnimplemented: boolean;
}

export interface UnderwaterExplosionClassification extends UnderwaterExplosionWeights {
  classification: ExplosionCauseLabel;
  draw: number;
  decision: RandomDecision;
}

export interface UnderwaterExplosionIdentificationContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  baseWeights: Readonly<Record<ExplosionCauseLabel, number>>;
  knownHostileMinePressureModifierBp: number;
  observedTorpedoTrackModifierBp: number;
  noSubmarineContactModifierBp: number;
  portOrChokePointLocationModifierBp: number;
  multipleSimultaneousExplosionsModifier: string;
  weightFloor: number;
  streamId: string;
  normalization: string;
  certainThresholdBp: number;
}

export const SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT: UnderwaterExplosionIdentificationContract =
  {
    policyId: underwaterExplosionIdentificationPolicyId,
    rulesetVersion: MINE_RULESET_VERSION,
    formulaVersion: MINE_FORMULA_VERSION,
    basisPointsPerUnit: MINE_BASIS_POINTS_PER_UNIT,
    baseWeights: UNDERWATER_EXPLOSION_BASE_WEIGHTS_BP,
    knownHostileMinePressureModifierBp: KNOWN_HOSTILE_MINE_PRESSURE_MODIFIER_BP,
    observedTorpedoTrackModifierBp: OBSERVED_TORPEDO_TRACK_MODIFIER_BP,
    noSubmarineContactModifierBp: NO_SUBMARINE_CONTACT_MODIFIER_BP,
    portOrChokePointLocationModifierBp: PORT_OR_CHOKE_POINT_LOCATION_MODIFIER_BP,
    multipleSimultaneousExplosionsModifier: MULTIPLE_SIMULTANEOUS_EXPLOSIONS_STATUS,
    weightFloor: UNDERWATER_EXPLOSION_WEIGHT_FLOOR,
    streamId: underwaterExplosionReportStreamId,
    normalization:
      "cumulative-band integer draw over exact floored weights in fixed label order; largest-remainder bp share for reporting",
    certainThresholdBp: MINE_REPORT_CAUSE_CERTAIN_CONFIDENCE_BP,
  };

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
    code: INVALID_MINE_PRESSURE_STATE,
    contract,
    reason,
  });
}

export function validateUnderwaterExplosionIdentificationContract(
  c: Partial<UnderwaterExplosionIdentificationContract> | null | undefined,
): asserts c is UnderwaterExplosionIdentificationContract {
  if (!c) throwMismatch(c, "underwater_explosion_identification_v1 missing contract");
  if (c.policyId !== underwaterExplosionIdentificationPolicyId)
    throwMismatch(c, "underwater_explosion_identification_v1 expected policy id");
  if (c.rulesetVersion !== MINE_RULESET_VERSION || c.formulaVersion !== MINE_FORMULA_VERSION)
    throwMismatch(c, "underwater_explosion_identification_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== MINE_BASIS_POINTS_PER_UNIT)
    throwMismatch(c, "underwater_explosion_identification_v1 basis-point scale");
  if (!c.baseWeights || typeof c.baseWeights !== "object")
    throwMismatch(c, "underwater_explosion_identification_v1 §20 base weights missing");
  for (const label of EXPLOSION_CAUSE_LABELS) {
    if (c.baseWeights[label] !== UNDERWATER_EXPLOSION_BASE_WEIGHTS_BP[label])
      throwMismatch(c, `underwater_explosion_identification_v1 §20 base weight for ${label}`);
  }
  if (c.knownHostileMinePressureModifierBp !== KNOWN_HOSTILE_MINE_PRESSURE_MODIFIER_BP)
    throwMismatch(
      c,
      "underwater_explosion_identification_v1 §20 known-hostile-mine-pressure modifier",
    );
  if (c.observedTorpedoTrackModifierBp !== OBSERVED_TORPEDO_TRACK_MODIFIER_BP)
    throwMismatch(c, "underwater_explosion_identification_v1 §20 observed-torpedo-track modifier");
  if (c.noSubmarineContactModifierBp !== NO_SUBMARINE_CONTACT_MODIFIER_BP)
    throwMismatch(c, "underwater_explosion_identification_v1 §20 no-submarine-contact modifier");
  if (c.portOrChokePointLocationModifierBp !== PORT_OR_CHOKE_POINT_LOCATION_MODIFIER_BP)
    throwMismatch(c, "underwater_explosion_identification_v1 §20 port/choke-point modifier");
  if (c.multipleSimultaneousExplosionsModifier !== MULTIPLE_SIMULTANEOUS_EXPLOSIONS_STATUS)
    throwMismatch(
      c,
      "underwater_explosion_identification_v1 §20 multiple-explosions must be EVENT_DEFINED",
    );
  if (c.weightFloor !== UNDERWATER_EXPLOSION_WEIGHT_FLOOR)
    throwMismatch(c, "underwater_explosion_identification_v1 §20 weight floor must be 0");
  if (c.streamId !== underwaterExplosionReportStreamId)
    throwMismatch(c, "underwater_explosion_identification_v1 §20 stream id");
  if (c.normalization !== SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT.normalization)
    throwMismatch(c, "underwater_explosion_identification_v1 normalization method");
  if (c.certainThresholdBp !== MINE_REPORT_CAUSE_CERTAIN_CONFIDENCE_BP)
    throwMismatch(c, "underwater_explosion_identification_v1 authored certain-threshold");
}

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
    code: INVALID_MINE_PRESSURE_STATE,
    field,
    reason,
    value,
  });
}

function floorAtZero(weight: number): number {
  return Math.max(UNDERWATER_EXPLOSION_WEIGHT_FLOOR, weight);
}

function validateContext(c: UnderwaterExplosionContext): void {
  if (typeof c.reportId !== "string" || c.reportId.length === 0)
    invariant("reportId", c.reportId, "non-empty report id required");
  if (typeof c.knownHostileMinePressure !== "boolean")
    invariant("knownHostileMinePressure", c.knownHostileMinePressure, "must be a boolean");
  if (typeof c.observedTorpedoTrack !== "boolean")
    invariant("observedTorpedoTrack", c.observedTorpedoTrack, "must be a boolean");
  if (typeof c.noSubmarineContact !== "boolean")
    invariant("noSubmarineContact", c.noSubmarineContact, "must be a boolean");
  if (typeof c.portOrChokePointLocation !== "boolean")
    invariant("portOrChokePointLocation", c.portOrChokePointLocation, "must be a boolean");
  if (typeof c.multipleSimultaneousExplosions !== "boolean")
    invariant(
      "multipleSimultaneousExplosions",
      c.multipleSimultaneousExplosions,
      "must be a boolean",
    );
}

function normalizeWeightsBp(
  exact: Readonly<Record<ExplosionCauseLabel, number>>,
  total: number,
): Readonly<Record<ExplosionCauseLabel, number>> {
  const scaleN = BigInt(MINE_BASIS_POINTS_PER_UNIT);
  const totalN = BigInt(total);
  const shares = EXPLOSION_CAUSE_LABELS.map((label) => {
    const prod = BigInt(exact[label]) * scaleN;
    return { label, floor: prod / totalN, rem: prod % totalN };
  });
  const normalized = {} as Record<ExplosionCauseLabel, number>;
  let floorSum = 0n;
  for (const share of shares) {
    normalized[share.label] = Number(share.floor);
    floorSum += share.floor;
  }
  const byRemainder = [...shares].sort((a, b) => {
    if (a.rem !== b.rem) return a.rem > b.rem ? -1 : 1;
    return EXPLOSION_CAUSE_LABELS.indexOf(a.label) - EXPLOSION_CAUSE_LABELS.indexOf(b.label);
  });
  const remainderUnits = Number(scaleN - floorSum);
  for (let i = 0; i < remainderUnits; i++) {
    normalized[byRemainder[i]!.label] += 1;
  }
  return normalized;
}

export function computeUnderwaterExplosionWeights(
  context: UnderwaterExplosionContext,
): UnderwaterExplosionWeights {
  validateContext(context);
  const mineExact = floorAtZero(
    UNDERWATER_EXPLOSION_BASE_WEIGHTS_BP.MINE_STRIKE +
      (context.knownHostileMinePressure ? KNOWN_HOSTILE_MINE_PRESSURE_MODIFIER_BP : 0) +
      (context.portOrChokePointLocation ? PORT_OR_CHOKE_POINT_LOCATION_MODIFIER_BP : 0),
  );
  const torpedoExact = floorAtZero(
    UNDERWATER_EXPLOSION_BASE_WEIGHTS_BP.TORPEDO_ATTACK +
      (context.observedTorpedoTrack ? OBSERVED_TORPEDO_TRACK_MODIFIER_BP : 0) +
      (context.noSubmarineContact ? NO_SUBMARINE_CONTACT_MODIFIER_BP : 0),
  );
  const unknownExact = UNDERWATER_EXPLOSION_BASE_WEIGHTS_BP.UNDERWATER_EXPLOSION_UNKNOWN;
  const exactWeights: Readonly<Record<ExplosionCauseLabel, number>> = {
    MINE_STRIKE: mineExact,
    TORPEDO_ATTACK: torpedoExact,
    UNDERWATER_EXPLOSION_UNKNOWN: unknownExact,
  };
  const total = mineExact + torpedoExact + unknownExact;
  if (total <= 0) {
    invariant(
      "totalWeights",
      total,
      "underwater-explosion weights exhausted to zero — fail closed",
    );
  }
  return {
    exactWeights,
    normalizedWeightsBp: normalizeWeightsBp(exactWeights, total),
    total,
    multipleSimultaneousExplosionsRecognizedUnimplemented: context.multipleSimultaneousExplosions,
  };
}

export function classifyUnderwaterExplosion(
  context: UnderwaterExplosionContext,
  engine: RandomEngine,
  ledger?: RandomLedger,
): UnderwaterExplosionClassification {
  const weights = computeUnderwaterExplosionWeights(context);
  const stream = engine.stream(underwaterExplosionReportStreamId);
  const draw = drawUniform(stream, SafeInt.ZERO, SafeInt(weights.total - 1)) as number;

  let classification: ExplosionCauseLabel =
    EXPLOSION_CAUSE_LABELS[EXPLOSION_CAUSE_LABELS.length - 1]!;
  let cumulative = 0;
  for (const label of EXPLOSION_CAUSE_LABELS) {
    cumulative += weights.exactWeights[label];
    if (draw < cumulative) {
      classification = label;
      break;
    }
  }

  const inputHash = sha256Hex(
    canonicalSerialize({
      context: {
        reportId: context.reportId,
        knownHostileMinePressure: context.knownHostileMinePressure,
        observedTorpedoTrack: context.observedTorpedoTrack,
        noSubmarineContact: context.noSubmarineContact,
        portOrChokePointLocation: context.portOrChokePointLocation,
        multipleSimultaneousExplosions: context.multipleSimultaneousExplosions,
      },
      rulesetVersion: MINE_RULESET_VERSION,
      policyId: underwaterExplosionIdentificationPolicyId,
    }),
  );

  const certain = weights.normalizedWeightsBp[classification] === MINE_BASIS_POINTS_PER_UNIT;
  const decision: RandomDecision = {
    streamId: underwaterExplosionReportStreamId,
    entityKey: context.reportId,
    phase: MINE_WARFARE_REPORT_PHASE,
    rulesetVersion: MINE_RULESET_VERSION,
    inputHash,
    draw,
    outcome: classification,
    reasonCode: certain ? classification : MINE_REPORT_CAUSE_UNCERTAIN,
  };
  if (ledger) ledger.record(decision);

  return {
    classification,
    exactWeights: weights.exactWeights,
    normalizedWeightsBp: weights.normalizedWeightsBp,
    total: weights.total,
    multipleSimultaneousExplosionsRecognizedUnimplemented:
      weights.multipleSimultaneousExplosionsRecognizedUnimplemented,
    draw,
    decision,
  };
}

export function torpedoClassificationIsKnowledgeOnly(): true {
  return true;
}
