import type { TacticalMinefieldRecord } from "@bluewave/combat/collision";

export type BattleMinefieldsByArea = Readonly<Record<string, readonly TacticalMinefieldRecord[]>>;

export function loadBattleMinefields(): BattleMinefieldsByArea | undefined {
  return undefined;
}
