import { fleetMoveProblem, type CampaignSnapshot, type FleetMoveProblem } from "@bluewave/campaign";
import { buildWorldMapView, type WorldMapView } from "./world-map.js";

export interface StrategicMapBlockedReason {
  readonly code: Extract<
    FleetMoveProblem["code"],
    "FOREIGN_STATION_ASSIGNED" | "SHIP_NOT_OPERATIONAL" | "SHIP_UNAVAILABLE"
  >;
  readonly message: string;
}

export interface StrategicMapFleetOrdersView {
  readonly fleetId: string;
  readonly fleetName: string;
  readonly areaId: string;
  readonly shipCount: number;
  readonly legalDestinations: readonly string[];
  readonly blockedReason: StrategicMapBlockedReason | null;
}

export interface StrategicMapBlockadeView {
  readonly blockaderId: string;
  readonly blockadedNationId: string;
  readonly areaId: string;
  readonly establishedMonth: string;
}

export interface StrategicMapView {
  readonly world: WorldMapView;
  readonly playerFleets: readonly StrategicMapFleetOrdersView[];
  readonly blockades: readonly StrategicMapBlockadeView[];
}

const FLEET_LEVEL_CODES = [
  "FOREIGN_STATION_ASSIGNED",
  "SHIP_NOT_OPERATIONAL",
  "SHIP_UNAVAILABLE",
] as const;

function isFleetLevelCode(
  code: FleetMoveProblem["code"],
): code is (typeof FLEET_LEVEL_CODES)[number] {
  return (FLEET_LEVEL_CODES as readonly string[]).includes(code);
}

export function buildStrategicMapView(
  snapshot: CampaignSnapshot,
  viewerNationId: string,
): StrategicMapView {
  const world = buildWorldMapView(snapshot);
  const ownWorld: WorldMapView = {
    ...world,
    fleets: world.fleets.filter((fleet) => fleet.nationId === viewerNationId),
  };

  const areaById = new Map(snapshot.world.areas.map((area) => [area.id, area]));
  const playerFleets = (snapshot.nations.get(viewerNationId)?.fleets ?? [])
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((fleet) => {
      const candidates = [
        ...new Set(
          snapshot.world.routes
            .filter((route) => route.type === "sea")
            .flatMap((route) => {
              if (route.from === fleet.locationAreaId) return [route.to];
              if (route.to === fleet.locationAreaId) return [route.from];
              return [];
            }),
        ),
      ]
        .filter((areaId) => areaId !== fleet.locationAreaId)
        .filter((areaId) => areaById.get(areaId)?.type !== "land")
        .sort((a, b) => a.localeCompare(b));

      const legalDestinations = candidates.filter(
        (areaId) => fleetMoveProblem(snapshot, viewerNationId, fleet.id, areaId) === null,
      );

      let blockedReason: StrategicMapBlockedReason | null = null;
      if (legalDestinations.length === 0) {
        const probe = fleetMoveProblem(
          snapshot,
          viewerNationId,
          fleet.id,
          candidates[0] ?? fleet.locationAreaId,
        );
        if (probe !== null && isFleetLevelCode(probe.code)) {
          blockedReason = { code: probe.code, message: probe.message };
        }
      }

      return {
        fleetId: fleet.id,
        fleetName: fleet.name,
        areaId: fleet.locationAreaId,
        shipCount: fleet.ships.length,
        legalDestinations,
        blockedReason,
      };
    });

  const blockades = snapshot.wars.blockadeState
    .filter(
      (blockade) =>
        blockade.blockaderId === viewerNationId || blockade.blockadedNationId === viewerNationId,
    )
    .map((blockade) => ({
      blockaderId: blockade.blockaderId,
      blockadedNationId: blockade.blockadedNationId,
      areaId: blockade.areaId,
      establishedMonth: blockade.establishedMonth,
    }))
    .sort(
      (a, b) =>
        a.areaId.localeCompare(b.areaId) ||
        a.blockadedNationId.localeCompare(b.blockadedNationId) ||
        a.blockaderId.localeCompare(b.blockaderId),
    );

  return { world: ownWorld, playerFleets, blockades };
}
