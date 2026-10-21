// S-5 (spec #73 R5/R6, ADR-0247): the monthly presence measurement for each nation and presence area. Pure and
// deterministic: integer maths only, one stated rounding, canonical order (nation, area, ship). Every value comes from the
// optional ruleset section through `PresenceMeasurementRules`; this module owns no number, so with the section absent the
// caller passes no rules and gets nothing back. Blockade exemption, penalties, routing and base limits are later tickets.
import { SafeInt } from "@bluewave/contracts";
import { presenceAreaIds } from "./presence.js";
import { isShipOperational, type CampaignSnapshot, type Ship } from "./state.js";

/** The ruleset-section values the measurement reads (a structural subset of the `presence` section). */
export interface PresenceMeasurementRules {
  /** Tons required per possession per unit of value weight (decision request 0016). */
  readonly requiredTonsPerPossessionWeight: number;
  /** The value weight of a possession in an area where its nation has no port (decision request 0016). */
  readonly noPortValueWeight: number;
  /** Basis points of tonnage a cramped or short-range ship counts for (manual p.46; strictly below 10_000). */
  readonly crampedOrShortRangeCountBp: number;
}

/** One nation's presence in one area for the month. All tonnages are whole metric tons. */
export interface PresenceAreaRow {
  readonly nationId: string;
  readonly areaId: string;
  readonly requiredTons: number;
  readonly presentTons: number;
  /** `max(0, requiredTons - presentTons)`; never negative. */
  readonly shortfallTons: number;
}

const KG_PER_TON = SafeInt(1_000);
const BP = SafeInt(10_000);

/** The ship-state facts that change how much of a ship's tonnage counts. */
export interface ShipCountingTraits {
  /** Colonial-service fitted and on foreign-station status: counts exactly 3/2 (manual p.46). */
  readonly colonialOnForeignStation: boolean;
  /** Cramped accommodation or short range: counts at the ruleset fraction (manual p.46). */
  readonly reduced: boolean;
}

/**
 * The kilograms of a ship's displacement that count toward presence. The weighting and the fraction are applied as one
 * exact product and rounded once, down: `floor(kg x num x bp / den)` with `num/den` = 3/2 for a colonial-service ship on
 * foreign station (else 1/1) and `bp/10000` the fraction when reduced (else 1). One rounding keeps the result independent of
 * the order of the two factors.
 */
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

/** Whether a ship contributes at all: commissioned, operational and ACTIVE (a foreign-station ship is ACTIVE). */
export function contributesToPresence(ship: Ship): boolean {
  return isShipOperational(ship) && ship.readiness === "ACTIVE";
}

/**
 * Required tons for a nation in an area: sum over its possessions there of `requiredTonsPerPossessionWeight x valueWeight`,
 * where `valueWeight` is the level of the nation's best port in the area, or `noPortValueWeight` without one.
 */
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

/**
 * The presence rows for every nation and presence area, ordered by nation id then area id. A ship with no compiled design
 * in the snapshot has unknown tonnage and contributes nothing (it is never guessed). Present tons are the summed counted
 * kilograms floored to whole tons once per area.
 */
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
