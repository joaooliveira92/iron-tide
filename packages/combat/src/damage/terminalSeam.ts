import { SHIP_SINKING, SHIP_FOUNDERED } from "./reasonCodes.js";

const MIN_SINKING_DURATION = 10;
const MAX_SINKING_DURATION = 360;
const BASE_SURVIVAL_MINUTES = 120;

export interface TerminalInput {
  flotationReserveAfter: number;
  structuralIntegrityAfter: number;
  progressiveFloodingTotal: number;
  catastrophicBreakup: boolean;
  capsizeRisk: boolean;
  currentTerminalStatus: string;
  flotationPct: number;
  stabilityPct: number;
}

export type TerminalTransition = "NONE" | "SINKING" | "FOUNDERED";

export interface TerminalResult {
  transition: TerminalTransition;
  sinkingDurationMinutes?: number;
  reasonCode: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeSinkingDuration(flotationPct: number, stabilityPct: number): number {
  const fPct = Math.min(Math.max(Math.floor(flotationPct), 0), 10_000);
  const sPct = Math.min(Math.max(Math.floor(stabilityPct), 0), 10_000);

  const rawDuration = Math.floor((BASE_SURVIVAL_MINUTES * fPct * sPct) / (10_000 * 10_000));
  return clamp(rawDuration, MIN_SINKING_DURATION, MAX_SINKING_DURATION);
}

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

  if (currentTerminalStatus === "SINKING" || currentTerminalStatus === "FOUNDERED") {
    return {
      transition: "NONE",
      reasonCode: "NONE",
    };
  }

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

  if (flotationReserveAfter <= 0) {
    const sinkingDuration = computeSinkingDuration(flotationPct, stabilityPct);
    return {
      transition: "SINKING",
      sinkingDurationMinutes: sinkingDuration,
      reasonCode: SHIP_SINKING,
    };
  }

  return {
    transition: "NONE",
    reasonCode: "NONE",
  };
}
