import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { drawUniform, type RandomEngine } from "@bluewave/random";
import type { AirDefenseState } from "./air-defense-state.js";
import type { AirDefenseSystemDefinition } from "./air-defense-system-definition.js";
import type { AirDefenseAttack } from "./attack.js";
import { consumeAmmunition, ammunitionMultiplierBp } from "./ammunition.js";
import { effectiveDamageMultiplierBp } from "./damage-power.js";
import {
  FORMULA_DENOMINATOR,
  FORMULA_EXPONENT,
  INVALID_AIR_DEFENSE_STATE,
  MAX_ENGAGEMENT_FACTOR_BP,
} from "./constants.js";

const FORMULA_SCALE_N = BigInt(FORMULA_DENOMINATOR);
export const ENGAGEMENT_FORMULA_DENOMINATOR: bigint = FORMULA_SCALE_N ** BigInt(FORMULA_EXPONENT);

export interface EngagementMultipliers {
  directorBp: SafeInt;
  radarBp: SafeInt;
  crewBp: SafeInt;
  damageBp: SafeInt;
  ammunitionBp: SafeInt;
  targetProfileBp: SafeInt;
  weatherBp: SafeInt;
  saturationBp: SafeInt;
}

export const ENGAGEMENT_FACTOR_SLOT_NAMES = [
  "base",
  "director",
  "radar",
  "crew",
  "damage",
  "ammunition",
  "targetProfile",
  "weather",
  "saturation",
] as const;
type FactorSlotName = (typeof ENGAGEMENT_FACTOR_SLOT_NAMES)[number];
const FACTOR_CAPS_BP: Readonly<Record<FactorSlotName, number>> = {
  base: MAX_ENGAGEMENT_FACTOR_BP,
  director: MAX_ENGAGEMENT_FACTOR_BP,
  radar: Number.MAX_SAFE_INTEGER,
  crew: MAX_ENGAGEMENT_FACTOR_BP,
  damage: MAX_ENGAGEMENT_FACTOR_BP,
  ammunition: MAX_ENGAGEMENT_FACTOR_BP,
  targetProfile: MAX_ENGAGEMENT_FACTOR_BP,
  weather: MAX_ENGAGEMENT_FACTOR_BP,
  saturation: Number.MAX_SAFE_INTEGER,
};

export function computeEffectiveDefenseBp(
  baseDefenseBp: SafeInt,
  multipliers: EngagementMultipliers,
): SafeInt {
  const factors: readonly number[] = [
    baseDefenseBp,
    multipliers.directorBp,
    multipliers.radarBp,
    multipliers.crewBp,
    multipliers.damageBp,
    multipliers.ammunitionBp,
    multipliers.targetProfileBp,
    multipliers.weatherBp,
    multipliers.saturationBp,
  ];
  let numerator = 1n;
  for (let i = 0; i < factors.length; i++) {
    const factor = factors[i]!;
    const slot = ENGAGEMENT_FACTOR_SLOT_NAMES[i]!;
    const cap = FACTOR_CAPS_BP[slot];
    if (!SafeInt.isSafeInt(factor) || factor < 0 || factor > cap) {
      throw new BluewaveError(
        `computeEffectiveDefenseBp: every NORMAL-class factor must be a non-negative safe integer <= MAX_ENGAGEMENT_FACTOR_BP (${MAX_ENGAGEMENT_FACTOR_BP}); SATURATION-class factors (radar, saturation) must be non-negative safe integers (no 31_000 limit)`,
        {
          code: INVALID_AIR_DEFENSE_STATE,
          slot,
          factor,
          cap,
          maxFactorBp: MAX_ENGAGEMENT_FACTOR_BP,
        },
      );
    }
    numerator *= BigInt(factor);
  }
  const rawFloored: bigint = numerator / ENGAGEMENT_FORMULA_DENOMINATOR;
  if (rawFloored > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new BluewaveError("computeEffectiveDefenseBp: floored result exceeds MAX_SAFE_INTEGER", {
      code: INVALID_AIR_DEFENSE_STATE,
      rawFloored: rawFloored.toString(),
    });
  }
  return SafeInt(Number(rawFloored));
}

export type EngagementOutcome = "KILL" | "DAMAGE" | "ABORT" | "DISRUPTION" | "NO_EFFECT";

export interface EngagementOutcomeParams {
  effectiveKillBp: SafeInt;
  effectiveDamageBp: SafeInt;
  effectiveAbortBp: SafeInt;
  effectiveDisruptionBp: SafeInt;
  draw: SafeInt;
}

export interface EngagementOutcomeThresholds {
  killEndBp: SafeInt;
  damageEndBp: SafeInt;
  abortEndBp: SafeInt;
  disruptionEndBp: SafeInt;
  totalBp: SafeInt;
}

export interface EngagementOutcomeResult {
  outcome: EngagementOutcome;
  draw: SafeInt;
  thresholds: EngagementOutcomeThresholds;
}

export function resolveEngagementOutcome(params: EngagementOutcomeParams): EngagementOutcomeResult {
  const { effectiveKillBp, effectiveDamageBp, effectiveAbortBp, effectiveDisruptionBp, draw } =
    params;
  const killEndBp = effectiveKillBp;
  const damageEndBp = SafeInt.add(killEndBp, effectiveDamageBp);
  const abortEndBp = SafeInt.add(damageEndBp, effectiveAbortBp);
  const disruptionEndBp = SafeInt.add(abortEndBp, effectiveDisruptionBp);

  let outcome: EngagementOutcome;
  if (draw < killEndBp) {
    outcome = "KILL";
  } else if (draw < damageEndBp) {
    outcome = "DAMAGE";
  } else if (draw < abortEndBp) {
    outcome = "ABORT";
  } else if (draw < disruptionEndBp) {
    outcome = "DISRUPTION";
  } else {
    outcome = "NO_EFFECT";
  }

  return {
    outcome,
    draw,
    thresholds: {
      killEndBp,
      damageEndBp,
      abortEndBp,
      disruptionEndBp,
      totalBp: disruptionEndBp,
    },
  };
}

export const ENGAGEMENT_DRAW_MIN = 0 as const;
export const ENGAGEMENT_DRAW_MAX = 9_999 as const;

export function airDefenseEngagementStreamId(identity: {
  defenderId: string;
  systemId: string;
  attackId: string;
  minute: SafeInt;
  substep: SafeInt;
}): string {
  return `air-defense/engagement/${identity.defenderId}/${identity.systemId}/${identity.attackId}/${identity.minute}/${identity.substep}`;
}

export function drawAirDefenseOutcome(engine: RandomEngine, streamId: string): SafeInt {
  const stream = engine.stream(streamId);
  return drawUniform(stream, SafeInt(ENGAGEMENT_DRAW_MIN), SafeInt(ENGAGEMENT_DRAW_MAX));
}

export interface EngagementResolutionInput {
  system: AirDefenseSystemDefinition;
  attack: AirDefenseAttack;
  state: AirDefenseState;
  multipliers: EngagementMultipliers;
  engine: RandomEngine;
  identity: {
    defenderId: string;
    systemId: string;
    attackId: string;
    minute: SafeInt;
    substep: SafeInt;
  };
}

export interface EngagementResolution {
  state: AirDefenseState;
  outcome: EngagementOutcome;
  effectiveBp: { kill: SafeInt; damage: SafeInt; abort: SafeInt; disruption: SafeInt };
  consumedRounds: SafeInt;
  draw: SafeInt;
  streamId: string;
}

export function resolveEngagement(input: EngagementResolutionInput): EngagementResolution {
  const { system, state, multipliers, engine, identity } = input;
  const streamId = airDefenseEngagementStreamId(identity);

  if (!state.systems.some((sys) => sys.systemId === system.systemId)) {
    throw new BluewaveError("resolveEngagement: system is not part of the air-defense state", {
      code: INVALID_AIR_DEFENSE_STATE,
      systemId: system.systemId,
    });
  }

  const ammunitionBp = ammunitionMultiplierBp(state, system.systemId);
  const damageBp = effectiveDamageMultiplierBp(state.damageBp, state.powerBp);
  const effectiveMultipliers: EngagementMultipliers = { ...multipliers, ammunitionBp, damageBp };

  const effectiveBp = {
    kill: computeEffectiveDefenseBp(system.baseKillBp, effectiveMultipliers),
    damage: computeEffectiveDefenseBp(system.baseDamageBp, effectiveMultipliers),
    abort: computeEffectiveDefenseBp(system.baseAbortBp, effectiveMultipliers),
    disruption: computeEffectiveDefenseBp(system.baseDisruptionBp, effectiveMultipliers),
  };

  const totalBp = SafeInt.add(
    SafeInt.add(effectiveBp.kill, effectiveBp.damage),
    SafeInt.add(effectiveBp.abort, effectiveBp.disruption),
  );

  if (totalBp === SafeInt.ZERO) {
    return {
      state,
      outcome: "NO_EFFECT",
      effectiveBp,
      consumedRounds: SafeInt.ZERO,
      draw: SafeInt.ZERO,
      streamId,
    };
  }

  const draw = drawAirDefenseOutcome(engine, streamId);
  const resolved = resolveEngagementOutcome({
    effectiveKillBp: effectiveBp.kill,
    effectiveDamageBp: effectiveBp.damage,
    effectiveAbortBp: effectiveBp.abort,
    effectiveDisruptionBp: effectiveBp.disruption,
    draw,
  });

  const consumedRounds = system.roundsPerEngagement;
  const nextState = consumeAmmunition(state, system.systemId, consumedRounds);
  return {
    state: nextState,
    outcome: resolved.outcome,
    effectiveBp,
    consumedRounds,
    draw,
    streamId,
  };
}
