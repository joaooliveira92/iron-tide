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
  readonly fleetSupport?: FleetSupportRules | undefined;
}

export interface FleetSupportRules {
  readonly chanceMultiplierBp: number;
  readonly quotaMultiplierBp?: number | undefined;
}

export interface UnrestrictedWarfareRules {
  readonly chanceMultiplierBp: number;
  readonly incidentBp: number;
  readonly neutralEntryBp?: number | undefined;
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
  rules: Pick<SubmarineThreatRules, "quotaPerBoatBp" | "fleetSupport">,
  enemySubmarines: number,
  fleetSupportSubmarines: number = 0,
): number {
  const quotaMultiplierBp = rules.fleetSupport?.quotaMultiplierBp;
  const weightedBoatsBp =
    quotaMultiplierBp === undefined || fleetSupportSubmarines <= 0
      ? SafeInt.mul(SafeInt(enemySubmarines), BP_DENOMINATOR)
      : SafeInt.add(
          SafeInt.mul(SafeInt(enemySubmarines - fleetSupportSubmarines), BP_DENOMINATOR),
          SafeInt.mul(SafeInt(fleetSupportSubmarines), SafeInt(quotaMultiplierBp)),
        );
  return SafeInt.div(
    SafeInt.mul(weightedBoatsBp, SafeInt(rules.quotaPerBoatBp)),
    SafeInt.mul(BP_DENOMINATOR, BP_DENOMINATOR),
    "ceil",
  );
}

function policyChanceMultiplierBp(
  rules: Pick<SubmarineThreatRules, "unrestricted" | "fleetSupport">,
  policy: SubmarinePolicy | undefined,
): number | undefined {
  if (policy === "UNRESTRICTED") return rules.unrestricted?.chanceMultiplierBp;
  if (policy === "FLEET_SUPPORT") return rules.fleetSupport?.chanceMultiplierBp;
  return undefined;
}

export interface SubmarineAttackChanceRules {
  readonly shortfallAmplifyBp: number;
  readonly submarineThreat: Pick<
    SubmarineThreatRules,
    "attackBp" | "blockadeReductionBp" | "unrestricted" | "fleetSupport"
  >;
}

export interface SubmarineAttackChanceStages {
  readonly attackBp: number;
  readonly shortfallTermBp: number;
  readonly baseBp: number;
  readonly policyMultiplierBp: number | undefined;
  readonly amplifiedBp: number;
  readonly cappedBp: number;
  readonly blockadedBp: number;
}

export function submarineAttackChanceStages(
  rules: SubmarineAttackChanceRules,
  victimShortfallBp: number,
  attackerBlockadesVictim: boolean,
  attackerPolicy?: SubmarinePolicy,
): SubmarineAttackChanceStages {
  const attackBp = SafeInt(rules.submarineThreat.attackBp);
  const shortfallTermBp = SafeInt.div(
    SafeInt.mul(SafeInt(victimShortfallBp), SafeInt(rules.shortfallAmplifyBp)),
    BP_DENOMINATOR,
    "floor",
  );
  const baseBp = SafeInt.add(attackBp, shortfallTermBp);
  const policyMultiplierBp = policyChanceMultiplierBp(rules.submarineThreat, attackerPolicy);
  const amplifiedBp =
    policyMultiplierBp === undefined
      ? baseBp
      : SafeInt.div(SafeInt.mul(baseBp, SafeInt(policyMultiplierBp)), BP_DENOMINATOR, "floor");
  const cappedBp = Math.min(10_000, amplifiedBp);
  const blockadedBp = attackerBlockadesVictim
    ? SafeInt.div(
        SafeInt.mul(
          SafeInt(cappedBp),
          SafeInt.sub(BP_DENOMINATOR, SafeInt(rules.submarineThreat.blockadeReductionBp)),
        ),
        BP_DENOMINATOR,
        "floor",
      )
    : cappedBp;
  return {
    attackBp,
    shortfallTermBp,
    baseBp,
    policyMultiplierBp,
    amplifiedBp,
    cappedBp,
    blockadedBp,
  };
}

export function submarineAttackChanceBp(
  rules: SubmarineAttackChanceRules,
  victimShortfallBp: number,
  attackerBlockadesVictim: boolean,
  attackerPolicy?: SubmarinePolicy,
): number {
  return submarineAttackChanceStages(
    rules,
    victimShortfallBp,
    attackerBlockadesVictim,
    attackerPolicy,
  ).blockadedBp;
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
