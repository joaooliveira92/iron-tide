import { useCallback, useEffect, useRef, useState } from "react";

import { useFrameMeter } from "./useFrameMeter.js";

export interface CameraTransform {
  scale: number;
  x: number;
  y: number;
}

export const ZOOM_BANDS = [1.8, 4] as const;

export type ZoomBand = 0 | 1 | 2;

function bandFor(scale: number): ZoomBand {
  if (scale < ZOOM_BANDS[0]) return 0;
  if (scale < ZOOM_BANDS[1]) return 1;
  return 2;
}

const MIN_SCALE = 0.9;
const MAX_SCALE = 60;

export interface CameraView {
  readonly transform: Readonly<CameraTransform>;
  readonly scale: number;
  readonly pixelsPerUnit: number;
  readonly minScale: number;
  readonly wrapping: boolean;
  readonly svgHeight: number;
  readonly zoomBand: ZoomBand;
}

export interface MapCamera {
  readonly svgRef: React.RefObject<SVGSVGElement | null>;
  readonly worldRef: React.RefObject<SVGGElement | null>;
  readonly meterRef: React.RefObject<HTMLSpanElement | null>;
  readonly zoomBand: ZoomBand;
  readonly reset: () => void;
  readonly zoomBy: (factor: number) => void;
  readonly panBy: (dxPixels: number, dyPixels: number) => void;
  readonly getPixelsPerUnit: () => number;
  readonly focusOn: (x: number, y: number, scale?: number) => void;
  readonly isDraggingRef: React.RefObject<boolean>;
  readonly holdRef: React.RefObject<boolean>;
  readonly isWrapping: () => boolean;
  readonly getMinScale: () => number;
  readonly getViewport: () => Viewport;
  readonly getTransform: () => Readonly<CameraTransform>;
  readonly getView: () => CameraView;
  readonly subscribe: (listener: (transform: Readonly<CameraTransform>) => void) => () => void;
}

export interface Viewport {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface CameraOptions {
  readonly wrapHorizontally: boolean;
  readonly coverViewport?: boolean;
}

export function useMapCamera(
  worldWidth: number,
  worldHeight: number,
  options: CameraOptions = { wrapHorizontally: true },
): MapCamera {
  const { wrapHorizontally, coverViewport = false } = options;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const worldRef = useRef<SVGGElement | null>(null);
  const meterRef = useRef<HTMLSpanElement | null>(null);
  const isDraggingRef = useRef(false);
  const holdRef = useRef(false);
  const touched = useRef(false);
  const wrapping = useRef(true);
  const camera = useRef<CameraTransform>({ scale: 1, x: 0, y: 0 });
  const [zoomBand, setZoomBand] = useState<ZoomBand>(0);
  const bandRef = useRef<ZoomBand>(0);
  const listeners = useRef(new Set<(transform: Readonly<CameraTransform>) => void>());

  const { sample: sampleFrame, reset: resetFrameMeter } = useFrameMeter(meterRef);

  const pixelsPerUnit = useCallback((): number => {
    const ctm = svgRef.current?.getScreenCTM?.();
    return ctm === null || ctm === undefined || ctm.a === 0 ? 1 : ctm.a;
  }, []);

  const applyTransform = useCallback(() => {
    const world = worldRef.current;
    if (world === null) return;
    const { scale, x, y } = camera.current;
    world.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);
    svgRef.current?.style.setProperty("--map-inv", String(1 / (scale * pixelsPerUnit())));
    svgRef.current?.style.setProperty("--map-copies", wrapping.current ? "inline" : "none");
    for (const listener of listeners.current) listener(camera.current);
    const next = bandFor(scale);
    if (next !== bandRef.current) {
      bandRef.current = next;
      setZoomBand(next);
    }
  }, [pixelsPerUnit]);

  const viewportUnits = useCallback((): Viewport => {
    const svg = svgRef.current;
    const factor = pixelsPerUnit();
    const ctm = svg?.getScreenCTM?.();
    const rect = svg?.getBoundingClientRect();
    return {
      left: ctm && rect && ctm.a !== 0 ? (rect.left - ctm.e) / ctm.a : 0,
      top: ctm && rect && ctm.d !== 0 ? (rect.top - ctm.f) / ctm.d : 0,
      width: (svg?.clientWidth ?? worldWidth * factor) / factor,
      height: (svg?.clientHeight ?? worldHeight * factor) / factor,
    };
  }, [pixelsPerUnit, worldHeight, worldWidth]);

  const minScale = useCallback((): number => {
    const visible = viewportUnits();
    const ratios = [visible.width / worldWidth, visible.height / worldHeight];
    const fit = coverViewport ? Math.max(...ratios) : Math.min(...ratios);
    return Number.isFinite(fit) && fit > 0 ? fit : MIN_SCALE;
  }, [coverViewport, viewportUnits, worldHeight, worldWidth]);

  const clamp = useCallback(() => {
    const current = camera.current;
    current.scale = Math.min(MAX_SCALE, Math.max(minScale(), current.scale));
    const span = worldWidth * current.scale;
    const visible = viewportUnits();
    if (wrapHorizontally && span > visible.width) {
      wrapping.current = true;
      current.x = -(((-current.x % span) + span) % span);
    } else {
      wrapping.current = false;
      current.x =
        span <= visible.width
          ? visible.left + (visible.width - span) / 2
          : Math.min(visible.left, Math.max(visible.left + visible.width - span, current.x));
    }
    const scaledHeight = worldHeight * current.scale;
    current.y =
      scaledHeight <= visible.height
        ? visible.top + (visible.height - scaledHeight) / 2
        : Math.min(visible.top, Math.max(visible.top + visible.height - scaledHeight, current.y));
  }, [minScale, viewportUnits, worldHeight, worldWidth, wrapHorizontally]);

  const reset = useCallback(() => {
    const scale = minScale();
    const visible = viewportUnits();
    camera.current = { scale, x: 0, y: visible.top + (visible.height - worldHeight * scale) / 2 };
    touched.current = false;
    resetFrameMeter();
    clamp();
    applyTransform();
  }, [applyTransform, clamp, minScale, resetFrameMeter, viewportUnits, worldHeight]);

  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (svg === null) return;
      const rect = svg.getBoundingClientRect();
      const unitScale = pixelsPerUnit();
      const origin = viewportUnits();
      const px = origin.left + (clientX - rect.left) / unitScale;
      const py = origin.top + (clientY - rect.top) / unitScale;
      const current = camera.current;
      const before = current.scale;
      touched.current = true;
      current.scale = Math.min(MAX_SCALE, Math.max(minScale(), current.scale * factor));
      const ratio = current.scale / before;
      current.x = px - (px - current.x) * ratio;
      current.y = py - (py - current.y) * ratio;
      clamp();
      applyTransform();
      sampleFrame();
    },
    [applyTransform, clamp, minScale, pixelsPerUnit, sampleFrame, viewportUnits],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const svg = svgRef.current;
      if (svg === null) return;
      const rect = svg.getBoundingClientRect();
      zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    [zoomAt],
  );

  const panBy = useCallback(
    (dxPixels: number, dyPixels: number) => {
      const unitScale = pixelsPerUnit();
      touched.current = true;
      camera.current.x += dxPixels / unitScale;
      camera.current.y += dyPixels / unitScale;
      clamp();
      applyTransform();
    },
    [applyTransform, clamp, pixelsPerUnit],
  );

  const chromeInsets = useCallback((): { top: number; bottom: number } => {
    const svg = svgRef.current;
    if (!coverViewport || svg === null) return { top: 0, bottom: 0 };
    const styles = getComputedStyle(svg);
    const factor = pixelsPerUnit();
    const read = (name: string) => {
      const pixels = Number.parseFloat(styles.getPropertyValue(name));
      return Number.isFinite(pixels) ? pixels / factor : 0;
    };
    return { top: read("--chrome-top"), bottom: read("--chrome-bottom") };
  }, [coverViewport, pixelsPerUnit]);

  const focusOn = useCallback(
    (x: number, y: number, scale = 3.5) => {
      const current = camera.current;
      touched.current = true;
      const visible = viewportUnits();
      const { top, bottom } = chromeInsets();
      current.scale = Math.min(MAX_SCALE, Math.max(minScale(), scale));
      current.x = visible.left + visible.width / 2 - x * current.scale;
      current.y = visible.top + top + (visible.height - top - bottom) / 2 - y * current.scale;
      clamp();
      applyTransform();
    },
    [applyTransform, chromeInsets, clamp, minScale, viewportUnits],
  );

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
  }, [applyTransform, clamp, pixelsPerUnit, resetFrameMeter, sampleFrame, zoomAt]);

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    const svg = svgRef.current;
    if (svg === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!touched.current && !holdRef.current) {
        reset();
        return;
      }
      clamp();
      applyTransform();
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [applyTransform, clamp, reset]);

  const subscribe = useCallback((listener: (transform: Readonly<CameraTransform>) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const getTransform = useCallback((): Readonly<CameraTransform> => camera.current, []);
  const isWrapping = useCallback(() => wrapping.current, []);

  const getView = useCallback((): CameraView => {
    const transform = { ...camera.current };
    return {
      transform,
      scale: transform.scale,
      pixelsPerUnit: pixelsPerUnit(),
      minScale: minScale(),
      wrapping: wrapping.current,
      svgHeight: svgRef.current?.clientHeight ?? 0,
      zoomBand: bandRef.current,
    };
  }, [minScale, pixelsPerUnit]);

  return {
    svgRef,
    worldRef,
    meterRef,
    zoomBand,
    reset,
    zoomBy,
    focusOn,
    panBy,
    getPixelsPerUnit: pixelsPerUnit,
    isDraggingRef,
    holdRef,
    isWrapping,
    getViewport: viewportUnits,
    getMinScale: minScale,
    getView,
    subscribe,
    getTransform,
  };
}
