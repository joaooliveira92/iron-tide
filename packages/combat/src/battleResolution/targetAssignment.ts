import type { GunneryBattery } from "../gunnery/resolve.js";
import { NO_TARGET } from "../gunnery/index.js";
import type { TacticalBattleState } from "../tactical/state.js";
import type { TacticalShipUnit } from "../tactical/unit.js";
import type { DamageContext } from "../damage/minuteDamage.js";

function squaredDistance(
  a: readonly [number, number] | undefined,
  b: readonly [number, number] | undefined,
): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = a[0]! - b[0]!;
  const dy = a[1]! - b[1]!;
  return dx * dx + dy * dy;
}

export function assignTargetContactIds(
  batteries: readonly GunneryBattery[],
  battleState: TacticalBattleState,
  damage: DamageContext,
  battleId: string,
  units: readonly TacticalShipUnit[],
  preferred: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const contacts = new Set(battleState.contacts?.map((c) => c.contactId) ?? []);
  const movement = battleState.movementStates ?? {};
  const out: Record<string, string> = {};
  for (const b of batteries) {
    const shooterPos = movement[b.ownerShipId]?.position;
    let best: { assetId: string; key: string; d2: number } | null = null;
    let wanted: string | null = null;
    for (const enemy of units) {
      if (enemy.sideId === b.sideId) continue;
      const key = `${battleId}:${enemy.assetId}`;
      if (!contacts.has(key)) continue;
      const state = damage.targets[enemy.assetId]?.state;
      if (state && state.terminalStatus !== "NORMAL") continue;
      if (key === preferred[b.ownerShipId]) wanted = key;
      const d2 = squaredDistance(shooterPos, movement[enemy.assetId]?.position);
      if (!best || d2 < best.d2 || (d2 === best.d2 && enemy.assetId < best.assetId)) {
        best = { assetId: enemy.assetId, key, d2 };
      }
    }
    out[b.id] = wanted ?? best?.key ?? NO_TARGET;
  }
  return out;
}
