import { useMemo, useState } from "react";
import type {
  ComponentCategory,
  ComponentSummary,
  DesignDraft,
  MountSide,
  PartCatalogueEntry,
  PlacementSpec,
  WorkshopView,
  ZoneId,
} from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import { nextInstanceId } from "../hull-plan/placement-edits.js";
import type { Edit } from "../types.js";
import { addZoneFor, midStation } from "./placement-helpers.js";

export interface PlacementActions {
  readonly setZoneId: (zone: ZoneId) => void;
  readonly add: (entry: PartCatalogueEntry) => void;
  readonly duplicate: (p: PlacementSpec) => void;
  readonly moveTo: (p: PlacementSpec, zone: ZoneId) => void;
  readonly remove: (p: PlacementSpec) => void;
  readonly setStation: (p: PlacementSpec, stationPermille: number) => void;
  readonly setSide: (p: PlacementSpec, side: MountSide) => void;
  readonly setParam: (p: PlacementSpec, param: string, value: number) => void;
}

export interface PlacementsState {
  readonly zoneId: ZoneId;
  readonly placements: readonly PlacementSpec[];
  readonly catalogue: readonly PartCatalogueEntry[];
  readonly catalogueById: ReadonlyMap<string, PartCatalogueEntry>;
  readonly compiledById: ReadonlyMap<string, ComponentSummary>;
}

export interface UsePlacementsStateInput {
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly view: WorkshopView;
  readonly edit: Edit;
  readonly categories?: ReadonlySet<ComponentCategory>;
}

export function usePlacementsState({
  draft,
  content,
  view,
  edit,
  categories,
}: UsePlacementsStateInput): {
  readonly state: PlacementsState;
  readonly actions: PlacementActions;
} {
  const [zoneId, setZoneId] = useState<ZoneId>("SUPERSTRUCTURE");
  const catalogueById = useMemo(
    () => new Map(content.catalogue.map((e) => [e.id, e])),
    [content.catalogue],
  );
  const compiledById = useMemo(
    () => new Map(view.compiled.components.map((c) => [c.instanceId, c])),
    [view.compiled.components],
  );
  const shown = (entry: PartCatalogueEntry | undefined) =>
    categories === undefined || (entry !== undefined && categories.has(entry.category));
  const placements = draft.placements.filter((p) => shown(catalogueById.get(p.componentId)));
  const catalogue = content.catalogue.filter((e) => shown(e));

  const add = (entry: PartCatalogueEntry) => {
    const zone = addZoneFor(entry, zoneId);
    edit({
      kind: "add_placement",
      placement: {
        instanceId: nextInstanceId(draft, entry.id),
        componentId: entry.id,
        zoneId: zone,
        stationPermille: midStation(content, draft, zone),
      },
    });
  };
  const duplicate = (p: PlacementSpec) =>
    edit({
      kind: "add_placement",
      placement: { ...p, instanceId: nextInstanceId(draft, p.componentId) },
    });
  const moveTo = (p: PlacementSpec, zone: ZoneId) =>
    edit({
      kind: "move_placement",
      instanceId: p.instanceId,
      zoneId: zone,
      stationPermille: midStation(content, draft, zone),
    });
  const remove = (p: PlacementSpec) => edit({ kind: "remove_placement", instanceId: p.instanceId });
  const setStation = (p: PlacementSpec, stationPermille: number) =>
    edit({
      kind: "move_placement",
      instanceId: p.instanceId,
      zoneId: p.zoneId,
      stationPermille,
    });
  const setSide = (p: PlacementSpec, side: MountSide) =>
    edit({ kind: "set_side", instanceId: p.instanceId, side });
  const setParam = (p: PlacementSpec, param: string, value: number) =>
    edit({ kind: "set_param", instanceId: p.instanceId, param, value });

  return {
    state: { zoneId, placements, catalogue, catalogueById, compiledById },
    actions: { setZoneId, add, duplicate, moveTo, remove, setStation, setSide, setParam },
  };
}
