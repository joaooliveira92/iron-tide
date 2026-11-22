import {
  countEnemySubmarines,
  countTradeProtectionShips,
  isRaiderEligible,
  tradeDutyDesigns,
  tradeDutyProblems,
  tradeProtectionQuota,
  tradeProtectionShortfall,
  type CampaignSnapshot,
  type NationState,
  type Ship,
  type TradeDutyDesign,
  type TradeProtectionRules,
} from "@bluewave/campaign";

export interface TradeDutyDecision {
  readonly assign: readonly string[];
  readonly release: readonly string[];
}

type Fleet = NationState["fleets"][number];
type DutySnapshot = Pick<CampaignSnapshot, "nations" | "designs">;

const NO_DUTY: TradeDutyDecision = { assign: [], release: [] };

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function shipsOf(nation: NationState): readonly Ship[] {
  return nation.fleets.flatMap((fleet) => fleet.ships);
}

function enemyExposure(
  rules: TradeProtectionRules,
  enemyShips: readonly Ship[],
  designs: ReadonlyMap<string, TradeDutyDesign>,
): { readonly exposed: boolean; readonly submarines: number } {
  const submarines =
    rules.submarineThreat === undefined
      ? 0
      : countEnemySubmarines(rules.submarineThreat, enemyShips, designs);
  const raiders = enemyShips.some((ship) => {
    const design = designs.get(ship.designVersionId);
    return design !== undefined && isRaiderEligible(rules, ship, design);
  });
  return { exposed: raiders || submarines > 0, submarines };
}

function aswShips(fleet: Fleet, designs: ReadonlyMap<string, TradeDutyDesign>): number {
  return fleet.ships.filter((ship) => (designs.get(ship.designVersionId)?.aswLevel ?? 0) > 0)
    .length;
}

function canEscort(
  nation: NationState,
  fleet: Fleet,
  rules: TradeProtectionRules,
  designs: ReadonlyMap<string, TradeDutyDesign>,
  sortieFleetIds: ReadonlySet<string>,
  enemyAreas: ReadonlySet<string>,
): boolean {
  if (fleet.ships.length === 0 || fleet.destinationAreaId !== undefined) return false;
  if (sortieFleetIds.has(fleet.id) || enemyAreas.has(fleet.locationAreaId)) return false;
  if (fleet.ships.some((ship) => ship.stationAssignment === "TRADE_PROTECTION")) return false;
  const contributing = fleet.ships.every((ship) => {
    const hull = designs.get(ship.designVersionId)?.hullType;
    return hull !== undefined && rules.contributingHullTypes.includes(hull);
  });
  return (
    contributing &&
    tradeDutyProblems(
      nation,
      nation.id,
      fleet.ships.map((ship) => ship.id),
      "TRADE_PROTECTION",
    ).length === 0
  );
}

function onTradeProtection(ship: Ship): boolean {
  return ship.stationAssignment === "TRADE_PROTECTION";
}

function dutyShipIds(fleets: readonly Fleet[]): string[] {
  return [...fleets]
    .sort((a, b) => compareCodePoints(a.id, b.id))
    .flatMap((fleet) =>
      fleet.ships
        .filter(onTradeProtection)
        .map((ship) => ship.id)
        .sort(compareCodePoints),
    );
}

function surplusDutyFleets(
  fleets: readonly Fleet[],
  quota: number,
  onDuty: number,
  rules: TradeProtectionRules,
  designs: ReadonlyMap<string, TradeDutyDesign>,
): string[] {
  const release: string[] = [];
  let remaining = onDuty;
  const wholeDuty = [...fleets]
    .filter((fleet) => fleet.ships.length > 0 && fleet.ships.every(onTradeProtection))
    .sort((a, b) => compareCodePoints(a.id, b.id));
  for (const fleet of wholeDuty) {
    const contribution = countTradeProtectionShips(rules, fleet.ships, designs);
    if (contribution === 0 || remaining - contribution < quota) continue;
    remaining -= contribution;
    release.push(...fleet.ships.map((ship) => ship.id).sort(compareCodePoints));
  }
  return release;
}

export function decideTradeDuty(
  snapshot: DutySnapshot,
  nationId: string,
  enemyId: string,
  rules: TradeProtectionRules,
  context: {
    readonly engaged: boolean;
    readonly sortieFleetIds: ReadonlySet<string>;
    readonly enemyAreas: ReadonlySet<string>;
  },
): TradeDutyDecision {
  const nation = snapshot.nations.get(nationId);
  const enemy = snapshot.nations.get(enemyId);
  if (nation === undefined || enemy === undefined) return NO_DUTY;
  const ships = shipsOf(nation);
  if (!context.engaged) {
    const release = ships
      .filter((ship) => ship.stationAssignment === "TRADE_PROTECTION")
      .map((ship) => ship.id)
      .sort(compareCodePoints);
    return { assign: [], release };
  }

  const designs = tradeDutyDesigns(snapshot.designs);
  const { exposed, submarines } = enemyExposure(rules, shipsOf(enemy), designs);
  if (!exposed) {
    return { assign: [], release: dutyShipIds(nation.fleets) };
  }

  const quota = tradeProtectionQuota(
    rules,
    ships.filter((ship) => !ship.isUnderConstruction).length,
    Number(nation.baseResources ?? 0),
    submarines,
  );
  const onDuty = countTradeProtectionShips(rules, ships, designs);
  const surplus = surplusDutyFleets(nation.fleets, quota, onDuty, rules, designs);
  if (surplus.length > 0) return { assign: [], release: surplus };
  let remaining = tradeProtectionShortfall(quota, onDuty).shortfall;

  const candidates = [...nation.fleets]
    .filter((fleet) =>
      canEscort(nation, fleet, rules, designs, context.sortieFleetIds, context.enemyAreas),
    )
    .sort(
      (a, b) =>
        (submarines > 0 ? aswShips(b, designs) - aswShips(a, designs) : 0) ||
        compareCodePoints(a.id, b.id),
    );
  const assign: string[] = [];
  for (const fleet of candidates) {
    if (remaining <= 0) break;
    assign.push(...fleet.ships.map((ship) => ship.id));
    remaining -= fleet.ships.length;
  }
  return { assign: assign.sort(compareCodePoints), release: [] };
}
