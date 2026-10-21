// S-5 08 (spec #73 R10/R11, ADR-0250): the month-end base-limit check for each nation and area. Pure and deterministic:
// integer maths only, canonical order (nation, area, ship id). Every value comes from the optional `baseLimits` block of the
// presence ruleset section through `BaseLimitRules`; this module owns no number, so with the block absent the caller passes
// no rules and gets nothing back. It reads neither wars nor blockades: base limits are not exempted by the blockade
// exemption (spec #73 R7/R10, ADR-0248) - `isPresenceExempt` must never be called from here.
import { isShipOperational, type CampaignSnapshot, type PortData, type Ship } from "./state.js";
import type { ShipReadinessState } from "./readiness.js";

/** The ruleset-section values the base-limit check reads (a structural subset of the `presence.baseLimits` block). */
export interface BaseLimitRules {
  /**
   * The ship-count limit for a nation's best port level in an area: entry `level - 1` serves port level `level`
   * (decision request 0017 leaves the mapping open; this is its shape, never a value).
   */
  readonly limitByBaseLevel: readonly number[];
  /** The 'very limited' limit where the nation has no usable base in the area (manual p.45). */
  readonly noBaseLimit: number;
  /** The readiness states whose ships occupy a base slot (decision request 0018 leaves the set open). */
  readonly occupyingStates: readonly ShipReadinessState[];
  /** Basis points added to an over-base ship's monthly maintenance (decision request 0019; the S-1 seam applies it). */
  readonly maintenanceAdderBp: number;
  /** Crew-quality points an over-base ship loses at each month end (decision request 0019; the S-1 seam applies it). */
  readonly crewQualityReduction: number;
}

/** One nation's deployment in one area for the month. */
export interface BaseLimitRow {
  readonly nationId: string;
  readonly areaId: string;
  /** Ships in an occupying state that are commissioned and operational in the area. */
  readonly deployed: number;
  readonly limit: number;
  /** The ships beyond the limit: the deployed ships after the first `limit` in ascending ship id. */
  readonly overShipIds: readonly string[];
}

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The limit for a nation in an area: the table entry for its best port level there, or the no-base limit when it has no
 * port there. A port level outside the table carries no base value (the compiler keeps levels within it), so it counts as
 * no port rather than being clamped.
 */
export function baseLimitInArea(
  world: { readonly ports: readonly PortData[] },
  nationId: string,
  areaId: string,
  rules: Pick<BaseLimitRules, "limitByBaseLevel" | "noBaseLimit">,
): number {
  let best: number | undefined;
  for (const port of world.ports) {
    if (port.nationId !== nationId || port.areaId !== areaId) continue;
    const limit = rules.limitByBaseLevel[Number(port.level) - 1];
    if (limit !== undefined && (best === undefined || limit > best)) best = limit;
  }
  return best ?? rules.noBaseLimit;
}

/**
 * The deployment rows for every nation and area that holds at least one occupying ship, ordered by nation id then area id.
 * Ships beyond the limit are the later ones in ascending ship id, so the answer does not depend on storage order.
 */
export function measureBaseLimits(
  snapshot: Pick<CampaignSnapshot, "nations" | "world">,
  rules: BaseLimitRules,
): BaseLimitRow[] {
  const occupying = new Set<ShipReadinessState>(rules.occupyingStates);
  const rows: BaseLimitRow[] = [];
  for (const nationId of [...snapshot.nations.keys()].sort(byId)) {
    const nation = snapshot.nations.get(nationId)!;
    const byArea = new Map<string, Ship[]>();
    for (const fleet of nation.fleets) {
      for (const ship of fleet.ships) {
        if (ship.nationId !== nationId || !isShipOperational(ship)) continue;
        if (!occupying.has(ship.readiness)) continue;
        const inArea = byArea.get(ship.locationAreaId);
        if (inArea === undefined) byArea.set(ship.locationAreaId, [ship]);
        else inArea.push(ship);
      }
    }
    for (const areaId of [...byArea.keys()].sort(byId)) {
      const ships = byArea.get(areaId)!.sort((a, b) => byId(a.id, b.id));
      const limit = baseLimitInArea(snapshot.world, nationId, areaId, rules);
      rows.push({
        nationId,
        areaId,
        deployed: ships.length,
        limit,
        overShipIds: ships.slice(limit).map((ship) => ship.id),
      });
    }
  }
  return rows;
}
