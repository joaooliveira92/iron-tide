import type { Map as MapLibreMap } from "maplibre-gl";

import type { deriveAdapterModel } from "./adapter-derivations.js";
import {
  adapterDrop,
  dragThresholdMet,
  fleetIdFromMarker,
  isDraggableFleet,
} from "./adapter-interaction.js";
import type { CameraProjection } from "./camera-contract.js";
import { horizonFor } from "./map-camera.js";
import type { OverlayStore } from "./overlay-store.js";
import { selectPointerTarget } from "./pointer-visibility.js";
import type { GlobeAdapterProps } from "./globe-adapter-types.js";

export interface HoverTooltip {
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

export interface MapInteractionContext {
  readonly active: MapLibreMap;
  readonly store: OverlayStore;
  readonly projectionRef: { readonly current: CameraProjection };
  readonly ordersRef: { readonly current: GlobeAdapterProps["orders"] };
  readonly derivedRef: { readonly current: ReturnType<typeof deriveAdapterModel> };
  readonly onSelect: GlobeAdapterProps["onSelect"];
  readonly onRuler: GlobeAdapterProps["onRuler"];
  readonly setSelectedFleet: (fleetId: string | null) => void;
  readonly setLiveMessage: (message: string) => void;
  readonly setHoveredArea: (areaId: string | null) => void;
  readonly setHoverTooltip: (tooltip: HoverTooltip | null) => void;
}

export function createMapInteractions({
  active,
  store,
  projectionRef,
  ordersRef,
  derivedRef,
  onSelect,
  onRuler,
  setSelectedFleet,
  setLiveMessage,
  setHoveredArea,
  setHoverTooltip,
}: MapInteractionContext) {
  let hoverFrame: number | null = null;
  let hovered: string | null = null;
  let hoveredArea: string | null = null;
  let dragState: {
    readonly fleetId: string;
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    dragging: boolean;
  } | null = null;

  const pick = (x: number, y: number, shiftKey: boolean) => {
    const hits = active.queryRenderedFeatures([x, y], { layers: ["adapter-markers"] });
    const candidates = hits.map((feature) => {
      const properties = feature.properties ?? {};
      const lon = Number(properties.lon);
      const lat = Number(properties.lat);
      return {
        id: String(properties.id ?? ""),
        rendered: true,
        projectVisible: true,
        horizon: horizonFor(active, lon, lat, projectionRef.current),
      };
    });
    const target = selectPointerTarget(candidates);
    if (target !== null) {
      const hit = hits.find((feature) => String(feature.properties?.id) === target);
      const areaId = String(hit?.properties?.areaId ?? "");
      const markerId = String(hit?.properties?.id ?? "");
      const fleetId = fleetIdFromMarker(markerId);
      if (!shiftKey && fleetId !== null) {
        ordersRef.current?.onSelectFleet(fleetId);
        setSelectedFleet(fleetId);
        setLiveMessage(`Selected fleet ${String(hit?.properties?.name ?? fleetId)}`);
        return;
      }
      if (areaId.length > 0) {
        if (shiftKey) onRuler(areaId);
        else onSelect(areaId);
        setLiveMessage(
          `${shiftKey ? "Route from " : "Selected "}${String(hit?.properties?.name ?? areaId)}`,
        );
      }
      return;
    }
    const areas = active.queryRenderedFeatures([x, y], { layers: ["areas-fill"] });
    const areaId = areas.length === 0 ? null : String(areas[0]?.properties?.id ?? "");
    if (areaId === null || areaId.length === 0) {
      if (!shiftKey) onSelect(null);
      return;
    }
    if (shiftKey) {
      onRuler(areaId);
      setLiveMessage(`Route via ${derivedRef.current.areaName(areaId)}`);
    } else {
      onSelect(areaId);
      setLiveMessage(`Selected ${derivedRef.current.describeAreaFor(areaId)}`);
    }
  };
  const onClick = (event: {
    readonly point: { readonly x: number; readonly y: number };
    readonly originalEvent: MouseEvent;
  }) => {
    pick(event.point.x, event.point.y, event.originalEvent.shiftKey);
  };
  const onMove = (event: { readonly point: { readonly x: number; readonly y: number } }) => {
    if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
    hoverFrame = requestAnimationFrame(() => {
      const markerHits = active.queryRenderedFeatures([event.point.x, event.point.y], {
        layers: ["adapter-markers"],
      });
      const markerId = markerHits.length === 0 ? null : String(markerHits[0]?.properties?.id ?? "");
      if (markerId !== hovered) {
        hovered = markerId;
        store.setHovered(markerId);
      }
      const areaHits = active.queryRenderedFeatures([event.point.x, event.point.y], {
        layers: ["areas-fill"],
      });
      const areaId = areaHits.length === 0 ? null : String(areaHits[0]?.properties?.id ?? "");
      if (areaId !== hoveredArea) {
        hoveredArea = areaId;
        setHoveredArea(areaId);
      }
      if (areaId === null) {
        setHoverTooltip(null);
      } else {
        setHoverTooltip({
          x: event.point.x,
          y: event.point.y,
          text: derivedRef.current.describeAreaFor(areaId),
        });
      }
      active.getCanvas().style.cursor =
        markerId === null ? (areaId === null ? "" : "crosshair") : "pointer";
    });
  };
  const onMouseOut = () => {
    hovered = null;
    hoveredArea = null;
    store.setHovered(null);
    setHoveredArea(null);
    setHoverTooltip(null);
  };
  const canvas = active.getCanvas();
  const pointOf = (event: PointerEvent): { readonly x: number; readonly y: number } => {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const onPointerDown = (event: PointerEvent) => {
    const currentOrders = ordersRef.current;
    if (currentOrders === undefined || event.button !== 0) return;
    const at = pointOf(event);
    const hits = active.queryRenderedFeatures([at.x, at.y], { layers: ["adapter-markers"] });
    const markerId = hits.length === 0 ? null : String(hits[0]?.properties?.id ?? "");
    const fleetId = fleetIdFromMarker(markerId);
    if (!isDraggableFleet(currentOrders, fleetId) || fleetId === null) return;
    active.dragPan.disable();
    canvas.setPointerCapture?.(event.pointerId);
    dragState = {
      fleetId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    currentOrders.onSelectFleet(fleetId);
    setSelectedFleet(fleetId);
  };
  const onPointerMove = (event: PointerEvent) => {
    const drag = dragState;
    if (drag === null || drag.pointerId !== event.pointerId || drag.dragging) return;
    if (
      dragThresholdMet({ x: drag.startX, y: drag.startY }, { x: event.clientX, y: event.clientY })
    ) {
      drag.dragging = true;
      canvas.style.cursor = "grabbing";
    }
  };
  const endDrag = (event: PointerEvent, drop: boolean) => {
    const drag = dragState;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    active.dragPan.enable();
    canvas.style.cursor = "";
    dragState = null;
    if (!drop || !drag.dragging) return;
    const at = pointOf(event);
    const areas = active.queryRenderedFeatures([at.x, at.y], { layers: ["areas-fill"] });
    const areaId = areas.length === 0 ? null : String(areas[0]?.properties?.id ?? "");
    const currentOrders = ordersRef.current;
    const resolution = adapterDrop(currentOrders, drag.fleetId, areaId);
    if (resolution.kind === "ignored") {
      setLiveMessage("That fleet destination is not available.");
      return;
    }
    currentOrders?.onDrop(drag.fleetId, areaId as string);
    setLiveMessage(
      `Ordered fleet to ${areaId === null ? "an area" : derivedRef.current.areaName(areaId)}`,
    );
  };
  const onPointerUp = (event: PointerEvent) => endDrag(event, true);
  const onPointerCancel = (event: PointerEvent) => endDrag(event, false);

  return {
    onClick,
    onMove,
    onMouseOut,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    dispose: () => {
      if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
    },
  };
}
