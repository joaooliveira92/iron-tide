import type { LiveWorldMapOverlay } from "../world-map/campaign-map-join.js";
import { campaignWorldMapSource } from "../world-map/world-map-source.js";
import { AREAS, AREAS_BY_ID } from "../world-map/map-geometry.js";
import { buildOwnershipRows, describeArea, type AreaOwnershipRow } from "../world-map/map-a11y.js";
import { campaignTreeRows, type AreaTreeRow } from "../world-map/area-tree.js";
import type { AreaSummary } from "../world-map/map-state.js";

export interface AdapterDerivedModel {
  readonly ownershipRows: readonly AreaOwnershipRow[];
  readonly treeRows: readonly AreaTreeRow[];
  readonly summary: AreaSummary | null;
  readonly summaryFor: (areaId: string) => AreaSummary | null;
  readonly nameFor: (nation: string | null) => string;
  readonly describeAreaFor: (areaId: string) => string;
  readonly areaName: (areaId: string) => string;
}

function shipCount(overlay: LiveWorldMapOverlay, areaId: string): number {
  return overlay.fleets
    .filter((fleet) => fleet.area === areaId)
    .reduce((total, fleet) => total + fleet.ships, 0);
}

export function deriveAdapterModel(
  overlay: LiveWorldMapOverlay,
  selected: string | null,
): AdapterDerivedModel {
  const source = campaignWorldMapSource(overlay);
  const ownershipRows = buildOwnershipRows(
    AREAS.map((area) => ({ id: area.id, name: area.name })),
    (areaId) => {
      const owner = overlay.ownership.get(areaId) ?? null;
      return owner === null ? null : source.nameFor(owner);
    },
    (areaId) => overlay.fleets.filter((fleet) => fleet.area === areaId).length,
    (areaId) => overlay.ports.filter((port) => port.area === areaId).length,
    selected,
    (areaId) => {
      const ships = shipCount(overlay, areaId);
      return ships === 0 ? null : `${ships} ships`;
    },
    (areaId) => !overlay.ownership.has(areaId),
  );
  const rowById = new Map(ownershipRows.map((row) => [row.id, row]));
  const treeRows =
    source.campaignAreas === null
      ? ownershipRows.map((row) => ({
          id: row.id,
          name: row.name,
          owner: row.owner,
          ships: row.fleets,
          possessed: row.possessions > 0,
          mapAreaId: row.id,
          selected: row.selected,
        }))
      : campaignTreeRows(
          source.campaignAreas,
          source.playerNationId,
          (nation) => source.nameFor(nation),
          selected,
        );

  return {
    ownershipRows,
    treeRows,
    summary: selected === null ? null : source.summarise(selected),
    summaryFor: (areaId) => source.summarise(areaId),
    nameFor: (nation) => source.nameFor(nation),
    describeAreaFor: (areaId) => {
      const row = rowById.get(areaId);
      return row === undefined ? areaId : describeArea(row);
    },
    areaName: (areaId) => AREAS_BY_ID.get(areaId)?.name ?? areaId,
  };
}
