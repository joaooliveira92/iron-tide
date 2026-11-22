import { SafeInt } from "@bluewave/contracts";
import type { SubmarinePolicy } from "./submarinePolicy.js";
import type { TradeDutyDesign, TradeDutyShip } from "./tradeProtection.js";

const BP_DENOMINATOR = SafeInt(10_000);

export interface SubmarineThreatRules {
  readonly hullType: string;
  readonly quotaPerBoatBp: number;
  readonly attackBp: number;
  readonly lossPerHitBp: number;
  readonly blockadeReductionBp: number;
  readonly aswEscortReductionBp?: number | undefined;
  readonly qShipReductionBp?: number | undefined;
  readonly unrestricted?: UnrestrictedWarfareRules | undefined;
}

export interface UnrestrictedWarfareRules {
  readonly chanceMultiplierBp: number;
  readonly incidentBp: number;
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
    readonly submarineThreat: Pick<
      SubmarineThreatRules,
      "attackBp" | "blockadeReductionBp" | "unrestricted"
    >;
  },
  victimShortfallBp: number,
  attackerBlockadesVictim: boolean,
  attackerPolicy?: SubmarinePolicy,
): number {
  const base = SafeInt.add(
    SafeInt(rules.submarineThreat.attackBp),
    SafeInt.div(
      SafeInt.mul(SafeInt(victimShortfallBp), SafeInt(rules.shortfallAmplifyBp)),
      BP_DENOMINATOR,
      "floor",
    ),
  );
  const unrestricted = rules.submarineThreat.unrestricted;
  const amplified =
    attackerPolicy === "UNRESTRICTED" && unrestricted !== undefined
      ? SafeInt.div(
          SafeInt.mul(base, SafeInt(unrestricted.chanceMultiplierBp)),
          BP_DENOMINATOR,
          "floor",
        )
      : base;
  const capped = Math.min(10_000, amplified);
  if (!attackerBlockadesVictim) return capped;
  const remaining = SafeInt.sub(BP_DENOMINATOR, SafeInt(rules.submarineThreat.blockadeReductionBp));
  return SafeInt.div(SafeInt.mul(SafeInt(capped), remaining), BP_DENOMINATOR, "floor");
}

export function countAswEscorts(
  rules: {
    readonly contributingHullTypes: readonly string[];
    readonly qShipHullType?: string | undefined;
  },
  ships: readonly TradeDutyShip[],
  designs: ReadonlyMap<string, TradeDutyDesign>,
): number {
  let count = 0;
  for (const ship of ships) {
    if (ship.stationAssignment !== "TRADE_PROTECTION" || ship.readiness !== "ACTIVE") continue;
    const design = designs.get(ship.designVersionId);
    if (design === undefined || !rules.contributingHullTypes.includes(design.hullType)) continue;
    if (design.hullType === rules.qShipHullType) continue;
    if (design.aswLevel !== undefined && design.aswLevel > 0) count += 1;
  }
  return count;
}

export function countQShips(
  rules: { readonly amcHullType: string },
  ships: readonly TradeDutyShip[],
  designs: ReadonlyMap<string, TradeDutyDesign>,
): number {
  let count = 0;
  for (const ship of ships) {
    if (ship.stationAssignment !== "TRADE_PROTECTION" || ship.readiness !== "ACTIVE") continue;
    if (designs.get(ship.designVersionId)?.hullType === rules.amcHullType) count += 1;
  }
  return count;
}

function compoundReduction(chanceBp: number, reductionBp: number, ships: number): number {
  const remaining = SafeInt.sub(BP_DENOMINATOR, SafeInt(reductionBp));
  let chance = SafeInt(chanceBp);
  for (let ship = 0; ship < ships && chance > 0; ship += 1) {
    chance = SafeInt.div(SafeInt.mul(chance, remaining), BP_DENOMINATOR, "floor");
  }
  return chance;
}

export function aswEscortAttackChanceBp(
  rules: Pick<SubmarineThreatRules, "aswEscortReductionBp">,
  chanceBp: number,
  aswEscorts: number,
): number {
  if (rules.aswEscortReductionBp === undefined || aswEscorts <= 0) return chanceBp;
  return compoundReduction(chanceBp, rules.aswEscortReductionBp, aswEscorts);
}

export function qShipAttackChanceBp(
  rules: Pick<SubmarineThreatRules, "qShipReductionBp">,
  chanceBp: number,
  qShips: number,
): number {
  if (rules.qShipReductionBp === undefined || qShips <= 0) return chanceBp;
  return compoundReduction(chanceBp, rules.qShipReductionBp, qShips);
}

export function shortfallPrestigeLossBp(
  rules: ShortfallPrestigeRules,
  victimShortfallBp: number,
): number {
  return victimShortfallBp >= rules.thresholdBp ? rules.lossBp : 0;
}
