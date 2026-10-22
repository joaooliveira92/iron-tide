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

export function chainReactionBaseBp(policyId: string): number {
  if (!(TUBE_HIT_HAZARD_POLICIES as readonly string[]).includes(policyId))
    invariant(
      "policyId",
      policyId,
      "chain-reaction base requires a canonical tube-hit-hazard policy",
    );
  return TORPEDO_CHAIN_REACTION_BASE_BP[policyId as TubeHitHazardPolicy];
}

export function chainReactionBaseBpForModel(
  torpedoes: CompiledTorpedoRegistry,
  torpedoModelId: string,
): number {
  const model = compiledTorpedoOf(torpedoes, torpedoModelId);
  return chainReactionBaseBp(model.tubeHitHazardPolicy);
}

export function computeChainReactionProbabilityBp(o: {
  baseProbabilityBp: number;
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
  torpedoModelId: string;
  tubeIndex: number;
  baseProbabilityBp: number;
  finalProbabilityBp: number;
  decision: { streamId: string; draw: number; drawBp: number };
  detonated: boolean;
  consumedWarheadEquivalentMassKg: number;
  reasonCode: string | null;
}

export interface TorpedoChainReactionResult {
  checks: readonly TorpedoChainReactionCheck[];
  consumed: readonly { torpedoModelId: string; tubeIndex: number }[];
  totalConsumedWarheadEquivalentMassKg: number;
  reasonCode: string | null;
}

export function resolveTorpedoChainReaction(o: {
  battleId: string;
  minute: number;
  substep: number;
  launcherId: string;
  loadedTorpedoes: readonly { tubeIndex: number; torpedoModelId: string }[];
  torpedoes: CompiledTorpedoRegistry;
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
    const model = compiledTorpedoOf(o.torpedoes, t.torpedoModelId);
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
