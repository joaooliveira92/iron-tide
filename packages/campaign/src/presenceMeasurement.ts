import { SafeInt } from "@bluewave/contracts";
import type { BaseLimitRules } from "./baseLimits.js";
import { presenceAreaIds } from "./presence.js";
import { isShipOperational, type CampaignSnapshot, type Ship } from "./state.js";

export interface PresenceMeasurementRules {
  readonly requiredTonsPerPossessionWeight: number;
  readonly noPortValueWeight: number;
  readonly crampedOrShortRangeCountBp: number;
  readonly penaltyRequests?: true;
  readonly baseLimits?: BaseLimitRules;
}

export interface PresenceAreaRow {
  readonly nationId: string;
  readonly areaId: string;
  readonly requiredTons: number;
  readonly presentTons: number;
  readonly shortfallTons: number;
}

const KG_PER_TON = SafeInt(1_000);
const BP = SafeInt(10_000);

export interface ShipCountingTraits {
  readonly colonialOnForeignStation: boolean;
  readonly reduced: boolean;
}

export function shipCountedKg(
  displacementKg: SafeInt,
  traits: ShipCountingTraits,
  countBp: number,
): SafeInt {
  const weighted = traits.colonialOnForeignStation
    ? SafeInt.mul(displacementKg, SafeInt(3))
    : displacementKg;
  const fractionNumerator = traits.reduced ? SafeInt(countBp) : BP;
  const denominator = traits.colonialOnForeignStation ? SafeInt(20_000) : BP;
  return SafeInt.div(SafeInt.mul(weighted, fractionNumerator), denominator, "floor");
}

export function contributesToPresence(ship: Ship): boolean {
  return isShipOperational(ship) && ship.readiness === "ACTIVE";
}

export function requiredTonsInArea(
  snapshot: Pick<CampaignSnapshot, "world">,
  nationId: string,
  areaId: string,
  rules: PresenceMeasurementRules,
): SafeInt {
  const possessions = (snapshot.world.possessions ?? []).filter(
    (p) => p.nationId === nationId && p.areaId === areaId,
  );
  let bestLevel = 0;
  for (const port of snapshot.world.ports) {
    if (port.nationId === nationId && port.areaId === areaId && port.level > bestLevel) {
      bestLevel = port.level;
    }
  }
  const weight = SafeInt(bestLevel > 0 ? bestLevel : rules.noPortValueWeight);
  const perPossession = SafeInt.mul(SafeInt(rules.requiredTonsPerPossessionWeight), weight);
  return SafeInt.mul(perPossession, SafeInt(possessions.length));
}

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function measurePresence(
  snapshot: Pick<CampaignSnapshot, "nations" | "world" | "designs">,
  rules: PresenceMeasurementRules,
): PresenceAreaRow[] {
  const rows: PresenceAreaRow[] = [];
  const possessions = snapshot.world.possessions ?? [];
  for (const nationId of [...snapshot.nations.keys()].sort(byId)) {
    const nation = snapshot.nations.get(nationId)!;
    const areas = presenceAreaIds(possessions, nationId);
    if (areas.length === 0) continue;
    const ships = nation.fleets
      .flatMap((fleet) => fleet.ships)
      .filter((ship) => ship.nationId === nationId && contributesToPresence(ship))
      .sort((a, b) => byId(a.id, b.id));
    for (const areaId of areas) {
      let countedKg = SafeInt.ZERO;
      for (const ship of ships) {
        if (ship.locationAreaId !== areaId) continue;
        const design = snapshot.designs.get(ship.designVersionId);
        if (design === undefined) continue;
        countedKg = SafeInt.add(
          countedKg,
          shipCountedKg(
            design.normalizedDisplacementKg,
            {
              colonialOnForeignStation:
                ship.colonialServiceFitted === true && ship.stationAssignment === "FOREIGN_STATION",
              reduced: design.crampedAccommodation === true || design.shortRange === true,
            },
            rules.crampedOrShortRangeCountBp,
          ),
        );
      }
      const requiredTons = requiredTonsInArea(snapshot, nationId, areaId, rules);
      const presentTons = SafeInt.div(countedKg, KG_PER_TON, "floor");
      rows.push({
        nationId,
        areaId,
        requiredTons,
        presentTons,
        shortfallTons: Math.max(0, requiredTons - presentTons),
      });
    }
  }
  return rows;
}

export function isPresenceExempt(
  snapshot: Pick<CampaignSnapshot, "wars">,
  nationId: string,
  campaignMonth: string,
): boolean {
  const { wars, blockadeState } = snapshot.wars;
  const atWar = wars.some(
    (w) =>
      w.status !== "ENDED" &&
      (w.attackerSideMembers.includes(nationId) || w.defenderSideMembers.includes(nationId)),
  );
  return (
    atWar &&
    blockadeState.some(
      (b) => b.blockadedNationId === nationId && b.establishedMonth <= campaignMonth,
    )
  );
}
