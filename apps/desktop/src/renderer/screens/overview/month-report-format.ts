import type { BattleOutcome, StrategicPriority } from "@bluewave/campaign-engine";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { formatMonthYear } from "../../lib/campaign-month.js";

export function monthLabel(month: { readonly year: number; readonly month: number }): string {
  return formatMonthYear(month);
}

export function signed(value: number, format: PresentationFormat): string {
  if (value === 0) return "0";
  const body = format.count(Math.abs(value));
  return value > 0 ? `+${body}` : `−${body}`;
}

const ships = (count: number): string => (count === 1 ? "1 ship" : `${count} ships`);

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

export interface PriorityComparison {
  readonly created: readonly StrategicPriority[];
  readonly resolved: readonly StrategicPriority[];
  readonly continuing: readonly StrategicPriority[];
}

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
