import { presenceAreaIds } from "@bluewave/campaign";
import type { CampaignSnapshot } from "@bluewave/campaign";
import { compareCodePoints } from "@bluewave/deterministic";

export interface WorldMapNationView {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly homeAreaId: string | null;
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
  readonly routes: readonly WorldMapRouteView[];
}

export function buildWorldMapView(snapshot: CampaignSnapshot): WorldMapView {
  const nations: WorldMapNationView[] = [...snapshot.nations.values()]
    .map((nation) => ({
      id: nation.id,
      name: nation.name,
      tag: nation.tag,
      homeAreaId: nation.homeAreaId ?? null,
      presenceAreaIds: presenceAreaIds(snapshot.world.possessions ?? [], nation.id),
    }))
    .sort((a, b) => compareCodePoints(a.id, b.id));

  const areas: WorldMapAreaView[] = snapshot.world.areas
    .map((area) => ({
      id: area.id,
      name: area.name,
      type: area.type,
      controller: area.controller ?? null,
    }))
    .sort((a, b) => compareCodePoints(a.id, b.id));

  const ports: WorldMapPortView[] = snapshot.world.ports
    .map((port) => ({
      id: port.id,
      name: port.name,
      areaId: port.areaId,
      nationId: port.nationId,
      level: Number(port.level),
    }))
    .sort((a, b) => compareCodePoints(a.id, b.id));

  const fleets: WorldMapFleetView[] = [...snapshot.nations.values()]
    .sort((a, b) => compareCodePoints(a.id, b.id))
    .flatMap((nation) =>
      [...nation.fleets]
        .sort((a, b) => compareCodePoints(a.id, b.id))
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
    .sort((a, b) => compareCodePoints(a.id, b.id));

  return { nations, areas, ports, fleets, routes };
}
