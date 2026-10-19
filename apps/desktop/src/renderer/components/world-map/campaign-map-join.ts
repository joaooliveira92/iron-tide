/**
 * JOIN — the bridge between the live campaign world and the map's fixture
 * geometry.
 *
 * The F1 map renders on top of `components/world-map/fixture-world.ts`'s
 * hand-authored 36-area geometry (the only polygons/coastlines/labels that
 * exist in the repo). The real `CampaignSnapshot` (`world.areas`, `world.ports`,
 * per-nation `fleets`) carries NO geographic coordinates — only ids and names.
 * So the campaign can't place itself; something has to say "campaign area
 * `sea_north_sea` sits on fixture area `area_north_sea`". That "something" is
 * now the authored presentation corpus's campaign-map join, compiled into the
 * artifact and served over the content IPC (`presentationContent.ts`); it is
 * intentionally an authored table, not a heuristic: heuristic matching of the
 * ~80 production-area ids onto the 36 prototype polygons is exactly the kind of
 * silent, version-dependent guesswork the repo's determinism rules forbid.
 *
 * The authored join is keyed by the campaign (content-pack) id:
 * - `campaignAreaToFixture`: campaign area id -> fixture area id, for ownership
 *   placement. Many campaign areas (one per coastal pocket) collapse onto one
 *   fixture polygon (a whole sea region), which is fine — the map draws at
 *   fixture granularity.
 * - `nationHue`: campaign nation id -> OKLCH hue, so every nation in the
 *   production pack (including ones the fixture never modelled) has a stable
 *   fill/stroke colour.
 * - `nationLabel`: campaign nation id -> display name.
 *
 * Unmapped campaign areas/fleets are dropped from the live layer (they have no
 * geometry to hang on); the campaign-derived overlay is then merged over the
 * fixture's own static data so the map still renders everywhere the fixture
 * had data even before a campaign references it.
 */

import type { WorldMapView } from "@bluewave/campaign-engine";
import { fixtureAreaId } from "../../content/presentationContent.js";
import { AREAS_BY_ID, type AreaId, type NationId } from "./fixture-world.js";

/** The live, campaign-derived overlay the map draws when a campaign is active. */
export interface LiveWorldMapOverlay {
  /** fixture area id -> owning nation (nullable unclaimed). */
  readonly ownership: ReadonlyMap<AreaId, NationId | null>;
  /** campaign ports placed on their mapped fixture area's label anchor. */
  readonly ports: readonly {
    readonly id: string;
    readonly name: string;
    readonly area: AreaId;
    readonly nation: NationId;
    readonly level: number;
  }[];
  /** campaign fleets placed on their mapped fixture area's label anchor. */
  readonly fleets: readonly {
    readonly id: string;
    readonly name: string;
    readonly area: AreaId;
    readonly nation: NationId;
    readonly ships: number;
  }[];
  /**
   * Every campaign area at its own (production-pack) granularity, with who controls it and the
   * fleets sitting in it. The map draws at fixture granularity; the area tree lists these.
   */
  readonly campaignAreas: readonly CampaignAreaEntry[];
  /**
   * The campaign's sea connectivity on fixture areas: one entry per connected pair (`a < b`), in
   * pair order. Null when no campaign is loaded, in which case the chart draws the fixture's own graph.
   */
  readonly lanes: readonly CampaignLane[] | null;
  /** The player's nation id, when the host has resolved it; the tree's Ships/Possessions key off it. */
  readonly playerNationId: string | null;
  readonly source: "campaign" | "none";
}

export interface CampaignLane {
  readonly a: AreaId;
  readonly b: AreaId;
}

export interface CampaignAreaEntry {
  readonly id: string;
  readonly name: string;
  readonly controller: string | null;
  readonly fleets: readonly { readonly nation: NationId; readonly ships: number }[];
}

/**
 * Builds the live overlay from a real `WorldMapView`. Areas/fleets whose
 * campaign id has no fixture mapping are dropped; areas the campaign doesn't
 * reference at all are left out of `ownership` so the caller can fall back to
 * the fixture's static data for them.
 */
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
    // Several campaign areas share one polygon (nothing to draw between them); an unmapped end has no place.
    if (from === null || to === null || from === to) continue;
    const [a, b] = from < to ? [from, to] : [to, from];
    pairs.set(`${a}~${b}`, { a, b });
  }
  const lanes = [...pairs.entries()]
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    .map(([, lane]) => lane);

  return {
    ownership,
    ports,
    fleets,
    campaignAreas,
    lanes,
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
  playerNationId: null,
  source: "none",
};

/** Lon/lat anchor for a fixture area (its hand-placed label), for placement. */
export function fixtureAnchor(area: AreaId): readonly [number, number] | null {
  return AREAS_BY_ID.get(area)?.label ?? null;
}

/**
 * The map point to centre the camera on when a nation's home waters should be
 * brought into view: the label anchor of the fixture polygon its home campaign
 * area is drawn on. Null when the area is unknown or has no geometry, so an
 * unmapped nation centres nowhere rather than guessing.
 */
export function homeFocusPoint(campaignAreaId: string | null): readonly [number, number] | null {
  if (campaignAreaId === null) return null;
  const fixture = fixtureAreaId(campaignAreaId);
  return fixture === null ? null : fixtureAnchor(fixture);
}
