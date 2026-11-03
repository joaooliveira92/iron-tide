import type { MovementCommand, StrategicMapView } from "@bluewave/campaign-engine";
import { fixtureAreaId } from "../../content/presentationContent.js";
import type { MapOrderFleet, MapPendingOrder } from "../../components/world-map/map-orders.js";

export function orderFleets(
  strategic: StrategicMapView | null,
  areaNames: ReadonlyMap<string, string>,
): readonly MapOrderFleet[] {
  if (strategic === null) return [];
  return strategic.playerFleets.map((fleet) => ({
    fleetId: fleet.fleetId,
    fleetName: fleet.fleetName,
    areaId: fleet.areaId,
    mapAreaId: fixtureAreaId(fleet.areaId),
    areaName: areaNames.get(fleet.areaId) ?? fleet.areaId,
    shipCount: fleet.shipCount,
    legalDestinations: fleet.legalDestinations.flatMap((areaId) => {
      const mapAreaId = fixtureAreaId(areaId);
      if (mapAreaId === null) return [];
      return [{ areaId, mapAreaId, name: areaNames.get(areaId) ?? areaId }];
    }),
    blockedReason: fleet.blockedReason,
  }));
}

export function blockadedMapAreas(strategic: StrategicMapView | null): ReadonlySet<string> {
  const areas = new Set<string>();
  for (const blockade of strategic?.blockades ?? []) {
    const mapAreaId = fixtureAreaId(blockade.areaId);
    if (mapAreaId !== null) areas.add(mapAreaId);
  }
  return areas;
}

export function pendingOrders(
  commands: readonly MovementCommand[],
  fleets: readonly MapOrderFleet[],
): readonly MapPendingOrder[] {
  const fleetById = new Map(fleets.map((fleet) => [fleet.fleetId, fleet]));
  const areaName = new Map<string, string>();
  for (const fleet of fleets) {
    areaName.set(fleet.areaId, fleet.areaName);
    for (const destination of fleet.legalDestinations) {
      areaName.set(destination.areaId, destination.name);
    }
  }
  return commands.flatMap((command) => {
    if (command.status !== "submitted") return [];
    const fleet = fleetById.get(command.divisionId);
    const fromMapAreaId = fixtureAreaId(command.fromAreaId);
    const toMapAreaId = fixtureAreaId(command.toAreaId);
    if (fleet === undefined || fromMapAreaId === null || toMapAreaId === null) return [];
    return [
      {
        commandId: command.commandId,
        fleetId: command.divisionId,
        fromMapAreaId,
        toMapAreaId,
        fromAreaId: command.fromAreaId,
        toAreaId: command.toAreaId,
        destinationName: areaName.get(command.toAreaId) ?? command.toAreaId,
      },
    ];
  });
}
