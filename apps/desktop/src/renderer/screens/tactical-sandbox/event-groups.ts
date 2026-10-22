import type { TacticalBattleOutcome } from "@bluewave/campaign-engine";

export interface BattleEventGroup {
  readonly eventType: string;
  readonly count: number;
}

export function groupEventsByType(outcome: TacticalBattleOutcome): readonly BattleEventGroup[] {
  const counts = new Map<string, number>();
  for (const event of outcome.battleEventLedger.events) {
    counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((a, b) => b.count - a.count);
}
