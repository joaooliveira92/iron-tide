import { SafeInt } from "@bluewave/contracts";
import { Data, Result } from "effect";
import type { RaiderInterceptionRules } from "./raiderInterception.js";
import {
  submarineQuotaTerm,
  type ShortfallPrestigeRules,
  type SubmarineThreatRules,
} from "./submarineThreat.js";
import type { BlockadeState } from "./state.js";

export const MERCHANT_POOL_FULL_BP = 10_000;

const BP_DENOMINATOR = SafeInt(10_000);
const CAMPAIGN_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class TradeProtectionMonthInvalid extends Data.TaggedError("TradeProtectionMonthInvalid")<{
  readonly campaignMonth: string;
}> {
  override get message(): string {
    return `Campaign month '${this.campaignMonth}' is not YYYY-MM`;
  }
}

function calendarMonthOf(
  campaignMonth: string,
): Result.Result<number, TradeProtectionMonthInvalid> {
  if (!CAMPAIGN_MONTH_PATTERN.test(campaignMonth))
    return Result.fail(new TradeProtectionMonthInvalid({ campaignMonth }));
  return Result.succeed(Number(campaignMonth.slice(5, 7)));
}

function scaleBp(value: number, factorBp: number, rounding: "floor" | "ceil"): number {
  return SafeInt.div(SafeInt.mul(SafeInt(value), SafeInt(factorBp)), BP_DENOMINATOR, rounding);
}

export interface TradeProtectionRules {
  readonly fleetShareBp: number;
  readonly resourcesPerRequiredShip: number;
  readonly contributingHullTypes: readonly string[];
  readonly raiderHullTypes: readonly string[];
  readonly amcHullType: string;
  readonly amcMinSpeedUms: number;
  readonly raiderHitBp: number;
  readonly shortfallAmplifyBp: number;
  readonly lossPerHitBp: number;
  readonly pressureChanceBp: number;
  readonly pressureLossBp: number;
  readonly recoveryBpPerMonth: number;
  readonly revenueSensitivityBp: number;
  readonly unrestThresholdBp: number;
  readonly unrestCadenceMonths: number;
  readonly unrestStep: number;
  readonly raiderInterception?: RaiderInterceptionRules;
  readonly submarineThreat?: SubmarineThreatRules;
  readonly shortfallPrestige?: ShortfallPrestigeRules;
}

export interface TradeProtectionState {
  readonly month: string;
  readonly quota: number;
  readonly assigned: number;
  readonly shortfall: number;
  readonly shortfallBp: number;
  readonly merchantPoolBp: number;
}

export interface TradeDutyShip {
  readonly designVersionId: string;
  readonly readiness: string;
  readonly stationAssignment?: string | undefined;
}

export interface TradeDutyDesign {
  readonly hullType: string;
  readonly normalizedSpeedUms: number;
  readonly shortRange?: true | undefined;
}

export function tradeProtectionQuota(
  rules: TradeProtectionRules,
  fleetShips: number,
  baseResources: number,
  enemySubmarines: number = 0,
): number {
  const fleetTerm = scaleBp(fleetShips, rules.fleetShareBp, "ceil");
  const economyTerm = SafeInt.div(
    SafeInt(baseResources),
    SafeInt(rules.resourcesPerRequiredShip),
    "floor",
  );
  const submarineTerm =
    rules.submarineThreat === undefined
      ? 0
      : submarineQuotaTerm(rules.submarineThreat, enemySubmarines);
  return SafeInt.add(SafeInt.add(SafeInt(fleetTerm), economyTerm), SafeInt(submarineTerm));
}

export function countTradeProtectionShips(
  rules: TradeProtectionRules,
  ships: readonly (TradeDutyShip & { readonly id: string })[],
  designs: ReadonlyMap<string, TradeDutyDesign>,
): number {
  let count = 0;
  for (const ship of ships) {
    if (ship.stationAssignment !== "TRADE_PROTECTION" || ship.readiness !== "ACTIVE") continue;
    const design = designs.get(ship.designVersionId);
    if (design !== undefined && rules.contributingHullTypes.includes(design.hullType)) count += 1;
  }
  return count;
}

export function tradeProtectionShortfall(
  quota: number,
  assigned: number,
): { readonly shortfall: number; readonly shortfallBp: number } {
  if (quota <= 0 || assigned >= quota) return { shortfall: 0, shortfallBp: 0 };
  const shortfall = quota - assigned;
  const shortfallBp = SafeInt.div(
    SafeInt.mul(SafeInt(shortfall), BP_DENOMINATOR),
    SafeInt(quota),
    "floor",
  );
  return { shortfall, shortfallBp };
}

export function isRaiderEligible(
  rules: TradeProtectionRules,
  ship: TradeDutyShip,
  design: TradeDutyDesign,
): boolean {
  if (ship.stationAssignment !== "RAIDER" || ship.readiness !== "ACTIVE") return false;
  if (design.shortRange === true) return false;
  if (!rules.raiderHullTypes.includes(design.hullType)) return false;
  if (design.hullType === rules.amcHullType)
    return design.normalizedSpeedUms >= rules.amcMinSpeedUms;
  return true;
}

export function isRaiderBlockedByBlockade(
  blockades: readonly Pick<BlockadeState, "blockaderId" | "blockadedNationId">[],
  raiderNationId: string,
  victimNationId: string,
): boolean {
  return blockades.some(
    (blockade) =>
      blockade.blockaderId === raiderNationId && blockade.blockadedNationId === victimNationId,
  );
}

export function merchantLossChanceBp(
  rules: TradeProtectionRules,
  victimShortfallBp: number,
  baseBp: number = rules.raiderHitBp,
): number {
  const amplified = SafeInt.add(
    SafeInt(baseBp),
    SafeInt(scaleBp(victimShortfallBp, rules.shortfallAmplifyBp, "floor")),
  );
  return Math.min(10_000, amplified);
}

export function tradeProtectionRevenueBp(
  rules: TradeProtectionRules,
  merchantPoolBp: number,
): number {
  const loss = SafeInt.sub(SafeInt(MERCHANT_POOL_FULL_BP), SafeInt(merchantPoolBp));
  return SafeInt.sub(
    SafeInt(MERCHANT_POOL_FULL_BP),
    SafeInt(scaleBp(loss, rules.revenueSensitivityBp, "floor")),
  );
}

export function tradeProtectionUnrestStep(
  rules: TradeProtectionRules,
  merchantPoolBp: number,
  campaignMonth: string,
): Result.Result<number, TradeProtectionMonthInvalid> {
  return Result.map(calendarMonthOf(campaignMonth), (calendarMonth) => {
    if (MERCHANT_POOL_FULL_BP - merchantPoolBp < rules.unrestThresholdBp) return 0;
    return calendarMonth % rules.unrestCadenceMonths === 0 ? rules.unrestStep : 0;
  });
}

export function recoverMerchantPool(rules: TradeProtectionRules, merchantPoolBp: number): number {
  return Math.min(
    MERCHANT_POOL_FULL_BP,
    SafeInt.add(SafeInt(merchantPoolBp), SafeInt(rules.recoveryBpPerMonth)),
  );
}

export function applyMerchantLoss(merchantPoolBp: number, lossBp: number): number {
  return Math.max(0, SafeInt.sub(SafeInt(merchantPoolBp), SafeInt(lossBp)));
}
