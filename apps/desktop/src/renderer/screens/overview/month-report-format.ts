import type { BattleOutcome, StrategicPriority } from "@bluewave/campaign-engine";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { formatMonthYear } from "../../lib/campaign-month.js";

/** "March 1900"; falls back to the numeric month when out of range, never a blank. */
export function monthLabel(month: { readonly year: number; readonly month: number }): string {
  return formatMonthYear(month);
}

/** "+20", "−56" (a real minus sign), "0" — so a loss reads as a loss at a glance. */
export function signed(value: number, format: PresentationFormat): string {
  if (value === 0) return "0";
  const body = format.count(Math.abs(value));
  return value > 0 ? `+${body}` : `−${body}`;
}

const ships = (count: number): string => (count === 1 ? "1 ship" : `${count} ships`);

/**
 * One sentence per battle: who won where, and what it cost each side. An undecided battle is a
 * draw, never a win for anyone. Reads the real `BattleOutcome` loss id lists, counting ships.
 */
export function describeBattle(
  battle: BattleOutcome,
  nation: (id: string) => string,
  area: (id: string) => string,
): string {
  const attacker = nation(battle.attackerId);
  const defender = nation(battle.defenderId);
  const place = area(battle.areaId);
  const cost = `${attacker} lost ${ships(battle.attackerLosses.length)}, ${defender} lost ${ships(battle.defenderLosses.length)}`;
  if (battle.winnerId === null) {
    return `${attacker} and ${defender} fought to a draw in ${place}. ${cost}.`;
  }
  const winner = battle.winnerId === battle.attackerId ? attacker : defender;
  const loser = battle.winnerId === battle.attackerId ? defender : attacker;
  return `${winner} defeated ${loser} in ${place}. ${cost}.`;
}

/** The Priorities section's comparison against the previous report (spec §16). */
export interface PriorityComparison {
  /** Fingerprints present this month but not the previous report. */
  readonly created: readonly StrategicPriority[];
  /** Priorities present the previous report but not this month. */
  readonly resolved: readonly StrategicPriority[];
  /** Priorities carried over from the previous report. */
  readonly continuing: readonly StrategicPriority[];
}

/**
 * Derives new / resolved / continuing priorities by comparing this report's
 * fingerprints against the previous report's stored fingerprints (spec §16 —
 * "new/resolved/continuing derived by comparing against the previous report's
 * stored priority fingerprints"). Pure and deterministic; an empty previous
 * list makes every current priority "new".
 */
export function comparePriorities(
  current: readonly StrategicPriority[],
  previous: readonly StrategicPriority[],
): PriorityComparison {
  const currentFingerprints = new Set(current.map((priority) => priority.fingerprint));
  const previousFingerprints = new Set(previous.map((priority) => priority.fingerprint));
  return {
    created: current.filter((priority) => !previousFingerprints.has(priority.fingerprint)),
    resolved: previous.filter((priority) => !currentFingerprints.has(priority.fingerprint)),
    continuing: current.filter((priority) => previousFingerprints.has(priority.fingerprint)),
  };
}
