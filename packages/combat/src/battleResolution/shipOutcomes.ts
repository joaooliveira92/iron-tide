import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { battleLoss, type DamageContext } from "../damage/minuteDamage.js";
import type { TacticalShipUnit } from "../tactical/unit.js";
import { BATTLE_AUTO_RESOLUTION_FAILED } from "./reasonCodes.js";

export interface ShipOutcomes {
  attackerSunkIds: string[];
  defenderSunkIds: string[];
  attackerSurvivorIds: string[];
  defenderSurvivorIds: string[];
  damageReport: Record<string, SafeInt>;
}

export function shipOutcomes(input: {
  battleId: string;
  units: readonly TacticalShipUnit[];
  damage: DamageContext;
}): ShipOutcomes {
  const { battleId, units, damage } = input;
  const attackerShips = units.filter((u) => u.sideId === "ATTACKER");
  const defenderShips = units.filter((u) => u.sideId === "DEFENDER");
  const sunkOf = (ships: readonly TacticalShipUnit[]): string[] =>
    ships
      .filter((u) => {
        const st = damage.targets[u.assetId]?.state;
        if (!st) {
          throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
            code: BATTLE_AUTO_RESOLUTION_FAILED,
            battleId,
            shipId: u.assetId,
            reason: "projected unit has no damage target at result assembly",
          });
        }
        return st.terminalStatus !== "NORMAL";
      })
      .map((u) => u.assetId)
      .sort();

  const attackerSunkIds = sunkOf(attackerShips);
  const defenderSunkIds = sunkOf(defenderShips);
  const survivorsOf = (ships: readonly TacticalShipUnit[], sunk: readonly string[]): string[] =>
    ships
      .map((u) => u.assetId)
      .sort()
      .filter((id) => !sunk.includes(id));

  const damageReport: Record<string, SafeInt> = {};
  for (const u of units) {
    const st = damage.targets[u.assetId]?.state;
    if (!st) continue;
    damageReport[u.assetId] = battleLoss(u.hitPoints as number, st, u.maxHitPoints as number);
  }
  return {
    attackerSunkIds,
    defenderSunkIds,
    attackerSurvivorIds: survivorsOf(attackerShips, attackerSunkIds),
    defenderSurvivorIds: survivorsOf(defenderShips, defenderSunkIds),
    damageReport,
  };
}
