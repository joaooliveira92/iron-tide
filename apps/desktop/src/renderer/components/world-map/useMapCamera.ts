/**
 * The camera, built exactly the way ticket 13's research says to build it, so
 * that the prototype tests the claim rather than restating it:
 *
 * - Pan and zoom live in a **ref**, never in React state, and are applied by
 *   writing `transform` straight onto one `<g>`. Dragging across the whole map
 *   must not render a single React component. The frame meter below is how you
 *   check that; if a variant re-renders on pointermove, its p95 collapses.
 *
 * - Wheel zoom uses a manual `addEventListener("wheel", …, { passive: false })`
 *   because React 19's `onWheel` is passive and cannot `preventDefault()`. In
 *   Electron a passive wheel handler means the whole app scrolls behind the map.
 *
 * - Zoom **bands** are the one thing that does reach React state, and they
 *   change a handful of times per session rather than per frame. That is the
 *   answer to the level-of-detail question: label density keys off the band,
 *   not off the scale.
 *
 * One trap worth recording because it cost time here: with a `viewBox`, the
 * `<g transform>` is in *user units* while pointer events are in *screen
 * pixels*, and `preserveAspectRatio` puts an arbitrary factor between them.
 * Every pointer delta below is converted through `getScreenCTM()` first. Skip
 * that and pan drifts against the cursor at every window size but one.
 */

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
/** Raised from 14 (ADR-0055); beyond ~60x the 0.01° coastline data runs out. */
const MAX_SCALE = 60;

export interface MapCamera {
  readonly svgRef: React.RefObject<SVGSVGElement | null>;
  readonly worldRef: React.RefObject<SVGGElement | null>;
  readonly meterRef: React.RefObject<HTMLSpanElement | null>;
  readonly zoomBand: ZoomBand;
  readonly reset: () => void;
  readonly zoomBy: (factor: number) => void;
  /** Pan by screen pixels (keyboard control). */
  readonly panBy: (dxPixels: number, dyPixels: number) => void;
  /** Screen pixels per world user unit at camera scale 1. */
  readonly getPixelsPerUnit: () => number;
  readonly focusOn: (x: number, y: number, scale?: number) => void;
  readonly isDraggingRef: React.RefObject<boolean>;
  /** False while the whole world fits the view, so only the home copy is drawn. */
  readonly isWrapping: () => boolean;
  /** The zoom floor: the scale at which the whole world fits the view. */
  readonly getMinScale: () => number;
  /** The viewport in camera user units (see `viewportUnits`). */
  readonly getViewport: () => Viewport;
  /** Called after every transform change (pan, zoom, reset). Returns an unsubscribe. */
  readonly getTransform: () => Readonly<CameraTransform>;
  readonly subscribe: (listener: (transform: Readonly<CameraTransform>) => void) => () => void;
}

export interface Viewport {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface CameraOptions {
  /**
   * A geographic map wraps east–west, so panning never runs out of world. A
   * stylised board does not — its columns end. Variant B is where that
   * difference stops being cosmetic.
   */
  readonly wrapHorizontally: boolean;
  /**
   * Zoom floor covers the viewport instead of fitting the world, so a wide panel shows no empty
   * bands above and below the map (the command screen runs it behind its translucent bars).
   */
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
  /** True once the user (or a focus call) has moved the camera off the fitted view. */
  const touched = useRef(false);
  /** Whether the east-west copies are in play (false while the world fits the view). */
  const wrapping = useRef(true);
  const camera = useRef<CameraTransform>({ scale: 1, x: 0, y: 0 });
  const [zoomBand, setZoomBand] = useState<ZoomBand>(0);
  const bandRef = useRef<ZoomBand>(0);
  const listeners = useRef(new Set<(transform: Readonly<CameraTransform>) => void>());

  // Frame timing. Kept out of React entirely; the readout is written straight
  // into a span so producing the number cannot perturb the number.
  const { sample: sampleFrame, reset: resetFrameMeter } = useFrameMeter(meterRef);

  /** Screen pixels per user unit, or null before the SVG is laid out. */
  const pixelsPerUnit = useCallback((): number => {
    const ctm = svgRef.current?.getScreenCTM?.();
    return ctm === null || ctm === undefined || ctm.a === 0 ? 1 : ctm.a;
  }, []);

  const applyTransform = useCallback(() => {
    const world = worldRef.current;
    if (world === null) return;
    const { scale, x, y } = camera.current;
    world.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);
    // Markers and labels counter-scale with this so they hold their screen
    // size in real pixels at any zoom and any viewBox scale (the world group
    // scales everything inside it, and the viewBox scales the group).
    svgRef.current?.style.setProperty("--map-inv", String(1 / (scale * pixelsPerUnit())));
    // The wrapped copies are only drawn while the world overflows the view.
    svgRef.current?.style.setProperty("--map-copies", wrapping.current ? "inline" : "none");
    for (const listener of listeners.current) listener(camera.current);
    const next = bandFor(scale);
    if (next !== bandRef.current) {
      bandRef.current = next;
      setZoomBand(next);
    }
  }, [pixelsPerUnit]);

  /**
   * The viewport in the same user units as the camera. `left`/`top` are where
   * its edges sit in user space: non-zero whenever `preserveAspectRatio`
   * letterboxes the viewBox, which it does for any panel that is not the
   * world's own shape.
   */
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

  /**
   * The zoom floor: the whole world fits the viewport. When the panel is wider
   * (or taller) than the world, the world is centred with empty margins and the
   * wrapped copies are hidden (see `wrapping`), so there is never a second
   * world beside the first. Falls back to MIN_SCALE before layout.
   */
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
      // The map repeats, so x only ever needs one turn's worth. Wrapping into
      // (-span, 0] rather than [-span, 0) is what keeps a fresh camera at 0.
      wrapping.current = true;
      current.x = -(((-current.x % span) + span) % span);
    } else {
      // The world is narrower than the view (or the board does not wrap):
      // centre it and stop at its edges.
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
    // "Fit world": the clamp centres whatever margin is left over.
    const scale = minScale();
    const visible = viewportUnits();
    // Centre vertically; the clamp does the same when the world is the shorter one.
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
      // The cursor, in the same user units the camera translate is written in.
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

  const focusOn = useCallback(
    (x: number, y: number, scale = 3.5) => {
      const current = camera.current;
      touched.current = true;
      const visible = viewportUnits();
      current.scale = Math.min(MAX_SCALE, Math.max(minScale(), scale));
      current.x = visible.left + visible.width / 2 - x * current.scale;
      current.y = visible.top + visible.height / 2 - y * current.scale;
      clamp();
      applyTransform();
    },
    [applyTransform, clamp, minScale, viewportUnits],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (svg === null) return;

    // Non-passive on purpose. React's onWheel cannot do this.
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
    }

    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
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
      // Cleared on the next tick so the click handler can still see it.
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 0);
    }

    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("pointerdown", onPointerDown);
    svg.addEventListener("pointermove", onPointerMove);
    svg.addEventListener("pointerup", onPointerUp);
    svg.addEventListener("pointercancel", onPointerUp);
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

  // The viewport changes size after mount (layout, window resize). Refit an
  // untouched camera; otherwise just re-clamp so the zoom floor still holds.
  useEffect(() => {
    const svg = svgRef.current;
    if (svg === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!touched.current) {
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
    isWrapping: () => wrapping.current,
    getViewport: viewportUnits,
    getMinScale: minScale,
    subscribe,
    getTransform: () => camera.current,
  };
}
