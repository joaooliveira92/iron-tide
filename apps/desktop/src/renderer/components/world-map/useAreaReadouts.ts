import { useMemo } from "react";

import { buildOwnershipRows, type AreaOwnershipRow } from "./map-a11y.js";
import { AREAS_BY_ID } from "./map-geometry.js";
import { campaignTreeRows, type AreaTreeRow } from "./area-tree.js";
import type { AreaSummary, MapPrototypeState, RouteReading } from "./map-state.js";
import { describeStrength, type RegionStrength } from "./map-strength.js";
import type { ProjectedArea } from "./projection.js";
import type { WorldMapSource } from "./world-map-source.js";

export interface AreaReadouts {
  readonly ownershipRows: readonly AreaOwnershipRow[];
  readonly rowById: ReadonlyMap<string, AreaOwnershipRow>;
  readonly treeRows: readonly AreaTreeRow[];
  readonly summary: AreaSummary | null;
  readonly routePath: string;
  readonly routeSet: ReadonlySet<string>;
}

export interface AreaReadoutsInput {
  readonly source: WorldMapSource;
  readonly state: MapPrototypeState;
  readonly route: RouteReading | null;
  readonly areas: readonly ProjectedArea[];
  readonly areasById: ReadonlyMap<string, ProjectedArea>;
  readonly strengths: readonly RegionStrength[];
}

export function useAreaReadouts({
  source,
  state,
  route,
  areas,
  areasById,
  strengths,
}: AreaReadoutsInput): AreaReadouts {
  const strengthById = useMemo(
    () => new Map(strengths.map((region) => [region.areaId, region])),
    [strengths],
  );
  const ownershipRows = useMemo(
    () =>
      buildOwnershipRows(
        areas.map((area) => ({ id: area.id, name: AREAS_BY_ID.get(area.id)?.name ?? area.id })),
        (id) => {
          const owner = source.control.get(id)?.owner ?? null;
          return owner === null ? null : source.nameFor(owner);
        },
        (id) => source.fleets.filter((fleet) => fleet.area === id).length,
        (id) => source.possessionCounts.get(id) ?? 0,
        state.selected,
        (id) => {
          const region = strengthById.get(id);
          return region === undefined ? null : describeStrength(region);
        },
        (id) => source.unavailable.has(id),
      ),
    [areas, source, state.selected, strengthById],
  );
  const rowById = useMemo(
    () => new Map(ownershipRows.map((row) => [row.id, row])),
    [ownershipRows],
  );

  const routeSet = useMemo(() => new Set(route?.path ?? []), [route]);

  const summary = useMemo(
    () => (state.selected === null ? null : source.summarise(state.selected)),
    [source, state.selected],
  );

  const treeRows = useMemo<AreaTreeRow[]>(() => {
    if (source.campaignAreas !== null) {
      return campaignTreeRows(
        source.campaignAreas,
        source.playerNationId,
        (nation) => source.nameFor(nation),
        state.selected,
      );
    }
    return ownershipRows.map((row) => ({
      id: row.id,
      name: row.name,
      owner: row.owner,
      ships: row.fleets,
      possessed: row.possessions > 0,
      mapAreaId: row.id,
      selected: row.selected,
    }));
  }, [source, ownershipRows, state.selected]);

  const routePath = useMemo(() => {
    if (route === null || !state.layers.routes) return "";
    return route.path
      .map((id, index) => {
        const point = areasById.get(id)?.label;
        if (point === undefined) return "";
        return `${index === 0 ? "M" : "L"}${point[0]} ${point[1]}`;
      })
      .join("");
  }, [areasById, route, state.layers.routes]);

  return { ownershipRows, rowById, treeRows, summary, routePath, routeSet };
}
