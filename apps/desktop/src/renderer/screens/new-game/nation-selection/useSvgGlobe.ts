import * as d3Geo from "d3-geo";
import * as d3Selection from "d3-selection";
import { useEffect, useRef } from "react";
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
  containerRef: ElementRef<HTMLDivElement>;
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
  registerResizeHandler: (handler: (context: SvgGlobeResizeContext) => void) => () => void;
  setDragging: (dragging: boolean) => void;
}

function useStableRefs(): SvgGlobeRefs {
  return {
    containerRef: useRef<HTMLDivElement>(null),
    svgRef: useRef<SVGSVGElement>(null),
    oceanRef: useRef<SVGCircleElement>(null),
    gratRef: useRef<SVGGElement>(null),
    landRef: useRef<SVGGElement>(null),
    pinRef: useRef<SVGGElement>(null),
    ringRef: useRef<SVGGElement>(null),
  };
}

export function useSvgGlobe(): SvgGlobeHandles {
  const refs = useStableRefs();
  const rotationAnimRef = useRef<RotationAnim | null>(null);
  const projectionRef = useRef<d3Geo.GeoProjection | undefined>(undefined);
  const frameRenderersRef = useRef<Array<() => void>>([]);
  const resizeHandlersRef = useRef<Array<(context: SvgGlobeResizeContext) => void>>([]);
  const draggingRef = useRef(false);

  useEffect(() => {
    const container = refs.containerRef.current;
    const svgEl = refs.svgRef.current;
    if (!container || !svgEl) return;

    let width = container.clientWidth || 800;
    let height = container.clientHeight || 600;
    let baseScale = Math.min(width, height) * 0.42;

    const projection = d3Geo
      .geoOrthographic()
      .clipAngle(90)
      .translate([width / 2, height / 2])
      .scale(baseScale)
      .rotate([-40, 30]);
    const pathGenerator = d3Geo.geoPath(projection);
    const graticule = d3Geo.geoGraticule10();
    projectionRef.current = projection;

    const oceanSel = d3Selection.select(refs.oceanRef.current);
    const gratSel = d3Selection.select(refs.gratRef.current);
    const landSel = d3Selection.select(refs.landRef.current);

    let lastFrameAt = performance.now();

    function renderBase(): void {
      const [cx, cy] = projection.translate();
      const sphereRadius = projection.scale();
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
      for (const renderFn of frameRenderersRef.current) renderFn();
    }

    let rafId = 0;
    let suspended = false;
    let documentHidden = document.hidden;
    let offScreen = false;
    let lastRenderAt = 0;

    function tick(now: number): void {
      const dt = now - lastFrameAt;
      lastFrameAt = now;
      const anim = rotationAnimRef.current;
      const dragging = draggingRef.current;
      if (anim) {
        const t = Math.min(1, (now - anim.start) / FOCUS_SPIN_MS);
        const eased = easeCubicInOut(t);
        projection.rotate([
          anim.fromLambda + (anim.toLambda - anim.fromLambda) * eased,
          anim.fromPhi + (anim.toPhi - anim.fromPhi) * eased,
        ]);
        if (t >= 1) rotationAnimRef.current = null;
      } else if (!dragging) {
        const [lambda, phi] = projection.rotate();
        projection.rotate([lambda + AUTOROTATE_DEG_PER_MS * dt, phi]);
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
      projection.translate([width / 2, height / 2]);
      if (resizeHandlersRef.current.length) {
        for (const handler of resizeHandlersRef.current) {
          handler({ width, height, baseScale, projection });
        }
      } else {
        projection.scale(baseScale);
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function registerFrameRenderer(renderFn: () => void): () => void {
    frameRenderersRef.current.push(renderFn);
    return () => {
      frameRenderersRef.current = frameRenderersRef.current.filter((fn) => fn !== renderFn);
    };
  }

  function registerResizeHandler(handler: (context: SvgGlobeResizeContext) => void): () => void {
    resizeHandlersRef.current.push(handler);
    return () => {
      resizeHandlersRef.current = resizeHandlersRef.current.filter((fn) => fn !== handler);
    };
  }

  return {
    ...refs,
    projection: () => projectionRef.current,
    rotationAnimRef,
    registerFrameRenderer,
    registerResizeHandler,
    setDragging: (dragging: boolean) => {
      draggingRef.current = dragging;
    },
  };
}
