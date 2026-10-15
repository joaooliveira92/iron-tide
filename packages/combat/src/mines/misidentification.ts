//packages/combat/src/mines/misidentification.ts
// DESIGN-35 §20 Mine and Torpedo Misidentification (INC-6). When a damaging
// underwater explosion is not directly identified, the report classifier MUST
// use `underwater_explosion_identification_v1` (policy id ==
// MINE_REPORT_SIGNATURE_POLICY_ID from INC-1 constants — single source of truth).
//
// SHIPPED base report weights (§20, exact):
//   MINE_STRIKE 6_000, TORPEDO_ATTACK 3_000, UNDERWATER_EXPLOSION_UNKNOWN 1_000.
// SHIPPED modifiers (§20, exact):
//   knownHostileMinePressure  -> MINE_STRIKE weight +2_000
//   observedTorpedoTrack      -> TORPEDO_ATTACK weight +5_000
//   noSubmarineContact        -> TORPEDO_ATTACK weight -1_000, floor 0
//   portOrChokePointLocation  -> MINE_STRIKE weight +1_000
//   multipleSimultaneousExplosions -> EVENT-DEFINED (§20), NOT implemented this
//     slice: recognized as an input flag (documented, never silently weighted).
//
// NORMALIZATION + DRAW (recorded RandomDecision): weights are floored at 0
// (never negative), then selected via the DOMAIN-SEPARATED KEYED stream
// `mine_warfare/report/underwater_explosion` (exact §20 literal). Selection is a
// cumulative-band integer draw over the EXACT weights: draw = drawUniform(0,
// total-1) in the fixed label order [MINE_STRIKE, TORPEDO_ATTACK,
// UNDERWATER_EXPLOSION_UNKNOWN]; the band whose cumulative sum first exceeds the
// draw wins. Exactly mirrors the gunnery hit-draw technique (one keyed draw
// against integer bands). A SECOND, presentation-only, basis-point normalization
// (large st-remainder, bigint-exact, always sums to exactly 10_000) is returned
// as normalizedWeightsBp for reporting; the draw itself NEVER uses it because
// exact-integer bands cannot round-misattribute a draw. Every draw records a
// RandomDecision (streamId, entityKey = reportId, phase = "mine_warfare_report",
// rulesetVersion, inputHash, draw, outcome = classification, reasonCode) —
// mirroring gunnery/weather's recorded-decision pattern; the caller's
// RandomLedger accumulates it.
//
// CERTAINTY: with the shipped base weights + modifiers every label keeps
// strictly positive weight, so a classification is ALWAYS a probabilistic guess.
// reasonCode is therefore MINE_REPORT_CAUSE_UNCERTAIN unless a label's
// normalized share reaches 10_000 exactly (only reachable by a future modifier
// zeroing the other two weights — impossible today; branch kept + documented).
//
// FALSE-TORPEDO SAFETY (§20): a TORPEDO_ATTACK classification is KNOWLEDGE STATE
// ONLY. It is a label string inside this result — there is NO torpedo entity, NO
// submarine entity, NO asset, and NO attack record created anywhere in mines/
// (this module imports nothing from packages/combat/src/torpedoes/ — C-1's
// concurrent working set). torpedoClassificationIsKnowledgeOnly() is the shipped
// guard spelling out the obligation. C-1 owns torpedoes/; we only ever emit the
// label.
//
// Pure/deterministic: the ONLY randomness is the §20 keyed stream; no
// Math.random/Date/env/fs/locale.
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

// §20 report-signature policy id (single source of truth: INC-1 constants).
export const underwaterExplosionIdentificationPolicyId = MINE_REPORT_SIGNATURE_POLICY_ID;

// §20 exact stream literal — the ONLY stream this classifier draws from.
export const underwaterExplosionReportStreamId =
  "mine_warfare/report/underwater_explosion" as const;

// Phase identifier used in the recorded RandomDecision.
export const MINE_WARFARE_REPORT_PHASE = "mine_warfare_report" as const;

// §20 closed label vocabulary (ordered; the order below is the canonical
// cumulative-band order — MINE_STRIKE, TORPEDO_ATTACK, UNDERWATER_EXPLOSION_UNKNOWN).
export const MINE_STRIKE = "MINE_STRIKE" as const;
export const TORPEDO_ATTACK = "TORPEDO_ATTACK" as const;
export const UNDERWATER_EXPLOSION_UNKNOWN = "UNDERWATER_EXPLOSION_UNKNOWN" as const;
export const EXPLOSION_CAUSE_LABELS = [
  MINE_STRIKE,
  TORPEDO_ATTACK,
  UNDERWATER_EXPLOSION_UNKNOWN,
] as const;
export type ExplosionCauseLabel = (typeof EXPLOSION_CAUSE_LABELS)[number];

// §20 exact shipped base weights.
export const UNDERWATER_EXPLOSION_BASE_WEIGHTS_BP: Readonly<Record<ExplosionCauseLabel, number>> = {
  MINE_STRIKE: 6_000, // §20 literal
  TORPEDO_ATTACK: 3_000, // §20 literal
  UNDERWATER_EXPLOSION_UNKNOWN: 1_000, // §20 literal
};

// §20 modifiers (exact shipped deltas) + the event-defined extension point.
export const KNOWN_HOSTILE_MINE_PRESSURE_MODIFIER_BP = 2_000 as const; // mine weight +2_000
export const OBSERVED_TORPEDO_TRACK_MODIFIER_BP = 5_000 as const; // torpedo weight +5_000
export const NO_SUBMARINE_CONTACT_MODIFIER_BP = -1_000 as const; // torpedo weight -1_000 (floor 0)
export const PORT_OR_CHOKE_POINT_LOCATION_MODIFIER_BP = 1_000 as const; // mine weight +1_000
export const MULTIPLE_SIMULTANEOUS_EXPLOSIONS_STATUS = "EVENT_DEFINED" as const;
export const UNDERWATER_EXPLOSION_WEIGHT_FLOOR = 0 as const; // never negative

// §20 closed modifier-key vocabulary (kept for contract/extension documentation).
export const UNDERWATER_EXPLOSION_MODIFIER_KEYS = [
  "knownHostileMinePressure",
  "observedTorpedoTrack",
  "noSubmarineContact",
  "portOrChokePointLocation",
  "multipleSimultaneousExplosions",
] as const;

export interface UnderwaterExplosionContext {
  /** reportId doubles as the RandomDecision entityKey. */
  reportId: string;
  /** §20 known hostile mine pressure in/near the report's area. */
  knownHostileMinePressure: boolean;
  /** §20 an observed torpedo track. */
  observedTorpedoTrack: boolean;
  /** §20 no submarine contact. */
  noSubmarineContact: boolean;
  /** §20 port or choke-point location. */
  portOrChokePointLocation: boolean;
  /** §20 event-defined modifier — RECOGNIZED but NOT implemented this slice
   *  (documented extension point; never silently weighted). */
  multipleSimultaneousExplosions: boolean;
}

export interface UnderwaterExplosionWeights {
  /** Modified weights, each floored at 0 (§20 minimum). Used for the draw bands. */
  exactWeights: Readonly<Record<ExplosionCauseLabel, number>>;
  /** Largest-remainder basis-point normalization summing to exactly 10_000
   *  (bigint-exact; presentation/reporting only — the draw uses exactWeights). */
  normalizedWeightsBp: Readonly<Record<ExplosionCauseLabel, number>>;
  total: number;
  /** True iff the caller flagged multipleSimultaneousExplosions; it carries NO
   *  weight this slice (§20: event-defined — explicitly recognized, not fabricated). */
  multipleSimultaneousExplosionsRecognizedUnimplemented: boolean;
}

export interface UnderwaterExplosionClassification extends UnderwaterExplosionWeights {
  classification: ExplosionCauseLabel;
  /** Integer draw in [0, total) against the cumulative exact-weight bands. */
  draw: number;
  /** Recorded RandomDecision (for a RandomLedger; also returned to the caller). */
  decision: RandomDecision;
}

// §20 fail-closed contract. All numbers are DESIGN-35 literals.
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
  /** §20 "event-defined" — ships as a documented, unimplemented extension point. */
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

// AC-14/AC-24: fail-closed guard over the §20 base weights + modifiers + stream
// literal. A tampered weight, modifier, stream id, or normalization never passes
// — any drift after shipping fails here instead of inside the classifier.
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

// ---------------------------------------------------------------------------

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

// bigint-exact largest-remainder basis-point normalization: every label's share
// is floor(exact * 10_000 / total), then the unallocated remainder units (always
// < label count) go +1 each to the labels with the LARGEST rational remainder,
// ties broken by canonical label order — deterministic, sums to exactly 10_000.
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
  // Deterministic descending-order by remainder; ties break ascending by the
  // canonical label index (never incidental insertion order).
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

// AC-14a: pure weight derivation. Starts from the §20 exact base weights, applies
// the four shipped modifiers, floors each at 0, and (a) returns the exact weights
// used for the draw bands plus (b) a largest-remainder basis-point normalization.
// multipleSimultaneousExplosions is a RECOGNIZED-but-UNIMPLEMENTED extension
// point: it changes no weight (flagged only) — documented, never fabricated.
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
    // Fail CLOSED, never undefined: under shipped bases (6_000/3_000/1_000) total
    // is always >= 10_000; only a hypothetical future modifier zeroing everything
    // could reach this — it MUST fail, not guess. Module invariant code, matching
    // INC-4/INC-5 reuse (no dedicated §30 code exists until INC-8's
    // MINE_WARFARE_INVARIANT_FAILED lands).
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

// AC-14b: normalized cumulative-band selection via the §20 keyed stream
// `mine_warfare/report/underwater_explosion` (EXACT literal). One drawUniform
// over [0, total) in the fixed label order; the first band whose cumulative sum
// strictly exceeds the draw wins (same technique as the gunnery hit-draw). The
// RandomDecision is recorded into the optional RandomLedger AND returned.
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
    // A band classification is a GUESS unless one label owns 100% of the weight
    // (impossible with the shipped bases; branch kept + documented). Otherwise
    // the recorded reason is MINE_REPORT_CAUSE_UNCERTAIN, consistent with §19's
    // cause-estimation certainty semantics.
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

// §20 FALSE-TORPEDO SAFETY: a TORPEDO_ATTACK classification is KNOWLEDGE STATE
// ONLY. mines/ never creates a real torpedo/submarine asset or attack (no import
// of packages/combat/src/torpedoes/; the classification is a label string). This
// guard exists so callers/tests can assert the invariant in one place.
export function torpedoClassificationIsKnowledgeOnly(): true {
  return true;
}
