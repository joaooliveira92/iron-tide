/**
 * The world map's data source: the one abstraction the view model depends on.
 *
 * The chart can draw two worlds — the hand-authored fixture and a live campaign
 * overlay merged over it. Historically that choice was re-tested
 * (`overlay.source === "campaign"`) in every deriver of `useWorldMapModel`,
 * so a third source meant editing all of them. Here each source is a strategy
 * that resolves ownership, ports, fleets, possession counts, area summaries and
 * nation identity once; `useWorldMapModel` consumes the interface and never
 * learns which world it is drawing.
 */

import {
  FLEETS,
  POSSESSIONS,
  type AreaControl,
  type AreaId,
  type NationId,
} from "./fixture-world.js";
import {
  areaControl,
  nationFill,
  nationName,
  nationStroke,
  summariseArea,
  type AreaSummary,
} from "./map-state.js";
import type { FleetPlacement, PossessionPlacement } from "./map-markers.js";
import { campaignNationHue, campaignNationLabel } from "../../content/presentationContent.js";
import {
  fixtureAnchor,
  type CampaignAreaEntry,
  type LiveWorldMapOverlay,
} from "./campaign-map-join.js";

/** Everything the model needs to draw and describe a world, source-agnostically. */
export interface WorldMapSource {
  /** True when the source is a live campaign rather than the static fixture. */
  readonly live: boolean;
  readonly playerNationId: string | null;
  /** Campaign-granularity areas for the tree, or null when the fixture is drawn. */
  readonly campaignAreas: readonly CampaignAreaEntry[] | null;
  /** fixture area id -> controlling nation (null = unclaimed). */
  readonly control: ReadonlyMap<AreaId, AreaControl>;
  /** Possessions to draw, already anchored to a fixture area's label. */
  readonly ports: readonly PossessionPlacement[];
  /** Fleets to draw, already anchored to a fixture area. */
  readonly fleets: readonly FleetPlacement[];
  /** Possessions per fixture area, for the area list's lens and badges. */
  readonly possessionCounts: ReadonlyMap<AreaId, number>;
  fillFor(nation: NationId | null, alpha: number): string;
  strokeFor(nation: NationId | null): string;
  nameFor(nation: NationId | null): string;
  summarise(areaId: AreaId): AreaSummary | null;
}

const UNCLAIMED_FILL = (alpha: number): string => `oklch(0.55 0 0 / ${alpha * 0.35})`;
const UNCLAIMED_STROKE = "oklch(0.6 0 0 / 0.5)";

function fixturePorts(): PossessionPlacement[] {
  return POSSESSIONS.map((possession) => ({
    id: possession.id,
    name: possession.name,
    at: possession.at,
    owner: possession.owner,
    base: possession.base,
  }));
}

function fixtureFleets(): FleetPlacement[] {
  return FLEETS.map((fleet) => ({
    id: fleet.id,
    area: fleet.area,
    ships: fleet.ships,
    owner: fleet.owner,
  }));
}

/** The static prototype fixture: owns its own geometry and nation ramp. */
export function fixtureWorldMapSource(): WorldMapSource {
  const control = areaControl();
  const possessionCounts = new Map<AreaId, number>();
  for (const [id, held] of control) possessionCounts.set(id, held.possessions);

  return {
    live: false,
    playerNationId: null,
    campaignAreas: null,
    control,
    ports: fixturePorts(),
    fleets: fixtureFleets(),
    possessionCounts,
    fillFor: nationFill,
    strokeFor: nationStroke,
    nameFor: nationName,
    summarise: summariseArea,
  };
}

/**
 * A live campaign merged over the fixture: ownership and nation identity come
 * from the overlay, areas the campaign never mentions fall back to the fixture.
 */
export function campaignWorldMapSource(overlay: LiveWorldMapOverlay): WorldMapSource {
  const control = new Map<AreaId, AreaControl>(areaControl());
  for (const [area, owner] of overlay.ownership) {
    control.set(area, { owner, contested: false, possessions: 0 });
  }

  const ports = overlay.ports.flatMap<PossessionPlacement>((port) => {
    const at = fixtureAnchor(port.area);
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
    live: true,
    playerNationId: overlay.playerNationId,
    campaignAreas: overlay.campaignAreas,
    control,
    ports,
    fleets,
    possessionCounts,
    fillFor: (nation, alpha) =>
      nation === null
        ? UNCLAIMED_FILL(alpha)
        : `oklch(0.66 0.15 ${campaignNationHue(nation)} / ${alpha})`,
    strokeFor: (nation) =>
      nation === null ? UNCLAIMED_STROKE : `oklch(0.74 0.17 ${campaignNationHue(nation)})`,
    nameFor: (nation) => (nation === null ? "Unclaimed" : campaignNationLabel(nation)),
    summarise: (id) => {
      const fixture = summariseArea(id);
      if (fixture === null) return null;
      const owner = overlay.ownership.get(id) ?? null;
      const ports = overlay.ports.filter((port) => port.area === id);
      const fleets = overlay.fleets.filter((fleet) => fleet.area === id);
      return {
        id,
        name: fixture.name,
        control: { owner, contested: false, possessions: 0 },
        possessions: ports.map((port) => ({ id: port.id, name: port.name, owner: port.nation })),
        fleets: fleets.map((fleet) => ({
          id: fleet.id,
          name: fleet.name,
          owner: fleet.nation,
          ships: fleet.ships,
        })),
        neighbours: fixture.neighbours,
      };
    },
  };
}
