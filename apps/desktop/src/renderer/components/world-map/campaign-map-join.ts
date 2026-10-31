import type { WorldMapView } from "@bluewave/campaign-engine";
import { fixtureAreaId } from "../../content/presentationContent.js";
import { areaAnchor, lanePath, portAnchor, type LonLat } from "./campaign-anchors.js";
import { AREAS_BY_ID, type AreaId, type NationId } from "./map-geometry.js";

export interface LiveWorldMapOverlay {
  readonly ownership: ReadonlyMap<AreaId, NationId | null>;
  readonly ports: readonly {
    readonly id: string;
    readonly name: string;
    readonly area: AreaId;
    readonly nation: NationId;
    readonly level: number;
    readonly anchor?: LonLat | null;
  }[];
  readonly fleets: readonly {
    readonly id: string;
    readonly name: string;
    readonly area: AreaId;
    readonly nation: NationId;
    readonly ships: number;
    readonly anchor?: LonLat | null;
  }[];
  readonly campaignAreas: readonly CampaignAreaEntry[];
  readonly lanes: readonly CampaignLane[] | null;
  readonly seaLanes?: readonly CampaignSeaLane[];
  readonly playerNationId: string | null;
  readonly source: "campaign" | "none";
}

export interface CampaignLane {
  readonly a: AreaId;
  readonly b: AreaId;
}

export interface CampaignSeaLane {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly path: readonly LonLat[];
}

export interface CampaignAreaEntry {
  readonly id: string;
  readonly name: string;
  readonly controller: string | null;
  readonly fleets: readonly { readonly nation: NationId; readonly ships: number }[];
}

export function joinWorldMap(world: WorldMapView): LiveWorldMapOverlay {
  const ownership = new Map<AreaId, NationId | null>();
  for (const area of world.areas) {
    const fixture = fixtureAreaId(area.id);
    if (fixture === null) continue;
    ownership.set(fixture, area.controller ?? null);
  }

  const ports = world.ports
    .map((port) => {
      const fixture = fixtureAreaId(port.areaId);
      if (fixture === null) return null;
      return {
        id: port.id,
        name: port.name,
        area: fixture,
        nation: port.nationId,
        level: port.level,
        anchor: portAnchor(port.id, port.areaId),
      };
    })
    .filter((port): port is NonNullable<typeof port> => port !== null);

  const fleets = world.fleets
    .map((fleet) => {
      const fixture = fixtureAreaId(fleet.areaId);
      if (fixture === null) return null;
      return {
        id: fleet.id,
        name: fleet.name,
        area: fixture,
        nation: fleet.nationId,
        ships: fleet.shipCount,
        anchor: areaAnchor(fleet.areaId),
      };
    })
    .filter((fleet): fleet is NonNullable<typeof fleet> => fleet !== null);

  const campaignAreas: CampaignAreaEntry[] = world.areas.map((area) => ({
    id: area.id,
    name: area.name,
    controller: area.controller ?? null,
    fleets: world.fleets
      .filter((fleet) => fleet.areaId === area.id)
      .map((fleet) => ({ nation: fleet.nationId, ships: fleet.shipCount })),
  }));

  const pairs = new Map<string, CampaignLane>();
  for (const route of world.routes) {
    if (route.type !== "sea") continue;
    const from = fixtureAreaId(route.from);
    const to = fixtureAreaId(route.to);
    if (from === null || to === null || from === to) continue;
    const [a, b] = from < to ? [from, to] : [to, from];
    pairs.set(`${a}~${b}`, { a, b });
  }
  const lanes = [...pairs.entries()]
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    .map(([, lane]) => lane);

  const seaLanes = world.routes.flatMap<CampaignSeaLane>((route) => {
    if (route.type !== "sea") return [];
    const path = lanePath(route.id, route.from, route.to);
    return path === null ? [] : [{ id: route.id, from: route.from, to: route.to, path }];
  });

  return {
    ownership,
    ports,
    fleets,
    campaignAreas,
    lanes,
    seaLanes,
    playerNationId: null,
    source: "campaign",
  };
}

export const EMPTY_LIVE_OVERLAY: LiveWorldMapOverlay = {
  ownership: new Map(),
  ports: [],
  fleets: [],
  campaignAreas: [],
  lanes: null,
  seaLanes: [],
  playerNationId: null,
  source: "none",
};

export function fixtureAnchor(area: AreaId): readonly [number, number] | null {
  return AREAS_BY_ID.get(area)?.label ?? null;
}

export function homeFocusPoint(campaignAreaId: string | null): readonly [number, number] | null {
  if (campaignAreaId === null) return null;
  const anchor = areaAnchor(campaignAreaId);
  if (anchor !== null) return anchor;
  const fixture = fixtureAreaId(campaignAreaId);
  return fixture === null ? null : fixtureAnchor(fixture);
}
