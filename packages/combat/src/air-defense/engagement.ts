// D-4 M4 Aviation: Air Defense — AC-11 engagement resolution per DESIGN-45 §19/§20/§5.
//
// effectiveDefenseBp = floor(baseDefenseBp * director * radar * crew * damage * ammunition
//   * targetProfile * weather * saturation / 10_000^8)
// The exact rational result MUST be rounded once with FLOOR (§19 line 326).
//
// Bound analysis (ENGINEERING-CONTRACT, gunnery precedent DESIGN-07/§3): the eight §19
// multiplier slots fall into TWO policy classes (INC-4 bound repair, grounded in §14/§16):
//   NORMAL class — director, crew, damage, ammunition, targetProfile, weather (and the base
//   value): each is enforced by the function itself to be <= MAX_ENGAGEMENT_FACTOR_BP =
//   31_000 (the shipped director maximum, §12) and non-negative. 31_000 is the largest
//   shipped NORMAL-class factor; a factor above this cap is rejected fail-closed.
//   SATURATION class — radar (§14) and saturation (§16): SafeInt AGGREGATES that
//   legitimately exceed 31_000. The radar slot is the UNDIVIDED §14 marginal sum over the
//   ship's radar-directed medium-AA groups (4 groups → 40_000, i.e. the exact rational
//   effectiveRadarMediumAaGroups = 4.0 kept in the numerator); the saturation slot is the
//   UNDIVIDED §16 CIWS redundancy marginal sum (4 systems → 40_000). Each marginal is
//   <= 10_000 and the sum runs over the ship's actual group/system count, so realistic state
//   sizes keep the aggregate a plain safe integer (structural bound — the caller feeds the
//   actual aggregates). These slots are accepted WITHOUT the 31_000 limit; they still must
//   be non-negative safe integers at the boundary.
// The intermediate product therefore stays a bigint (the 10_000^8 denominator alone exceeds
// Number range; with both saturation-class slots at the boundary the numerator can reach
// ~31_000^7 × (9.007e15)^2 ≈ 2.2e63 — trivially within bigint and far above MAX_SAFE_INTEGER
// ~9.0e15, proving bigint necessary). The FLOORED result is a small safe integer for
// realistic state sizes: every NORMAL-class factor <= 31_000 and the saturation-class
// rationals are proportional to the ship's group/system counts — e.g. the shipped
// 4-director / 4-group / 4-CIWS optimum floors at ~500_000 for a neutral base
// (10_000 × 3.1 × 4.0 × 4.0 = 496_000), and a fleet-scale 64+64 saturation mix stays well
// below MAX_SAFE_INTEGER. A defensive check still throws if rawFloored would exceed
// MAX_SAFE_INTEGER — reachable ONLY by pathological-but-legal saturation aggregates (both
// slots near MAX_SAFE_INTEGER → floored ≈ 2.2e31), never by realistic state; it protects
// callers from a silent Number precision loss. No clamp: the design does not specify one —
// the raw floored value is returned and callers interpret it.
//
// Kill/damage/abort/disruption checks use ONE keyed random draw 0..9_999 (domain-separated
// @bluewave/random stream) against an explicit mutually exclusive cumulative outcome table
// (§19 line 328-330): KILL → DAMAGE → ABORT → DISRUPTION → NO_EFFECT. One draw can never
// count as both physical kill and disruption.
//
// `resolveEngagement` is the pure per-engagement entry point INC-6 will call. It does NOT
// re-run layer resolution or eligibility (the caller's job); it computes the four effective
// bp values, draws the keyed outcome, consumes roundsPerEngagement on every drawn
// engagement (KILL/DAMAGE/ABORT/DISRUPTION and a drawn NO_EFFECT alike), and returns the
// new immutable state + result.

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

// Exact denominator 10_000^8 = 10^32 (bigint; 10^32 — within bigint, not Number range).
const FORMULA_SCALE_N = BigInt(FORMULA_DENOMINATOR);
export const ENGAGEMENT_FORMULA_DENOMINATOR: bigint = FORMULA_SCALE_N ** BigInt(FORMULA_EXPONENT);

// ---- §19 formula ----

/** The 8 §19 multiplier factors (all basis points, SafeInt). */
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

// ---- Two-class factor bound policy (INC-4 repair; see module bound analysis) ----
// Factor order for the nine numerator factors: [base, director, radar, crew, damage,
// ammunition, targetProfile, weather, saturation] — the §19 product's written order.
// NORMAL-class slots are capped at MAX_ENGAGEMENT_FACTOR_BP (31_000, the shipped director
// maximum §12). SATURATION-class slots (radar §14, saturation §16) are unbounded by 31_000:
// they carry the UNDIVIDED marginal sums (4 radar groups → 40_000; 4 CIWS systems → 40_000)
// and are admitted as any non-negative safe integer (their structural bound — sum over the
// ship's actual group/system count, each marginal <= 10_000 — lives at the caller, INC-5/6).
// Factor order for the nine numerator factors: [base, director, radar, crew, damage,
// ammunition, targetProfile, weather, saturation] — the §19 product's written order.
// Exported as the canonical §19 factor-key order contracted by air_defense_v1 (AC-17).
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
// Keyed by slot name (not a parallel array) so the product's written order and the cap set
// cannot drift apart: adding a slot to ENGAGEMENT_FACTOR_SLOT_NAMES without assigning it a
// cap here is a compile error (MEDIUM-2/LOW-4 alignment repair).
const FACTOR_CAPS_BP: Readonly<Record<FactorSlotName, number>> = {
  base: MAX_ENGAGEMENT_FACTOR_BP, // base — NORMAL
  director: MAX_ENGAGEMENT_FACTOR_BP, // director — NORMAL
  radar: Number.MAX_SAFE_INTEGER, // radar — SATURATION (§14 aggregate, no 31_000 limit)
  crew: MAX_ENGAGEMENT_FACTOR_BP, // crew — NORMAL
  damage: MAX_ENGAGEMENT_FACTOR_BP, // damage — NORMAL
  ammunition: MAX_ENGAGEMENT_FACTOR_BP, // ammunition — NORMAL
  targetProfile: MAX_ENGAGEMENT_FACTOR_BP, // targetProfile — NORMAL
  weather: MAX_ENGAGEMENT_FACTOR_BP, // weather — NORMAL
  saturation: Number.MAX_SAFE_INTEGER, // saturation — SATURATION (§16 aggregate, no 31_000 limit)
};

/**
 * AC-11: effectiveDefenseBp = floor(baseDefenseBp * Π multiplierBp / 10_000^8).
 * All 9 factors (base + 8 multipliers) are accumulated as a bigint numerator, divided once
 * by 10_000^8 (bigint division floors for non-negative values), and returned as a SafeInt.
 * Fail-closed boundaries (TWO-CLASS policy, INC-4 repair): every NORMAL-class factor (base,
 * director, crew, damage, ammunition, targetProfile, weather) must be a non-negative safe
 * integer <= MAX_ENGAGEMENT_FACTOR_BP (31_000, the shipped director maximum §12); the
 * SATURATION-class slots (radar §14, saturation §16) must be non-negative safe integers but
 * are accepted WITHOUT the 31_000 limit — they carry the undivided §§14/16 marginal sums,
 * which legitimately exceed 31_000 (4 radar groups → 40_000; 4 CIWS systems → 40_000; see
 * module bound analysis). A defensive check also throws if the floored result ever exceeded
 * MAX_SAFE_INTEGER (protects pathology). The result is the raw floored value — never clamped
 * (see module bound analysis).
 */
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
  // bigint integer division floors (all values non-negative).
  const rawFloored: bigint = numerator / ENGAGEMENT_FORMULA_DENOMINATOR;
  if (rawFloored > BigInt(Number.MAX_SAFE_INTEGER)) {
    // Defensive: the documented TWO-CLASS bounds allow the floored result to reach ~2.2e31
    // (7 NORMAL factors at 31_000 × both SATURATION slots at MAX_SAFE_INTEGER →
    // ~31_000^7 × (9.007e15)^2 / 1e32), which EXCEEDS MAX_SAFE_INTEGER — so this throw IS
    // reachable by pathological-but-legal aggregate inputs and fires fail-closed rather than
    // silently losing precision in Number(rawFloored). Realistic ship-scale inputs (floored
    // <= ~1.5e6) never trip it.
    throw new BluewaveError("computeEffectiveDefenseBp: floored result exceeds MAX_SAFE_INTEGER", {
      code: INVALID_AIR_DEFENSE_STATE,
      rawFloored: rawFloored.toString(),
    });
  }
  return SafeInt(Number(rawFloored));
}

// ---- §5 outcome table ----

/** The five §5 primary engagement outcomes. */
export type EngagementOutcome = "KILL" | "DAMAGE" | "ABORT" | "DISRUPTION" | "NO_EFFECT";

/** Inputs to the mutually exclusive cumulative outcome table. */
export interface EngagementOutcomeParams {
  effectiveKillBp: SafeInt;
  effectiveDamageBp: SafeInt;
  effectiveAbortBp: SafeInt;
  effectiveDisruptionBp: SafeInt;
  /** One keyed random draw 0..9_999. */
  draw: SafeInt;
}

/** Cumulative band boundaries of the canonical outcome table. */
export interface EngagementOutcomeThresholds {
  /** [0, killEndBp) → KILL */
  killEndBp: SafeInt;
  /** [killEndBp, damageEndBp) → DAMAGE */
  damageEndBp: SafeInt;
  /** [damageEndBp, abortEndBp) → ABORT */
  abortEndBp: SafeInt;
  /** [abortEndBp, disruptionEndBp) → DISRUPTION */
  disruptionEndBp: SafeInt;
  /** == disruptionEndBp; draw >= totalBp → NO_EFFECT */
  totalBp: SafeInt;
}

export interface EngagementOutcomeResult {
  outcome: EngagementOutcome;
  draw: SafeInt;
  thresholds: EngagementOutcomeThresholds;
}

/**
 * AC-11 (§5 + §19 lines 328-330): exactly one primary outcome via the canonical mutually
 * exclusive cumulative outcome table, band precedence KILL → DAMAGE → ABORT → DISRUPTION →
 * NO_EFFECT:
 *
 *   draw < killBp                       → KILL
 *   draw < killBp + damageBp            → DAMAGE
 *   draw < killBp + damageBp + abortBp  → ABORT
 *   draw < + disruptionBp               → DISRUPTION
 *   otherwise                           → NO_EFFECT
 *
 * Cumulative sums use safe-integer arithmetic (each effective value <= 31_000; the sum of
 * the four <= 124_000, well within the safe range).
 */
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

/** Draw bounds for the engagement outcome draw (inclusive). */
export const ENGAGEMENT_DRAW_MIN = 0 as const;
export const ENGAGEMENT_DRAW_MAX = 9_999 as const;

/**
 * Domain-separated, stable stream id for one engagement's outcome draw. Same identity →
 * same stream → same draw (gunneryHitStreamId idiom).
 */
export function airDefenseEngagementStreamId(identity: {
  defenderId: string;
  systemId: string;
  attackId: string;
  minute: SafeInt;
  substep: SafeInt;
}): string {
  return `air-defense/engagement/${identity.defenderId}/${identity.systemId}/${identity.attackId}/${identity.minute}/${identity.substep}`;
}

/** One keyed random draw 0..9_999 for an air-defense engagement outcome. */
export function drawAirDefenseOutcome(engine: RandomEngine, streamId: string): SafeInt {
  const stream = engine.stream(streamId);
  return drawUniform(stream, SafeInt(ENGAGEMENT_DRAW_MIN), SafeInt(ENGAGEMENT_DRAW_MAX));
}

export interface EngagementResolutionInput {
  system: AirDefenseSystemDefinition;
  attack: AirDefenseAttack;
  state: AirDefenseState;
  /**
   * The 8 §19 multiplier factors. TWO factors are state-authoritative and overridden by the
   * state — they are NOT bypassable by the caller:
   * - `ammunitionBp` from ammunitionMultiplierBp (§20: an empty system contributes zero);
   * - `damageBp` from effectiveDamageMultiplierBp(state.damageBp, state.powerBp) (§21: a
   *   DESTROYED (damageBp >= 10_000) or unpowered (powerBp <= 0) system contributes zero).
   * The caller supplies the other six (INC-4 computes director/radar/saturation).
   */
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
  /** New immutable state (ammunition consumed when the system engaged). */
  state: AirDefenseState;
  outcome: EngagementOutcome;
  effectiveBp: { kill: SafeInt; damage: SafeInt; abort: SafeInt; disruption: SafeInt };
  /**
   * Rounds consumed by this engagement. Consumed on EVERY drawn engagement — every fired
   * resolution, including a drawn NO_EFFECT (§20 line 334: "Every engagement MUST reserve and
   * consume exact ammunition"). Zero only on the zero-contribution path, where the system did
   * not fire (empty / destroyed / zero-base bands → no draw taken).
   */
  consumedRounds: SafeInt;
  /**
   * The keyed draw for this engagement. When the system contributes zero (empty/zero-band
   * outcome bands — no draw is taken), this is the documented sentinel SafeInt.ZERO and no
   * ammunition is consumed; every real drawn outcome (including a drawn NO_EFFECT) consumes
   * ammunition.
   */
  draw: SafeInt;
  streamId: string;
}

/**
 * Resolves ONE eligible system-vs-attack engagement (INC-6 entry point). Lean: does NOT
 * re-run layer resolution or eligibility — the caller determines those. Computes the four
 * effective bp values from the system's base values × the §19 multipliers, draws ONE keyed
 * outcome, resolves the primary outcome via the canonical table, and consumes
 * roundsPerEngagement on every drawn engagement — KILL/DAMAGE/ABORT/DISRUPTION and a drawn
 * NO_EFFECT alike (§20 line 334: "Every engagement MUST reserve and consume exact
 * ammunition"). The only non-consuming path is the zero-contribution early return: a system
 * that contributes zero — empty ammunition (§20 line 346), DESTROYED (damageBp >= 10_000) or
 * unpowered (powerBp <= 0) (§21), or zero-base bands — yields all-zero effective bp →
 * NO_EFFECT, no draw taken, nothing consumed, and does not fire.
 */
export function resolveEngagement(input: EngagementResolutionInput): EngagementResolution {
  const { system, state, multipliers, engine, identity } = input;
  const streamId = airDefenseEngagementStreamId(identity);

  // Lean integrity check: the system must be an authoritative member of the state.
  if (!state.systems.some((sys) => sys.systemId === system.systemId)) {
    throw new BluewaveError("resolveEngagement: system is not part of the air-defense state", {
      code: INVALID_AIR_DEFENSE_STATE,
      systemId: system.systemId,
    });
  }

  // §20/§21 authoritative state factors: ammunition (empty → 0) AND damage×power (DESTROYED
  // / unpowered → 0) — both contribute zero and are not bypassable by the caller.
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
    // No outcome band is reachable (empty system / destroyed / degenerate zero-base system):
    // the system contributes zero. No draw is consumed and no ammunition is expended.
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

  // Every drawn engagement has fired and MUST consume exact ammunition (§20 line 334):
  // KILL/DAMAGE/ABORT/DISRUPTION AND a drawn NO_EFFECT all consume roundsPerEngagement.
  // Only the zero-contribution path above (no draw taken — the system did not fire) consumes
  // nothing (§20 line 346: an empty system "contributes zero").
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
