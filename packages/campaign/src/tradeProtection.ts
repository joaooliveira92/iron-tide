import type { BlockadeState } from "./state.js";

export const MERCHANT_POOL_FULL_BP = 10_000;

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
}

export interface TradeProtectionState {
  readonly month: string;
  readonly quota: number;
  readonly assigned: number;
  readonly shortfall: number;
  readonly shortfallBp: number;
  readonly merchantPoolBp: number;
  readonly lastLossMonth?: string;
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
): number {
  const fleetTerm = Math.ceil((fleetShips * rules.fleetShareBp) / 10_000);
  const economyTerm = Math.floor(baseResources / rules.resourcesPerRequiredShip);
  return fleetTerm + economyTerm;
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
  return { shortfall, shortfallBp: Math.floor((shortfall * 10_000) / quota) };
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
  const amplified = baseBp + Math.floor((victimShortfallBp * rules.shortfallAmplifyBp) / 10_000);
  return Math.min(10_000, amplified);
}

export function tradeProtectionRevenueBp(
  rules: TradeProtectionRules,
  merchantPoolBp: number,
): number {
  const loss = MERCHANT_POOL_FULL_BP - merchantPoolBp;
  return MERCHANT_POOL_FULL_BP - Math.floor((loss * rules.revenueSensitivityBp) / 10_000);
}

export function tradeProtectionUnrestStep(
  rules: TradeProtectionRules,
  merchantPoolBp: number,
  campaignMonth: string,
): number {
  if (MERCHANT_POOL_FULL_BP - merchantPoolBp < rules.unrestThresholdBp) return 0;
  const calendarMonth = Number(campaignMonth.split("-")[1]);
  return calendarMonth % rules.unrestCadenceMonths === 0 ? rules.unrestStep : 0;
}

export function recoverMerchantPool(rules: TradeProtectionRules, merchantPoolBp: number): number {
  return Math.min(MERCHANT_POOL_FULL_BP, merchantPoolBp + rules.recoveryBpPerMonth);
}

export function applyMerchantLoss(merchantPoolBp: number, lossBp: number): number {
  return Math.max(0, merchantPoolBp - lossBp);
}
