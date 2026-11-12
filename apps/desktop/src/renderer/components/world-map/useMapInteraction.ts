import { useCallback, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";

import {
  EMPTY_LIVE_OVERLAY,
  orderLonLatPath,
  type LiveWorldMapOverlay,
} from "./campaign-map-join.js";
import { areaAt } from "./map-area-at.js";
import { projectContinuousPath } from "./map-lanes.js";
import { orderModeMapAreas, pendingRoutes, type MapOrders } from "./map-orders.js";
import type { MapPrototypeState } from "./map-state.js";
import { projectPoint, type Projection } from "./projection.js";
import type { ProjectedPendingOrder } from "./scene/WorldMapScene.js";
import type { MapCamera } from "./useMapCamera.js";
import type { WorldMapModel } from "./useWorldMapModel.js";

const EMPTY_AREAS: ReadonlySet<string> = new Set();

interface PickUp {
  readonly fleetId: string;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly dragging: boolean;
}

export interface MapInteractionInput {
  readonly state: MapPrototypeState;
  readonly projection: Projection;
  readonly camera: MapCamera;
  readonly model: WorldMapModel;
  readonly overlay?: LiveWorldMapOverlay;
  readonly orders: MapOrders | undefined;
  readonly onSelect: (id: string | null) => void;
  readonly onRuler: (id: string) => void;
}

export interface MapInteraction {
  readonly activeFleetId: string | null;
  readonly legalAreas: ReadonlySet<string>;
  readonly dimmedAreas: ReadonlySet<string>;
  readonly blockadedAreas: ReadonlySet<string>;
  readonly pendingOrders: readonly ProjectedPendingOrder[];
  readonly draggableFleets: ReadonlySet<string>;
  readonly handleAreaClick: (id: string, shiftKey: boolean) => void;
  readonly handleMapKey: (event: KeyboardEvent<SVGSVGElement>) => void;
  readonly handlePointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  readonly handlePointerMove: (event: PointerEvent<SVGSVGElement>) => void;
  readonly handlePointerUp: (event: PointerEvent<SVGSVGElement>) => void;
  readonly focusArea: (id: string) => void;
}

export function useMapInteraction({
  state,
  projection,
  camera,
  model,
  overlay = EMPTY_LIVE_OVERLAY,
  orders,
  onSelect,
  onRuler,
}: MapInteractionInput): MapInteraction {
  const [pickUp, setPickUp] = useState<PickUp | null>(null);

  const activeFleetId = pickUp?.fleetId ?? orders?.selectedFleetId ?? null;
  const activeFleet = useMemo(
    () =>
      activeFleetId === null
        ? null
        : (orders?.fleets.find((fleet) => fleet.fleetId === activeFleetId) ?? null),
    [activeFleetId, orders?.fleets],
  );
  const mode = useMemo(() => orderModeMapAreas(activeFleet), [activeFleet]);
  const modeActive = pickUp !== null || (orders !== undefined && orders.selectedFleetId !== null);
  const legalAreas = modeActive ? mode.legal : EMPTY_AREAS;
  const homeAreaId = activeFleet?.mapAreaId ?? null;
  const dimmedAreas = useMemo(() => {
    if (!modeActive || !mode.active) return EMPTY_AREAS;
    const keep = new Set(mode.legal);
    if (homeAreaId !== null) keep.add(homeAreaId);
    const dimmed = new Set<string>();
    for (const area of model.areas) {
      if (!keep.has(area.id)) dimmed.add(area.id);
    }
    return dimmed;
  }, [homeAreaId, mode, model.areas, modeActive]);
  const blockadedAreas = orders?.blockadedMapAreas ?? EMPTY_AREAS;
  const pendingOrders = useMemo(
    () =>
      pendingRoutes(orders?.pending ?? [], model.anchorOf, (order) => {
        const path = orderLonLatPath(overlay, order);
        return path === null
          ? null
          : projectContinuousPath(
              path,
              (lonLat) => projectPoint(lonLat, projection, state.centre),
              projection.width,
            );
      }),
    [model.anchorOf, orders?.pending, overlay, projection, state.centre],
  );
  const draggableFleets = useMemo(
    () =>
      new Set(
        (orders?.fleets ?? [])
          .filter((fleet) => fleet.mapAreaId !== null && fleet.legalDestinations.length > 0)
          .map((fleet) => fleet.fleetId),
      ),
    [orders?.fleets],
  );

  function handleMapKey(event: KeyboardEvent<SVGSVGElement>): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (orders !== undefined && (event.key === "f" || event.key === "F")) {
      const fleets = orders.fleets;
      if (fleets.length > 0) {
        const current = fleets.findIndex((fleet) => fleet.fleetId === orders.selectedFleetId);
        const next = fleets[(current + 1) % fleets.length];
        if (next !== undefined) {
          orders.onSelectFleet(next.fleetId);
          const point = next.mapAreaId === null ? null : model.areasById.get(next.mapAreaId)?.label;
          if (point !== null && point !== undefined) camera.focusOn(point[0], point[1], 3.5);
        }
      }
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      setPickUp(null);
      onSelect(null);
      event.preventDefault();
      return;
    }
    const step = event.shiftKey ? 240 : 80;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (move !== undefined) camera.panBy(move[0], move[1]);
    else if (event.key === "+" || event.key === "=") camera.zoomBy(1.4);
    else if (event.key === "-" || event.key === "_") camera.zoomBy(1 / 1.4);
    else if (event.key === "0") camera.reset();
    else return;
    event.preventDefault();
  }

  const handleAreaClick = useCallback(
    (id: string, shiftKey: boolean) => {
      if (camera.isDraggingRef.current) return;
      if (shiftKey) onRuler(id);
      else onSelect(id);
    },
    [camera.isDraggingRef, onRuler, onSelect],
  );

  function handlePointerDown(event: PointerEvent<SVGSVGElement>): void {
    if (orders === undefined || event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const marker = target.closest("[data-map-fleet]");
    if (!(marker instanceof Element)) return;
    const fleetId = marker.getAttribute("data-map-fleet");
    if (fleetId === null || !draggableFleets.has(fleetId)) return;
    event.stopPropagation();
    camera.holdRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPickUp({
      fleetId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    });
    orders.onSelectFleet(fleetId);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>): void {
    if (pickUp === null || pickUp.pointerId !== event.pointerId) return;
    if (pickUp.dragging) return;
    if (Math.hypot(event.clientX - pickUp.startX, event.clientY - pickUp.startY) < 6) return;
    setPickUp({ ...pickUp, dragging: true });
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>): void {
    if (pickUp === null || pickUp.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const dragging = pickUp.dragging;
    const fleetId = pickUp.fleetId;
    camera.holdRef.current = false;
    setPickUp(null);
    if (!dragging || orders === undefined) return;
    const mapAreaId = areaAt(camera, model.areas, projection, event.clientX, event.clientY);
    if (mapAreaId === null) return;
    orders.onDrop(fleetId, mapAreaId);
  }

  function focusArea(id: string): void {
    onSelect(id);
    const point = model.areasById.get(id)?.label;
    if (point !== undefined) camera.focusOn(point[0], point[1], 3.5);
  }

  return {
    activeFleetId,
    legalAreas,
    dimmedAreas,
    blockadedAreas,
    pendingOrders,
    draggableFleets,
    handleAreaClick,
    handleMapKey,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    focusArea,
  };
}
