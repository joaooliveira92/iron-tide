import { isShipOperational, type CampaignSnapshot, type PortData, type Ship } from "./state.js";
import type { ShipReadinessState } from "./readiness.js";

export interface BaseLimitRules {
  readonly limitByBaseLevel: readonly number[];
  readonly noBaseLimit: number;
  readonly occupyingStates: readonly ShipReadinessState[];
  readonly maintenanceAdderBp: number;
  readonly crewQualityReduction: number;
}

export interface BaseLimitRow {
  readonly nationId: string;
  readonly areaId: string;
  readonly deployed: number;
  readonly limit: number;
  readonly overShipIds: readonly string[];
}

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

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
