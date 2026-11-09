import type { Map as MapLibreMap } from "maplibre-gl";
import { classifyHorizon, type GlobeCamera } from "../globe-spike/horizon.js";
import {
  adapterDrop,
  dragThresholdMet,
  fleetIdFromMarker,
  isDraggableFleet,
} from "./adapter-interaction.js";
import type { CameraProjection } from "./camera-contract.js";
import type { OverlayStore } from "./overlay-store.js";
import { selectPointerTarget } from "./pointer-visibility.js";
import type { MapInstanceRefs, MapInstanceSinks } from "./use-map-instance.js";

export interface MapPointerInput {
  readonly active: MapLibreMap;
  readonly store: OverlayStore;
  readonly refs: MapInstanceRefs;
  readonly sinks: MapInstanceSinks;
  readonly onSelect: (area: string | null) => void;
  readonly onRuler: (area: string) => void;
}

function cameraFromMap(map: MapLibreMap, projection: CameraProjection): GlobeCamera {
  const centre = map.getCenter();
  return {
    centre: [centre.lng, centre.lat],
    zoom: map.getZoom(),
    pitchDegrees: map.getPitch(),
    bearingDegrees: map.getBearing(),
    viewportHeightPx: map.getContainer().clientHeight,
    projection,
  } as GlobeCamera & { readonly projection: CameraProjection };
}

function horizonFor(map: MapLibreMap, lon: number, lat: number, projection: CameraProjection) {
  if (projection === "mercator") return "front" as const;
  return classifyHorizon(cameraFromMap(map, projection), [lon, lat]);
}

export function mapHealth(map: MapLibreMap): boolean {
  try {
    return map.getCanvas() !== null;
  } catch {
    return false;
  }
}

export function attachMapPointer({
  active,
  store,
  refs,
  sinks,
  onSelect,
  onRuler,
}: MapPointerInput): () => void {
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
        horizon: horizonFor(active, lon, lat, refs.projection.current),
      };
    });
    const target = selectPointerTarget(candidates);
    if (target !== null) {
      const hit = hits.find((feature) => String(feature.properties?.id) === target);
      const areaId = String(hit?.properties?.areaId ?? "");
      const markerId = String(hit?.properties?.id ?? "");
      const fleetId = fleetIdFromMarker(markerId);
      if (!shiftKey && fleetId !== null) {
        refs.orders.current?.onSelectFleet(fleetId);
        sinks.setSelectedFleet(fleetId);
        sinks.setLiveMessage(`Selected fleet ${String(hit?.properties?.name ?? fleetId)}`);
        return;
      }
      if (areaId.length > 0) {
        if (shiftKey) onRuler(areaId);
        else onSelect(areaId);
        sinks.setLiveMessage(
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
      sinks.setLiveMessage(`Route via ${refs.derived.current.areaName(areaId)}`);
    } else {
      onSelect(areaId);
      sinks.setLiveMessage(`Selected ${refs.derived.current.describeAreaFor(areaId)}`);
    }
  };
  const onClick = (event: {
    readonly point: { readonly x: number; readonly y: number };
    readonly originalEvent: MouseEvent;
  }) => {
    pick(event.point.x, event.point.y, event.originalEvent.shiftKey);
  };
  const onMove = (event: { readonly point: { readonly x: number; readonly y: number } }) => {
    if (refs.hoverFrame.current !== null) cancelAnimationFrame(refs.hoverFrame.current);
    refs.hoverFrame.current = requestAnimationFrame(() => {
      const markerHits = active.queryRenderedFeatures([event.point.x, event.point.y], {
        layers: ["adapter-markers"],
      });
      const markerId = markerHits.length === 0 ? null : String(markerHits[0]?.properties?.id ?? "");
      if (markerId !== refs.hovered.current) {
        refs.hovered.current = markerId;
        store.setHovered(markerId);
      }
      const areaHits = active.queryRenderedFeatures([event.point.x, event.point.y], {
        layers: ["areas-fill"],
      });
      const areaId = areaHits.length === 0 ? null : String(areaHits[0]?.properties?.id ?? "");
      if (areaId !== refs.hoveredArea.current) {
        refs.hoveredArea.current = areaId;
        sinks.setHoveredArea(areaId);
      }
      if (areaId === null) {
        sinks.setHoverTooltip(null);
      } else {
        sinks.setHoverTooltip({
          x: event.point.x,
          y: event.point.y,
          text: refs.derived.current.describeAreaFor(areaId),
        });
      }
      active.getCanvas().style.cursor =
        markerId === null ? (areaId === null ? "" : "crosshair") : "pointer";
    });
  };
  const onMouseOut = () => {
    refs.hovered.current = null;
    refs.hoveredArea.current = null;
    store.setHovered(null);
    sinks.setHoveredArea(null);
    sinks.setHoverTooltip(null);
  };
  const canvas = active.getCanvas();
  const pointOf = (event: PointerEvent): { readonly x: number; readonly y: number } => {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const onPointerDown = (event: PointerEvent) => {
    const currentOrders = refs.orders.current;
    if (currentOrders === undefined || event.button !== 0) return;
    const at = pointOf(event);
    const hits = active.queryRenderedFeatures([at.x, at.y], { layers: ["adapter-markers"] });
    const markerId = hits.length === 0 ? null : String(hits[0]?.properties?.id ?? "");
    const fleetId = fleetIdFromMarker(markerId);
    if (!isDraggableFleet(currentOrders, fleetId) || fleetId === null) return;
    active.dragPan.disable();
    canvas.setPointerCapture?.(event.pointerId);
    refs.drag.current = {
      fleetId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    currentOrders.onSelectFleet(fleetId);
    sinks.setSelectedFleet(fleetId);
  };
  const onPointerMove = (event: PointerEvent) => {
    const drag = refs.drag.current;
    if (drag === null || drag.pointerId !== event.pointerId || drag.dragging) return;
    if (
      dragThresholdMet({ x: drag.startX, y: drag.startY }, { x: event.clientX, y: event.clientY })
    ) {
      drag.dragging = true;
      canvas.style.cursor = "grabbing";
    }
  };
  const endDrag = (event: PointerEvent, drop: boolean) => {
    const drag = refs.drag.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    active.dragPan.enable();
    canvas.style.cursor = "";
    refs.drag.current = null;
    if (!drop || !drag.dragging) return;
    const at = pointOf(event);
    const areas = active.queryRenderedFeatures([at.x, at.y], { layers: ["areas-fill"] });
    const areaId = areas.length === 0 ? null : String(areas[0]?.properties?.id ?? "");
    const currentOrders = refs.orders.current;
    const resolution = adapterDrop(currentOrders, drag.fleetId, areaId);
    if (resolution.kind === "ignored") {
      sinks.setLiveMessage("That fleet destination is not available.");
      return;
    }
    currentOrders?.onDrop(drag.fleetId, areaId as string);
    sinks.setLiveMessage(
      `Ordered fleet to ${areaId === null ? "an area" : refs.derived.current.areaName(areaId)}`,
    );
  };
  const onPointerUp = (event: PointerEvent) => endDrag(event, true);
  const onPointerCancel = (event: PointerEvent) => endDrag(event, false);
  active.on("click", onClick);
  active.on("mousemove", onMove);
  active.on("mouseout", onMouseOut);
  canvas.addEventListener("pointerdown", onPointerDown, true);
  canvas.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
  canvas.addEventListener("pointerup", onPointerUp, true);
  canvas.addEventListener("pointercancel", onPointerCancel, true);
  return () => {
    active.off("click", onClick);
    active.off("mousemove", onMove);
    active.off("mouseout", onMouseOut);
    canvas.removeEventListener("pointerdown", onPointerDown, true);
    canvas.removeEventListener("pointermove", onPointerMove, true);
    canvas.removeEventListener("pointerup", onPointerUp, true);
    canvas.removeEventListener("pointercancel", onPointerCancel, true);
    if (refs.hoverFrame.current !== null) cancelAnimationFrame(refs.hoverFrame.current);
  };
}
