import * as d3Geo from "d3-geo";
import * as d3Selection from "d3-selection";
import { useState, type RefCallback } from "react";
import { feature } from "topojson-client";

interface GeometryCollection {
  type: "GeometryCollection";
  geometries: Array<{
    type: string;
    arcs?: number[][];
    properties?: Record<string, unknown>;
  }>;
}

interface Topology<T> {
  type: "Topology";
  objects: T;
  arcs: number[][][];
  transform?: { scale: [number, number]; translate: [number, number] };
}

import worldTopology from "@/content/world-110m.json";

export const MIN_PHI_DEG = -75;
export const MAX_PHI_DEG = 40;
const AUTOROTATE_DEG_PER_MS = 360 / 150_000;
export const FOCUS_SPIN_MS = 1000;
const GLOBE_RENDER_INTERVAL_MS = 1000 / 40;
export const PIN_BASE_RADIUS_PX = 6;
export const PIN_HIT_RADIUS_PX = 16;
export const RING_BASE_HALF_PX = 11;

const worldTopologyTyped = worldTopology as unknown as Topology<{
  countries: GeometryCollection;
  land: GeometryCollection;
}>;
const COUNTRIES = feature(
  worldTopologyTyped as unknown as Parameters<typeof feature>[0],
  worldTopologyTyped.objects.countries as unknown as Parameters<typeof feature>[1],
) as unknown as {
  features: Array<{ type: "Feature"; properties: Record<string, unknown> }>;
};

export function normalizeDeg(deg: number): number {
  return (((deg % 360) + 540) % 360) - 180;
}

function easeCubicInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function isVisible(projection: d3Geo.GeoProjection, lat: number, lng: number): boolean {
  const [rlambda, rphi] = projection.rotate();
  return d3Geo.geoDistance([lng, lat], [-rlambda, -rphi]) < Math.PI / 2;
}

export type RotationAnim = {
  fromLambda: number;
  fromPhi: number;
  toLambda: number;
  toPhi: number;
  start: number;
};

export type ElementRef<T> = { current: T | null };

export interface SvgGlobeRefs {
  containerRef: RefCallback<HTMLDivElement>;
  svgRef: ElementRef<SVGSVGElement>;
  oceanRef: ElementRef<SVGCircleElement>;
  gratRef: ElementRef<SVGGElement>;
  landRef: ElementRef<SVGGElement>;
  pinRef: ElementRef<SVGGElement>;
  ringRef: ElementRef<SVGGElement>;
}

export interface SvgGlobeResizeContext {
  width: number;
  height: number;
  baseScale: number;
  projection: d3Geo.GeoProjection;
}

export interface SvgGlobeHandles extends SvgGlobeRefs {
  projection: () => d3Geo.GeoProjection | undefined;
  rotationAnimRef: ElementRef<RotationAnim>;
  registerFrameRenderer: (renderFn: () => void) => () => void;
  registerTickHandler: (handler: (now: number) => void) => () => void;
  registerResizeHandler: (handler: (context: SvgGlobeResizeContext) => void) => () => void;
  setDragging: (dragging: boolean) => void;
}

export type SvgGlobeSetup = (
  globe: SvgGlobeHandles,
  container: HTMLDivElement,
) => void | (() => void);

function createSvgGlobe(setup: SvgGlobeSetup | undefined): SvgGlobeHandles {
  const svgRef: ElementRef<SVGSVGElement> = { current: null };
  const oceanRef: ElementRef<SVGCircleElement> = { current: null };
  const gratRef: ElementRef<SVGGElement> = { current: null };
  const landRef: ElementRef<SVGGElement> = { current: null };
  const pinRef: ElementRef<SVGGElement> = { current: null };
  const ringRef: ElementRef<SVGGElement> = { current: null };
  const rotationAnimRef: ElementRef<RotationAnim> = { current: null };
  let projection: d3Geo.GeoProjection | undefined;
  let frameRenderers: Array<() => void> = [];
  let tickHandlers: Array<(now: number) => void> = [];
  let resizeHandlers: Array<(context: SvgGlobeResizeContext) => void> = [];
  let dragging = false;

  function startBase(container: HTMLDivElement): (() => void) | undefined {
    const svgEl = svgRef.current;
    if (!svgEl) return undefined;

    let width = container.clientWidth || 800;
    let height = container.clientHeight || 600;
    let baseScale = Math.min(width, height) * 0.42;

    const nextProjection = d3Geo
      .geoOrthographic()
      .clipAngle(90)
      .translate([width / 2, height / 2])
      .scale(baseScale)
      .rotate([-40, 30]);
    const pathGenerator = d3Geo.geoPath(nextProjection);
    const graticule = d3Geo.geoGraticule10();
    projection = nextProjection;

    const oceanSel = d3Selection.select(oceanRef.current);
    const gratSel = d3Selection.select(gratRef.current);
    const landSel = d3Selection.select(landRef.current);

    let lastFrameAt = performance.now();

    function renderBase(): void {
      const [cx, cy] = nextProjection.translate();
      const sphereRadius = nextProjection.scale();
      oceanSel.attr("cx", cx).attr("cy", cy).attr("r", sphereRadius);

      gratSel
        .selectAll("path")
        .data([graticule])
        .join("path")
        .attr("d", pathGenerator as never);
      landSel
        .selectAll("path")
        .data(COUNTRIES.features)
        .join("path")
        .attr("d", pathGenerator as never);
    }

    function renderFrame(): void {
      renderBase();
      for (const renderFn of frameRenderers) renderFn();
    }

    let rafId = 0;
    let suspended = false;
    let documentHidden = document.hidden;
    let offScreen = false;
    let lastRenderAt = 0;

    function tick(now: number): void {
      const dt = now - lastFrameAt;
      lastFrameAt = now;
      for (const handler of tickHandlers) handler(now);
      const anim = rotationAnimRef.current;
      if (anim) {
        const t = Math.min(1, (now - anim.start) / FOCUS_SPIN_MS);
        const eased = easeCubicInOut(t);
        nextProjection.rotate([
          anim.fromLambda + (anim.toLambda - anim.fromLambda) * eased,
          anim.fromPhi + (anim.toPhi - anim.fromPhi) * eased,
        ]);
        if (t >= 1) rotationAnimRef.current = null;
      } else if (!dragging) {
        const [lambda, phi] = nextProjection.rotate();
        nextProjection.rotate([lambda + AUTOROTATE_DEG_PER_MS * dt, phi]);
      }
      if (dragging || now - lastRenderAt >= GLOBE_RENDER_INTERVAL_MS) {
        renderFrame();
        lastRenderAt = now;
      }
      rafId = requestAnimationFrame(tick);
    }

    function updateSuspended(): void {
      const shouldSuspend = documentHidden || offScreen;
      if (shouldSuspend === suspended) return;
      suspended = shouldSuspend;
      if (suspended) {
        cancelAnimationFrame(rafId);
      } else {
        lastFrameAt = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);

    const onVisibilityChange = (): void => {
      documentHidden = document.hidden;
      updateSuspended();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const intersectionObserver = new IntersectionObserver((entries) => {
      offScreen = !(entries[entries.length - 1]?.isIntersecting ?? true);
      updateSuspended();
    });
    intersectionObserver.observe(container);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width: w, height: h } = entry.contentRect;
      if (w <= 0 || h <= 0) return;
      width = w;
      height = h;
      baseScale = Math.min(width, height) * 0.42;
      nextProjection.translate([width / 2, height / 2]);
      if (resizeHandlers.length) {
        for (const handler of resizeHandlers) {
          handler({ width, height, baseScale, projection: nextProjection });
        }
      } else {
        nextProjection.scale(baseScale);
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }

  const handles: SvgGlobeHandles = {
    containerRef: (container) => {
      if (!container) return undefined;
      const stopBase = startBase(container);
      if (!stopBase) return undefined;
      const stopSetup = setup?.(handles, container);
      return () => {
        if (typeof stopSetup === "function") stopSetup();
        stopBase();
      };
    },
    svgRef,
    oceanRef,
    gratRef,
    landRef,
    pinRef,
    ringRef,
    projection: () => projection,
    rotationAnimRef,
    registerFrameRenderer: (renderFn) => {
      frameRenderers.push(renderFn);
      return () => {
        frameRenderers = frameRenderers.filter((fn) => fn !== renderFn);
      };
    },
    registerTickHandler: (handler) => {
      tickHandlers.push(handler);
      return () => {
        tickHandlers = tickHandlers.filter((fn) => fn !== handler);
      };
    },
    registerResizeHandler: (handler) => {
      resizeHandlers.push(handler);
      return () => {
        resizeHandlers = resizeHandlers.filter((fn) => fn !== handler);
      };
    },
    setDragging: (next) => {
      dragging = next;
    },
  };
  return handles;
}

export function useSvgGlobe(setup?: SvgGlobeSetup): SvgGlobeHandles {
  const [handles] = useState(() => createSvgGlobe(setup));
  return handles;
}
