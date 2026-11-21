import { SafeInt } from "@bluewave/contracts";
import type { TradeDutyDesign } from "./tradeProtection.js";

const BP_DENOMINATOR = SafeInt(10_000);

export interface SubmarineThreatRules {
  readonly hullType: string;
  readonly quotaPerBoatBp: number;
  readonly attackBp: number;
  readonly lossPerHitBp: number;
  readonly blockadeReductionBp: number;
}

export interface ShortfallPrestigeRules {
  readonly thresholdBp: number;
  readonly lossBp: number;
}

export interface SubmarineShip {
  readonly id: string;
  readonly designVersionId: string;
  readonly readiness: string;
  readonly isUnderConstruction: boolean;
}

export function countEnemySubmarines(
  rules: Pick<SubmarineThreatRules, "hullType">,
  ships: readonly SubmarineShip[],
  designs: ReadonlyMap<string, TradeDutyDesign>,
): number {
  let count = 0;
  for (const ship of ships) {
    if (ship.isUnderConstruction || ship.readiness !== "ACTIVE") continue;
    if (designs.get(ship.designVersionId)?.hullType === rules.hullType) count += 1;
  }
  return count;
}

export function submarineQuotaTerm(
  rules: Pick<SubmarineThreatRules, "quotaPerBoatBp">,
  enemySubmarines: number,
): number {
  return SafeInt.div(
    SafeInt.mul(SafeInt(enemySubmarines), SafeInt(rules.quotaPerBoatBp)),
    BP_DENOMINATOR,
    "ceil",
  );
}

export function submarineAttackChanceBp(
  rules: {
    readonly shortfallAmplifyBp: number;
    readonly submarineThreat: Pick<SubmarineThreatRules, "attackBp" | "blockadeReductionBp">;
  },
  victimShortfallBp: number,
  attackerBlockadesVictim: boolean,
): number {
  const amplified = SafeInt.add(
    SafeInt(rules.submarineThreat.attackBp),
    SafeInt.div(
      SafeInt.mul(SafeInt(victimShortfallBp), SafeInt(rules.shortfallAmplifyBp)),
      BP_DENOMINATOR,
      "floor",
    ),
  );
  const capped = Math.min(10_000, amplified);
  if (!attackerBlockadesVictim) return capped;
  const remaining = SafeInt.sub(BP_DENOMINATOR, SafeInt(rules.submarineThreat.blockadeReductionBp));
  return SafeInt.div(SafeInt.mul(SafeInt(capped), remaining), BP_DENOMINATOR, "floor");
}

export function shortfallPrestigeLossBp(
  rules: ShortfallPrestigeRules,
  victimShortfallBp: number,
): number {
  return victimShortfallBp >= rules.thresholdBp ? rules.lossBp : 0;
}
