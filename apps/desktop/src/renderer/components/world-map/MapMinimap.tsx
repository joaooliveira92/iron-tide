import { useEffect, useMemo, useRef, useState } from "react";
import { simplifyPolygons, type FlatPolygon } from "../../lib/simplify-geometry.js";
import { runTimeSliced } from "../../lib/time-slice.js";
import { minimapToWorld, visibleWorldRects } from "./map-viewport.js";
import type { Projection } from "./projection.js";
import type { MapCamera } from "./useMapCamera.js";

const MINIMAP_TOLERANCE = 0.25;
const BATCH = 16;
const MINIMAP_WIDTH_PX = 176;

function* buildMinimapPath(
  source: readonly FlatPolygon[],
  projection: Projection,
  centre: number,
): Generator<void, string> {
  let d = "";
  for (let i = 0; i < source.length; i += BATCH) {
    for (const rings of simplifyPolygons(source.slice(i, i + BATCH), MINIMAP_TOLERANCE)) {
      for (const flat of rings) {
        for (let k = 0; k < flat.length; k += 2) {
          const [x, y] = projection.project((flat[k] as number) - centre, flat[k + 1] as number);
          d += `${k === 0 ? "M" : "L"}${x.toFixed(0)} ${y.toFixed(0)}`;
        }
        d += "Z";
      }
    }
    yield;
  }
  return d;
}

export interface MapMinimapProps {
  readonly camera: MapCamera;
  readonly projection: Projection;
  readonly centre: number;
  readonly polygons: readonly FlatPolygon[];
  readonly land: string;
  readonly ocean: string;
  readonly ink: string;
  readonly borderColor: string;
}

export function MapMinimap({
  camera,
  projection,
  centre,
  polygons,
  land,
  ocean,
  ink,
  borderColor,
}: MapMinimapProps) {
  const [path, setPath] = useState("");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rectRefs = useRef<(SVGRectElement | null)[]>([]);
  const cameraRef = useRef(camera);
  useEffect(() => {
    cameraRef.current = camera;
  });

  useEffect(() => {
    const handle = runTimeSliced(
      buildMinimapPath(polygons, projection, centre),
      {
        budgetMs: 6,
        now: () => performance.now(),
        schedule: (resume) => {
          setTimeout(resume, 0);
        },
      },
      setPath,
    );
    return () => handle.cancel();
  }, [polygons, projection, centre]);

  useEffect(() => {
    const update = () => {
      const current = cameraRef.current;
      const view = current.getViewport();
      const rects = visibleWorldRects(current.getTransform(), view, projection, view);
      rectRefs.current.forEach((node, index) => {
        const rect = rects[index];
        if (node === null || node === undefined) return;
        if (rect === undefined) {
          node.setAttribute("visibility", "hidden");
          return;
        }
        node.setAttribute("visibility", "visible");
        node.setAttribute("x", String(rect.x));
        node.setAttribute("y", String(rect.y));
        node.setAttribute("width", String(rect.width));
        node.setAttribute("height", String(rect.height));
      });
    };
    update();
    const unsubscribe = cameraRef.current.subscribe(update);
    const main = cameraRef.current.svgRef.current;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (main !== null) observer?.observe(main);
    return () => {
      unsubscribe();
      observer?.disconnect();
    };
  }, [projection]);

  const recentre = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const target = minimapToWorld(
      { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height },
      projection,
    );
    const current = cameraRef.current;
    current.focusOn(target.x, target.y, current.getTransform().scale);
  };

  const heightPx = Math.round((MINIMAP_WIDTH_PX * projection.height) / projection.width);
  const border = useMemo(() => ({ borderColor }), [borderColor]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      data-testid="map-minimap"
      className="cursor-crosshair touch-none rounded-md border"
      style={{ ...border, background: ocean, width: MINIMAP_WIDTH_PX, height: heightPx }}
      viewBox={`0 0 ${projection.width} ${projection.height}`}
      preserveAspectRatio="none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        recentre(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) recentre(event);
      }}
    >
      <path d={path} fill={land} fillRule="evenodd" />
      {[0, 1].map((index) => (
        <rect
          key={index}
          ref={(node) => {
            rectRefs.current[index] = node;
          }}
          fill={ink}
          fillOpacity={0.14}
          stroke={ink}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
