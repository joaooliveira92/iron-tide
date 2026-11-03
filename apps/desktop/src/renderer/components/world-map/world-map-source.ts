import { AREAS, AREAS_BY_ID, type AreaId, type NationId } from "./map-geometry.js";
import type { AreaControl, AreaSummary } from "./map-state.js";
import type { FleetPlacement, PossessionPlacement } from "./map-markers.js";
import { campaignNationHue, campaignNationLabel } from "../../content/presentationContent.js";
import {
  fixtureAnchor,
  type CampaignAreaEntry,
  type LiveWorldMapOverlay,
} from "./campaign-map-join.js";

export interface WorldMapSource {
  readonly live: boolean;
  readonly playerNationId: string | null;
  readonly campaignAreas: readonly CampaignAreaEntry[] | null;
  readonly control: ReadonlyMap<AreaId, AreaControl>;
  readonly ports: readonly PossessionPlacement[];
  readonly fleets: readonly FleetPlacement[];
  readonly possessionCounts: ReadonlyMap<AreaId, number>;
  readonly unavailable: ReadonlySet<AreaId>;
  fillFor(nation: NationId | null, alpha: number): string;
  strokeFor(nation: NationId | null): string;
  nameFor(nation: NationId | null): string;
  summarise(areaId: AreaId): AreaSummary | null;
}

const UNCLAIMED_FILL = (alpha: number): string => `oklch(0.55 0 0 / ${alpha * 0.35})`;
const UNCLAIMED_STROKE = "oklch(0.6 0 0 / 0.5)";

function neighboursOf(
  lanes: readonly { readonly a: AreaId; readonly b: AreaId }[] | null,
): ReadonlyMap<AreaId, readonly AreaId[]> {
  const neighbours = new Map<AreaId, AreaId[]>();
  for (const lane of lanes ?? []) {
    if (lane.a === lane.b) continue;
    for (const [from, to] of [
      [lane.a, lane.b],
      [lane.b, lane.a],
    ] as const) {
      const list = neighbours.get(from) ?? [];
      if (!list.includes(to)) list.push(to);
      neighbours.set(from, list);
    }
  }
  for (const list of neighbours.values()) list.sort((left, right) => (left < right ? -1 : 1));
  return neighbours;
}

export function campaignWorldMapSource(overlay: LiveWorldMapOverlay): WorldMapSource {
  const adjacent = neighboursOf(overlay.lanes);

  const control = new Map<AreaId, AreaControl>();
  for (const [area, owner] of overlay.ownership) {
    control.set(area, { owner, contested: false, possessions: 0 });
  }

  const ports = overlay.ports.flatMap<PossessionPlacement>((port) => {
    const at = port.anchor ?? fixtureAnchor(port.area);
    if (at === null) return [];
    return [
      {
        id: port.id,
        name: port.name,
        at,
        owner: port.nation,
        base: port.level >= 7 ? "major" : "minor",
      },
    ];
  });

  const fleets = overlay.fleets.flatMap<FleetPlacement>((fleet) => {
    if (fixtureAnchor(fleet.area) === null) return [];
    return [
      {
        id: fleet.id,
        area: fleet.area,
        ...(fleet.anchor === null || fleet.anchor === undefined ? {} : { at: fleet.anchor }),
        ships: fleet.ships,
        owner: fleet.nation,
      },
    ];
  });

  const possessionCounts = new Map<AreaId, number>();
  for (const port of overlay.ports) {
    possessionCounts.set(port.area, (possessionCounts.get(port.area) ?? 0) + 1);
  }

  return {
    live: overlay.source === "campaign",
    playerNationId: overlay.playerNationId,
    campaignAreas: overlay.campaignAreas,
    control,
    ports,
    fleets,
    possessionCounts,
    unavailable: new Set(
      AREAS.filter((area) => !overlay.ownership.has(area.id)).map((area) => area.id),
    ),
    fillFor: (nation, alpha) =>
      nation === null
        ? UNCLAIMED_FILL(alpha)
        : `oklch(0.66 0.15 ${campaignNationHue(nation)} / ${alpha})`,
    strokeFor: (nation) =>
      nation === null ? UNCLAIMED_STROKE : `oklch(0.74 0.17 ${campaignNationHue(nation)})`,
    nameFor: (nation) => (nation === null ? "Unclaimed" : campaignNationLabel(nation)),
    summarise: (id) => {
      const geometry = AREAS_BY_ID.get(id);
      if (geometry === undefined) return null;
      const owner = overlay.ownership.get(id) ?? null;
      const ports = overlay.ports.filter((port) => port.area === id);
      const fleets = overlay.fleets.filter((fleet) => fleet.area === id);
      return {
        id,
        name: geometry.name,
        control: { owner, contested: false, possessions: 0 },
        possessions: ports.map((port) => ({ id: port.id, name: port.name, owner: port.nation })),
        fleets: fleets.map((fleet) => ({
          id: fleet.id,
          name: fleet.name,
          owner: fleet.nation,
          ships: fleet.ships,
        })),
        neighbours: (adjacent.get(id) ?? []).map((neighbour) => ({
          id: neighbour,
          name: AREAS_BY_ID.get(neighbour)?.name ?? neighbour,
        })),
      };
    },
  };
}
