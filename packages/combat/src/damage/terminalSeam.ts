// DESIGN-41 §29-32 — Terminal seam: SINKING and FOUNDERED detection.
// This stage runs after structure/flotation has been updated and determines
// whether the ship transitions from NORMAL to SINKING or FOUNDERED.
//
// Rules (§31-32):
//   SINKING: flotationReserve reaches 0 but no immediate foundering conditions.
//     sinkingDurationMinutes = clamp(10, 360, floor(120 * flotationPct * stabilityPct / 10_000^2))
//     where flotationPct and stabilityPct are the residual as bp of design values.
//   FOUNDERED: catastrophic structure breakup, or flotation=0 AND stability=0,
//     or capsize, or sinking duration reaches 0.
//
// Pure/deterministic: no ambient I/O/clock/random.

import { SHIP_SINKING, SHIP_FOUNDERED } from "./reasonCodes.js";

// Minimum sinking duration in minutes.
const MIN_SINKING_DURATION = 10;
// Maximum sinking duration in minutes.
const MAX_SINKING_DURATION = 360;
// Base survival minutes for the sinking duration formula.
const BASE_SURVIVAL_MINUTES = 120;

export interface TerminalInput {
  /** Flotation reserve after structure/flotation stage (absolute). */
  flotationReserveAfter: number;
  /** Structural integrity after structure/flotation stage (absolute). */
  structuralIntegrityAfter: number;
  /** Progressive flooding total (absolute kg). */
  progressiveFloodingTotal: number;
  /** Whether the ship has suffered catastrophic structural breakup. */
  catastrophicBreakup: boolean;
  /** Whether the ship is at risk of capsizing. */
  capsizeRisk: boolean;
  /** Current terminal status (from ShipDamageState). */
  currentTerminalStatus: string;
  /** Residual flotation as bp of design value [0, 10_000]. */
  flotationPct: number;
  /** Residual stability as bp of design value [0, 10_000]. */
  stabilityPct: number;
}

export type TerminalTransition = "NONE" | "SINKING" | "FOUNDERED";

export interface TerminalResult {
  /** The terminal transition (NONE, SINKING, or FOUNDERED). */
  transition: TerminalTransition;
  /** Sinking duration in minutes (only set if transition is SINKING). */
  sinkingDurationMinutes?: number;
  /** Reason code: SHIP_SINKING or SHIP_FOUNDERED. */
  reasonCode: string;
}

/**
 * Clamp a value between min and max (inclusive).
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Compute sinking duration from residual flotation and stability percentages.
 *
 * Formula (§31):
 *   sinkingDurationMinutes = clamp(10, 360, floor(120 * flotationPct * stabilityPct / 10_000^2))
 *
 * @param flotationPct - Residual flotation as bp of design value [0, 10_000].
 * @param stabilityPct - Residual stability as bp of design value [0, 10_000].
 * @returns Sinking duration in minutes.
 */
export function computeSinkingDuration(flotationPct: number, stabilityPct: number): number {
  // Ensure inputs are in valid range
  const fPct = Math.min(Math.max(Math.floor(flotationPct), 0), 10_000);
  const sPct = Math.min(Math.max(Math.floor(stabilityPct), 0), 10_000);

  const rawDuration = Math.floor((BASE_SURVIVAL_MINUTES * fPct * sPct) / (10_000 * 10_000));
  return clamp(rawDuration, MIN_SINKING_DURATION, MAX_SINKING_DURATION);
}

/**
 * Evaluate the terminal status transition (§29-32).
 *
 * Determines whether the ship transitions to SINKING or FOUNDERED based on
 * post-damage state values:
 *
 *   FOUNDERED conditions (any one triggers it):
 *     1. Catastrophic structural breakup
 *     2. flotationReserve <= 0 AND structuralIntegrity <= 0
 *     3. Capsize risk
 *
 *   SINKING condition:
 *     flotationReserve <= 0 AND none of the FOUNDERED conditions apply
 *     AND the ship is still in NORMAL state.
 *
 * @param input - Terminal conditions input.
 * @returns A TerminalResult describing the transition.
 */
export function evaluateTerminalSeam(input: TerminalInput): TerminalResult {
  const {
    flotationReserveAfter,
    structuralIntegrityAfter,
    catastrophicBreakup,
    capsizeRisk,
    currentTerminalStatus,
    flotationPct,
    stabilityPct,
  } = input;

  // If ship is already SINKING or FOUNDERED, no transition
  if (currentTerminalStatus === "SINKING" || currentTerminalStatus === "FOUNDERED") {
    return {
      transition: "NONE",
      reasonCode: "NONE",
    };
  }

  // Check FOUNDERED conditions
  const isFoundered =
    catastrophicBreakup ||
    (flotationReserveAfter <= 0 && structuralIntegrityAfter <= 0) ||
    capsizeRisk;

  if (isFoundered) {
    return {
      transition: "FOUNDERED",
      reasonCode: SHIP_FOUNDERED,
    };
  }

  // Check SINKING condition: flotation reserve exhausted
  if (flotationReserveAfter <= 0) {
    const sinkingDuration = computeSinkingDuration(flotationPct, stabilityPct);
    return {
      transition: "SINKING",
      sinkingDurationMinutes: sinkingDuration,
      reasonCode: SHIP_SINKING,
    };
  }

  // No transition
  return {
    transition: "NONE",
    reasonCode: "NONE",
  };
}
