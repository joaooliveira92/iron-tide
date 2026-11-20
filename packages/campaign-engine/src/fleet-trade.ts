import {
  MERCHANT_POOL_FULL_BP,
  countTradeProtectionShips,
  isRaiderEligible,
  tradeDutyProblems,
  tradeProtectionQuota,
  tradeProtectionShortfall,
  type NationState,
  type TradeDutyDesign,
  type TradeProtectionRules,
} from "@bluewave/campaign";
import { compareCodePoints } from "@bluewave/deterministic";
import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";
import { FLEET_FORMULA_VERSION } from "./fleet-explanations.js";

const TRADE_SOURCE = { kind: "ruleset", ref: "trade_protection" } as const;
const TRADE_CODE_SOURCE = {
  kind: "code",
  ref: "packages/campaign/src/tradeProtection.ts",
} as const;

export type FleetTradeDuty = "TRADE_PROTECTION" | "RAIDER";

export interface FleetTradeShipView {
  readonly shipId: string;
  readonly name: string;
  readonly duty: FleetTradeDuty | null;
  readonly assignable: boolean;
  readonly contributes: boolean;
  readonly countsTowardQuota: boolean;
  readonly canRaid: boolean;
}

export interface FleetTradeProjection {
  readonly atWar: boolean;
  readonly quota: number;
  readonly quotaExplanation: ExplanationTree;
  readonly assigned: number;
  readonly assignedExplanation: ExplanationTree;
  readonly shortfall: number;
  readonly shortfallBp: number;
  readonly shortfallExplanation: ExplanationTree;
  readonly merchantPoolBp: number;
  readonly ships: readonly FleetTradeShipView[];
}

export function explainTradeQuota(
  rules: Pick<TradeProtectionRules, "fleetShareBp" | "resourcesPerRequiredShip">,
  fleetShips: number,
  baseResources: number,
  quota: number,
): ExplanationTree {
  const fleetTerm = Math.ceil((fleetShips * rules.fleetShareBp) / 10_000);
  const economyTerm = Math.floor(baseResources / rules.resourcesPerRequiredShip);
  return new ExplanationBuilder("fleet_trade_quota", FLEET_FORMULA_VERSION)
    .withInput("fleetShips", fleetShips)
    .withInput("baseResources", baseResources)
    .withInput("fleetShareBp", rules.fleetShareBp)
    .withInput("resourcesPerRequiredShip", rules.resourcesPerRequiredShip)
    .withResult(quota)
    .withOperation("add")
    .withSource(TRADE_SOURCE)
    .addChild(
      new ExplanationBuilder("fleet_trade_quota.fleet", FLEET_FORMULA_VERSION)
        .withInput("fleetShips", fleetShips)
        .withInput("fleetShareBp", rules.fleetShareBp)
        .withResult(fleetTerm)
        .withSource(TRADE_SOURCE)
        .build(),
    )
    .addChild(
      new ExplanationBuilder("fleet_trade_quota.economy", FLEET_FORMULA_VERSION)
        .withInput("baseResources", baseResources)
        .withInput("resourcesPerRequiredShip", rules.resourcesPerRequiredShip)
        .withResult(economyTerm)
        .withSource(TRADE_SOURCE)
        .build(),
    )
    .build();
}

export function explainTradeAssigned(counted: number, holding: number): ExplanationTree {
  const builder = new ExplanationBuilder("fleet_trade_assigned", FLEET_FORMULA_VERSION)
    .withInput("holding", holding)
    .withResult(counted)
    .withOperation("subtract")
    .withSource(TRADE_CODE_SOURCE)
    .addChild(
      new ExplanationBuilder("fleet_trade_assigned.holding", FLEET_FORMULA_VERSION)
        .withInput("amount", holding)
        .withResult(holding)
        .withSource(TRADE_CODE_SOURCE)
        .build(),
    );
  if (holding > counted) {
    builder.addChild(
      new ExplanationBuilder("fleet_trade_assigned.excluded", FLEET_FORMULA_VERSION)
        .withInput("amount", holding - counted)
        .withResult(counted - holding)
        .withSource(TRADE_SOURCE)
        .build(),
    );
  }
  return builder.build();
}

export function explainTradeShortfall(
  quota: number,
  assigned: number,
  shortfall: number,
  shortfallBp: number,
): ExplanationTree {
  return new ExplanationBuilder("fleet_trade_shortfall", FLEET_FORMULA_VERSION)
    .withInput("quota", quota)
    .withInput("assigned", assigned)
    .withIntermediate("shortfall", shortfall)
    .withResult(shortfallBp)
    .withUnit("bp")
    .withOperation("divide")
    .withSource(TRADE_CODE_SOURCE)
    .build();
}

export interface FleetTradeInput {
  readonly rules: TradeProtectionRules;
  readonly nation: NationState;
  readonly designs: ReadonlyMap<string, TradeDutyDesign>;
  readonly atWar: boolean;
  readonly shipNames: ReadonlyMap<string, string>;
}

export function buildFleetTradeProjection(input: FleetTradeInput): FleetTradeProjection {
  const { rules, nation, designs, atWar, shipNames } = input;
  const ships = nation.fleets
    .flatMap((fleet) => fleet.ships)
    .filter((ship) => ship.nationId === nation.id)
    .sort((a, b) => compareCodePoints(a.id, b.id));
  const operational = ships.filter((ship) => !ship.isUnderConstruction).length;
  const quota = tradeProtectionQuota(rules, operational, Number(nation.baseResources ?? 0));
  const assigned = countTradeProtectionShips(rules, ships, designs);
  const holding = ships.filter((ship) => ship.stationAssignment === "TRADE_PROTECTION").length;
  const gap = tradeProtectionShortfall(quota, assigned);
  return {
    atWar,
    quota,
    quotaExplanation: explainTradeQuota(
      rules,
      operational,
      Number(nation.baseResources ?? 0),
      quota,
    ),
    assigned,
    assignedExplanation: explainTradeAssigned(assigned, holding),
    shortfall: gap.shortfall,
    shortfallBp: gap.shortfallBp,
    shortfallExplanation: explainTradeShortfall(quota, assigned, gap.shortfall, gap.shortfallBp),
    merchantPoolBp: nation.tradeProtection?.merchantPoolBp ?? MERCHANT_POOL_FULL_BP,
    ships: ships.map((ship) => {
      const design = designs.get(ship.designVersionId);
      const contributes =
        design !== undefined &&
        ship.readiness === "ACTIVE" &&
        rules.contributingHullTypes.includes(design.hullType);
      const duty: FleetTradeDuty | null =
        ship.stationAssignment === "TRADE_PROTECTION" || ship.stationAssignment === "RAIDER"
          ? ship.stationAssignment
          : null;
      return {
        shipId: ship.id,
        name: shipNames.get(ship.id) ?? ship.id,
        duty,
        assignable:
          duty !== null ||
          tradeDutyProblems(nation, nation.id, [ship.id], "TRADE_PROTECTION").length === 0,
        contributes,
        countsTowardQuota: contributes && duty === "TRADE_PROTECTION",
        canRaid:
          design !== undefined &&
          isRaiderEligible(rules, { ...ship, stationAssignment: "RAIDER" }, design),
      };
    }),
  };
}
