import type { StrategicMapBlockedReason } from "@bluewave/campaign-engine";

export interface MapOrderDestination {
  readonly areaId: string;
  readonly mapAreaId: string;
  readonly name: string;
}

export interface MapOrderFleet {
  readonly fleetId: string;
  readonly fleetName: string;
  readonly areaId: string;
  readonly mapAreaId: string | null;
  readonly areaName: string;
  readonly shipCount: number;
  readonly legalDestinations: readonly MapOrderDestination[];
  readonly blockedReason: StrategicMapBlockedReason | null;
}

export interface MapPendingOrder {
  readonly commandId: string;
  readonly fleetId: string;
  readonly fromMapAreaId: string;
  readonly toMapAreaId: string;
  readonly fromAreaId?: string;
  readonly toAreaId?: string;
  readonly destinationName: string;
}

export interface MapOrders {
  readonly fleets: readonly MapOrderFleet[];
  readonly pending: readonly MapPendingOrder[];
  readonly blockadedMapAreas: ReadonlySet<string>;
  readonly selectedFleetId: string | null;
  readonly onSelectFleet: (fleetId: string) => void;
  readonly onDrop: (fleetId: string, mapAreaId: string) => void;
}

export type DropResolution =
  | { readonly kind: "ignored" }
  | { readonly kind: "order"; readonly destination: MapOrderDestination }
  | { readonly kind: "choose"; readonly destinations: readonly MapOrderDestination[] };

export function resolveDrop(
  fleet: MapOrderFleet | null | undefined,
  mapAreaId: string | null,
): DropResolution {
  if (fleet === null || fleet === undefined || mapAreaId === null) return { kind: "ignored" };
  if (fleet.mapAreaId === mapAreaId) return { kind: "ignored" };
  const destinations = fleet.legalDestinations.filter(
    (destination) => destination.mapAreaId === mapAreaId,
  );
  if (destinations.length === 0) return { kind: "ignored" };
  if (destinations.length === 1) {
    const [destination] = destinations;
    if (destination === undefined) return { kind: "ignored" };
    return { kind: "order", destination };
  }
  return { kind: "choose", destinations };
}

export function legalMapAreas(fleets: readonly MapOrderFleet[]): ReadonlySet<string> {
  const areas = new Set<string>();
  for (const fleet of fleets) {
    for (const destination of fleet.legalDestinations) areas.add(destination.mapAreaId);
  }
  return areas;
}

export interface OrderModeAreas {
  readonly active: boolean;
  readonly legal: ReadonlySet<string>;
}

export function orderModeMapAreas(fleet: MapOrderFleet | null | undefined): OrderModeAreas {
  if (fleet === null || fleet === undefined || fleet.mapAreaId === null) {
    return { active: false, legal: new Set() };
  }
  const legal = new Set(fleet.legalDestinations.map((destination) => destination.mapAreaId));
  return { active: legal.size > 0, legal };
}

export function pendingForFleet(
  pending: readonly MapPendingOrder[],
  fleetId: string | null,
): MapPendingOrder | null {
  if (fleetId === null) return null;
  return pending.find((order) => order.fleetId === fleetId) ?? null;
}

export function pendingRoutes(
  orders: readonly MapPendingOrder[],
  anchorOf: (mapAreaId: string) => readonly [number, number] | undefined,
  pathOf?: (order: MapPendingOrder) => readonly (readonly [number, number])[] | null,
): readonly (MapPendingOrder & {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly via?: readonly (readonly [number, number])[];
})[] {
  return orders.flatMap((order) => {
    const path = pathOf?.(order) ?? null;
    if (path !== null && path.length >= 2) {
      const first = path[0] as readonly [number, number];
      const last = path[path.length - 1] as readonly [number, number];
      return [{ ...order, from: first, to: last, via: path.slice(1, -1) }];
    }
    const from = anchorOf(order.fromMapAreaId);
    const to = anchorOf(order.toMapAreaId);
    if (from === undefined || to === undefined) return [];
    return [{ ...order, from, to }];
  });
}
