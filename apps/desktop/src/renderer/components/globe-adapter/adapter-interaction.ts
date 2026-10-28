import type { RouteReading } from "../world-map/map-state.js";
import { resolveDrop, type DropResolution, type MapOrders } from "../world-map/map-orders.js";

export const FLEET_DRAG_THRESHOLD_PX = 6;

export function fleetIdFromMarker(markerId: string | null | undefined): string | null {
  if (markerId === null || markerId === undefined) return null;
  return markerId.startsWith("fleet:") ? markerId.slice("fleet:".length) : null;
}

export function isDraggableFleet(orders: MapOrders | undefined, fleetId: string | null): boolean {
  if (orders === undefined || fleetId === null) return false;
  const fleet = orders.fleets.find((candidate) => candidate.fleetId === fleetId);
  return fleet !== undefined && fleet.mapAreaId !== null && fleet.legalDestinations.length > 0;
}

export function dragThresholdMet(
  start: { readonly x: number; readonly y: number },
  current: { readonly x: number; readonly y: number },
  threshold: number = FLEET_DRAG_THRESHOLD_PX,
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= threshold;
}

export function adapterDrop(
  orders: MapOrders | undefined,
  fleetId: string,
  mapAreaId: string | null,
): DropResolution {
  if (orders === undefined) return { kind: "ignored" };
  const fleet = orders.fleets.find((candidate) => candidate.fleetId === fleetId);
  return resolveDrop(fleet, mapAreaId);
}

export function routeAnnouncement(route: RouteReading | null): string {
  if (route === null) return "No route reading. Shift-click two areas to read a route.";
  return `Route reading: ${route.hops} hops, ${route.nauticalMiles} nautical miles, ${route.perHop} nautical miles per hop, about ${route.months} months.`;
}
