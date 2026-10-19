import { presenceAreaIds } from "@bluewave/campaign";
import type { CampaignSnapshot } from "@bluewave/campaign";

/**
 * Full-world projection for the strategic map (F1 sheet). Unlike
 * `buildPlayerProjection` (projection.ts) — which flattens only the player
 * nation's slice — this exposes every nation, area, port, and fleet the
 * compiled `CampaignSnapshot` knows about, so the map can colour the whole
 * world from authoritative data rather than from a hard-coded fixture.
 *
 * Everything is a pure, deterministic derivation over the immutable snapshot
 * (same contract as `buildFleetScreenView` in fleet.ts): the desktop bridge
 * rebuilds it fresh on every `inspectMap` call and tests pin it against
 * fixture data.
 *
 * Deliberately flat and plain-object only: this crosses the Electron IPC
 * boundary and is JSON-rendered, so it carries no `Map`s and no `SafeInt`
 * wrappers — just numbers and strings the renderer can feed straight into
 * the join table.
 */

export interface WorldMapNationView {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  /** The nation's authoritative home area (S-5); null for a save that predates it. */
  readonly homeAreaId: string | null;
  /** The distinct areas of the possessions the nation currently owns, ordered by area id. */
  readonly presenceAreaIds: readonly string[];
}

export interface WorldMapAreaView {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly controller: string | null;
}

export interface WorldMapPortView {
  readonly id: string;
  readonly name: string;
  readonly areaId: string;
  readonly nationId: string;
  readonly level: number;
}

export interface WorldMapFleetView {
  readonly id: string;
  readonly nationId: string;
  readonly name: string;
  readonly areaId: string;
  readonly shipCount: number;
}

/** A compiled connection between two areas; the map draws the sea ones as lanes. */
export interface WorldMapRouteView {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly type: "land" | "sea" | "rail";
  readonly distance: number;
}

export interface WorldMapView {
  readonly nations: readonly WorldMapNationView[];
  readonly areas: readonly WorldMapAreaView[];
  readonly ports: readonly WorldMapPortView[];
  readonly fleets: readonly WorldMapFleetView[];
  /** Every compiled route, ordered by id: the campaign's own connectivity. */
  readonly routes: readonly WorldMapRouteView[];
}

/**
 * Builds the full world view from a real compiled `CampaignSnapshot`.
 * - `nations`: every nation in canonical id order (stable `id.localeCompare`).
 * - `areas`: every world area with its authored `controller` (unclaimed when
 *   undefined), ordered by id.
 * - `ports`: every port, `level` unwrapped from `SafeInt`, ordered by id.
 * - `fleets`: every fleet across every nation with its ship count, ordered by
 *   nation then fleet id.
 * - `routes`: every compiled route, `distance` unwrapped from `SafeInt`, ordered
 *   by id.
 */
export function buildWorldMapView(snapshot: CampaignSnapshot): WorldMapView {
  const nations: WorldMapNationView[] = [...snapshot.nations.values()]
    .map((nation) => ({
      id: nation.id,
      name: nation.name,
      tag: nation.tag,
      homeAreaId: nation.homeAreaId ?? null,
      presenceAreaIds: presenceAreaIds(snapshot.world.possessions ?? [], nation.id),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const areas: WorldMapAreaView[] = snapshot.world.areas
    .map((area) => ({
      id: area.id,
      name: area.name,
      type: area.type,
      controller: area.controller ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const ports: WorldMapPortView[] = snapshot.world.ports
    .map((port) => ({
      id: port.id,
      name: port.name,
      areaId: port.areaId,
      nationId: port.nationId,
      level: Number(port.level),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const fleets: WorldMapFleetView[] = [...snapshot.nations.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((nation) =>
      [...nation.fleets]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((fleet) => ({
          id: fleet.id,
          nationId: nation.id,
          name: fleet.name,
          areaId: fleet.locationAreaId,
          shipCount: fleet.ships.length,
        })),
    );

  const routes: WorldMapRouteView[] = snapshot.world.routes
    .map((route) => ({
      id: route.id,
      from: route.from,
      to: route.to,
      type: route.type,
      distance: Number(route.distance),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return { nations, areas, ports, fleets, routes };
}
