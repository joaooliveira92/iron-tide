import { useEffect, type MutableRefObject, type RefObject } from "react";

import type { CameraTransform } from "./useMapCamera.js";

export interface MapCameraGestureInput {
  readonly svgRef: RefObject<SVGSVGElement | null>;
  readonly isDraggingRef: MutableRefObject<boolean>;
  readonly touched: MutableRefObject<boolean>;
  readonly camera: MutableRefObject<CameraTransform>;
  readonly zoomAt: (factor: number, clientX: number, clientY: number) => void;
  readonly clamp: () => void;
  readonly applyTransform: () => void;
  readonly pixelsPerUnit: () => number;
  readonly resetFrameMeter: () => void;
  readonly sampleFrame: () => void;
}

export function useMapCameraGestures({
  svgRef,
  isDraggingRef,
  touched,
  camera,
  zoomAt,
  clamp,
  applyTransform,
  pixelsPerUnit,
  resetFrameMeter,
  sampleFrame,
}: MapCameraGestureInput): void {
  useEffect(() => {
    const svg = svgRef.current;
    if (svg === null) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
    }

    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest("[data-map-fleet]") !== null) return;
      pointerId = event.pointerId;
      isDraggingRef.current = false;
      lastX = event.clientX;
      lastY = event.clientY;
      resetFrameMeter();
      svg?.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
      if (pointerId !== event.pointerId) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (!isDraggingRef.current && Math.hypot(dx, dy) < 3) return;
      isDraggingRef.current = true;
      touched.current = true;
      lastX = event.clientX;
      lastY = event.clientY;
      const factor = pixelsPerUnit();
      camera.current.x += dx / factor;
      camera.current.y += dy / factor;
      clamp();
      applyTransform();
      sampleFrame();
    }

    function onPointerUp(event: PointerEvent) {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      svg?.releasePointerCapture(event.pointerId);
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 0);
    }

    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("pointerdown", onPointerDown, { passive: true });
    svg.addEventListener("pointermove", onPointerMove, { passive: true });
    svg.addEventListener("pointerup", onPointerUp, { passive: true });
    svg.addEventListener("pointercancel", onPointerUp, { passive: true });
    return () => {
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("pointercancel", onPointerUp);
    };
  }, [
    applyTransform,
    camera,
    clamp,
    isDraggingRef,
    pixelsPerUnit,
    resetFrameMeter,
    sampleFrame,
    svgRef,
    touched,
    zoomAt,
  ]);
}
