//packages/combat/src/torpedoes/chainReaction.ts
// DESIGN-40 §22 tube/magazine chain reaction (INC-6, AC-18). Each loaded
// torpedo exposed to fire, explosion, or severe tube damage performs ONE
// chain-reaction check. Shipped base probability by propellant class
// (tube-hit-hazard policy): ORDINARY 1_500 bp / OXYGEN 3_000 bp / ELECTRIC
// 1_000 bp. The five explicit integer modifier groups (§22: damage-control
// isolation, flooding, protection, fire intensity, existing damage) scale the
// base over 10_000^5 — every factor is an explicit caller value (a caller
// passes 10_000 for a factor with no strain, but every factor MUST be
// provided: §22 "explicit integer multipliers", never a silent skip).
//
// A detonated chain CONSUMES the affected torpedo and records the in-slice
// cause TORPEDO_CHAIN_REACTION. The SEPARATE explosion damage package (the §22
// "chain reaction creates a separate explosion damage package" — never a
// silent alteration of the original package) is built on top of this
// evaluator's descriptor in damagePackage.ts: the package carries the consumed
// torpedoes' summed warhead explosive-equivalent mass and re-runs the §17/§18
// flotation + flooding + terminal machinery as its own causal package.
//
// Keyed draws: exactly ONE per loaded torpedo checked on
//   battle/torpedo/damage/chain-reaction:<battleId>:<minute>:<substep>:
//     <launcherId>:<tubeIndex>
// The draw layout is input-deterministic (one draw per still-present loaded
// torpedo — the caller passes the ACTUAL loaded torpedoes, e.g. after the
// tube-hazard consumption). Pure/deterministic: no ambient I/O/clock/random.
import { BluewaveError } from "@bluewave/contracts";
import { compiledTorpedoOf, type CompiledTorpedoRegistry } from "./registry.js";
import {
  TORPEDO_CHAIN_REACTION_BASE_BP,
  TORPEDO_CHAIN_REACTION_MODIFIER_KEYS,
  TORPEDO_CHAIN_REACTION_SCALE_EXPONENT,
  type TorpedoChainReactionModifierKey,
} from "./damageConstants.js";
import {
  TORPEDO_BASIS_POINTS_PER_UNIT,
  TUBE_HIT_HAZARD_POLICIES,
  type TubeHitHazardPolicy,
} from "./constants.js";
import { TORPEDO_CHAIN_REACTION, TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

export function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

// AC-18: §22 base probability by tube-hit-hazard policy, with the OXYGEN slot
// pinned to the §23 OXYGEN_CHAIN_REACTION_BASE_BP through the constants table.
export function chainReactionBaseBp(policyId: string): number {
  if (!(TUBE_HIT_HAZARD_POLICIES as readonly string[]).includes(policyId))
    invariant(
      "policyId",
      policyId,
      "chain-reaction base requires a canonical tube-hit-hazard policy",
    );
  return TORPEDO_CHAIN_REACTION_BASE_BP[policyId as TubeHitHazardPolicy];
}

// §22 -> the authoritative base from the compiled torpedo record
// (compiledTorpedoOf fails closed on an unknown part id — a loaded torpedo
// chain check always runs against a recorded torpedo).
export function chainReactionBaseBpForModel(
  torpedoes: CompiledTorpedoRegistry,
  torpedoModelId: string,
): number {
  const model = compiledTorpedoOf(torpedoes, torpedoModelId);
  return chainReactionBaseBp(model.tubeHitHazardPolicy);
}

// AC-18: the exact §22 probability composition:
//   clamp(0, 10_000, floor(base *
//     isolationMultiplierBp * floodingMultiplierBp * protectionMultiplierBp *
//     fireIntensityMultiplierBp * existingDamageMultiplierBp / 10_000^5))
// Every modifier must be an explicit integer (all five keys required — the
// neutral 10_000 value still has to be PASSED; a missing factor fails closed,
// mirroring the §10 factor-manifest precedent).
export function computeChainReactionProbabilityBp(o: {
  baseProbabilityBp: number; // the §22 base for the propellant class
  modifiers: Record<TorpedoChainReactionModifierKey, number>;
}): number {
  if (
    !isInt(o.baseProbabilityBp) ||
    o.baseProbabilityBp < 0 ||
    o.baseProbabilityBp > TORPEDO_BASIS_POINTS_PER_UNIT
  )
    invariant(
      "baseProbabilityBp",
      o.baseProbabilityBp,
      "chain-reaction base must be an integer bp within [0, 10_000]",
    );
  if (typeof o.modifiers !== "object" || o.modifiers === null)
    invariant("modifiers", o.modifiers, "the §22 modifier manifest is required");
  // Every factor must be EXPLICIT (never a silent neutral default).
  const missing = TORPEDO_CHAIN_REACTION_MODIFIER_KEYS.filter((k) => !(k in o.modifiers));
  if (missing.length > 0)
    invariant(
      "modifiers",
      o.modifiers,
      `§22 modifier manifest is missing factor(s): ${missing.join(", ")}`,
    );
  let numerator = BigInt(o.baseProbabilityBp);
  for (const key of TORPEDO_CHAIN_REACTION_MODIFIER_KEYS) {
    const m = o.modifiers[key];
    if (!isInt(m) || m < 0 || m > 100_000)
      invariant(key, m, "a §22 modifier must be an integer bp within [0, 100_000]");
    numerator *= BigInt(m);
  }
  const denominator =
    BigInt(TORPEDO_BASIS_POINTS_PER_UNIT) ** BigInt(TORPEDO_CHAIN_REACTION_SCALE_EXPONENT);
  const raw = Number(numerator / denominator);
  return Math.min(TORPEDO_BASIS_POINTS_PER_UNIT, Math.max(0, raw));
}

export interface TorpedoChainReactionCheck {
  torpedoModelId: string; // consumed torpedo's model (the affected loaded round)
  tubeIndex: number; // the tube the affected torpedo was loaded in
  baseProbabilityBp: number;
  finalProbabilityBp: number;
  decision: { streamId: string; draw: number; drawBp: number };
  detonated: boolean;
  // consumed explosion equivalent mass (kg TNT-equivalent) — the warhead of
  // the consumed torpedo; 0 when the check did not detonate.
  consumedWarheadEquivalentMassKg: number;
  reasonCode: string | null; // TORPEDO_CHAIN_REACTION on detonation
}

export interface TorpedoChainReactionResult {
  checks: readonly TorpedoChainReactionCheck[];
  // the tubes/rounds consumed (detonated rounds) — a tube is consumed exactly
  // when its uniquely indexed round detonates.
  consumed: readonly { torpedoModelId: string; tubeIndex: number }[];
  // the summed warhead explosive-equivalent mass of every consumed round —
  // the descriptor the explosion damage package is built from.
  totalConsumedWarheadEquivalentMassKg: number;
  reasonCode: string | null; // TORPEDO_CHAIN_REACTION when >= 1 round detonated
}

// One §22 keyed check per still-present loaded torpedo. The caller supplies
// the tube indexes + model ids (the ACTUAL loaded pool — a round consumed by
// an earlier chain of the same burst is absent from the input) and the
// auxiliary-location modifier context. The modifiers are the §22 five factors
// (each integer bp; typical values documented at the call site).
export function resolveTorpedoChainReaction(o: {
  battleId: string;
  minute: number;
  substep: number;
  launcherId: string;
  loadedTorpedoes: readonly { tubeIndex: number; torpedoModelId: string }[];
  torpedoes: CompiledTorpedoRegistry; // the battle's compiled-torpedo records
  modifiers: Record<TorpedoChainReactionModifierKey, number>;
  keyedRng: (stream: string) => number;
}): TorpedoChainReactionResult {
  if (
    typeof o.battleId !== "string" ||
    o.battleId.length === 0 ||
    !isInt(o.minute) ||
    o.minute < 0 ||
    !isInt(o.substep) ||
    o.substep < 1 ||
    typeof o.launcherId !== "string" ||
    o.launcherId.length === 0
  )
    invariant("identity", o, "chain-reaction identity inputs must be well-formed");
  if (!Array.isArray(o.loadedTorpedoes))
    invariant("loadedTorpedoes", o.loadedTorpedoes, "loaded torpedoes must be an array");
  for (const t of o.loadedTorpedoes) {
    if (!isInt(t.tubeIndex) || t.tubeIndex < 0)
      invariant("tubeIndex", t.tubeIndex, "tube index must be a non-negative integer");
    if (typeof t.torpedoModelId !== "string" || t.torpedoModelId.length === 0)
      invariant("torpedoModelId", t.torpedoModelId, "model id must be non-empty");
  }
  if (typeof o.keyedRng !== "function")
    invariant("keyedRng", o.keyedRng, "a deterministic keyed RNG stream function is required");

  const checks: TorpedoChainReactionCheck[] = [];
  const consumed: { torpedoModelId: string; tubeIndex: number }[] = [];
  let totalMass = 0;

  for (const t of o.loadedTorpedoes) {
    const model = compiledTorpedoOf(o.torpedoes, t.torpedoModelId); // fail-closed lookup
    const baseProbabilityBp = chainReactionBaseBp(model.tubeHitHazardPolicy);
    const finalProbabilityBp = computeChainReactionProbabilityBp({
      baseProbabilityBp: baseProbabilityBp,
      modifiers: o.modifiers,
    });
    const streamId = `battle/torpedo/damage/chain-reaction:${o.battleId}:${o.minute}:${o.substep}:${o.launcherId}:tube${t.tubeIndex}`;
    const draw = o.keyedRng(streamId);
    if (typeof draw !== "number" || draw < 0 || draw >= 1)
      invariant("draw", draw, "the keyed draw must be a float within [0, 1)");
    const drawBp = Math.floor(draw * TORPEDO_BASIS_POINTS_PER_UNIT);
    const detonated = drawBp < finalProbabilityBp;
    if (detonated) {
      consumed.push({ torpedoModelId: t.torpedoModelId, tubeIndex: t.tubeIndex });
      totalMass += model.warheadExplosiveEquivalentMassKg;
    }
    checks.push({
      torpedoModelId: t.torpedoModelId,
      tubeIndex: t.tubeIndex,
      baseProbabilityBp,
      finalProbabilityBp,
      decision: { streamId, draw, drawBp },
      detonated,
      consumedWarheadEquivalentMassKg: detonated ? model.warheadExplosiveEquivalentMassKg : 0,
      reasonCode: detonated ? TORPEDO_CHAIN_REACTION : null,
    });
  }

  return Object.freeze({
    checks: Object.freeze(checks),
    consumed: Object.freeze(consumed),
    totalConsumedWarheadEquivalentMassKg: totalMass,
    reasonCode: consumed.length > 0 ? TORPEDO_CHAIN_REACTION : null,
  });
}
