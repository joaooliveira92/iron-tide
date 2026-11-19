import { useMemo, useRef } from "react";

import { formatFixed } from "../../lib/presentation-format/format.js";
import { useLifecycle } from "../../shell/useExternalSync.js";
import { AREAS } from "../world-map/map-geometry.js";
import { useFrameMeter } from "../world-map/useFrameMeter.js";
import {
  minimapToLatitude,
  minimapToLongitude,
  minimapViewportRect,
  scaleBarForZoom,
  type GlobeViewport,
} from "./adapter-layer-state.js";

const MINIMAP_WIDTH = 176;
const MINIMAP_HEIGHT = 88;

function worldPath(): string {
  let path = "";
  for (const area of AREAS) {
    let first = true;
    for (const [lon, lat] of area.ring) {
      const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
      const x = ((wrapped + 180) / 360) * MINIMAP_WIDTH;
      const y = ((90 - Math.max(-90, Math.min(90, lat))) / 180) * MINIMAP_HEIGHT;
      path += `${first ? "M" : "L"}${formatFixed(x, { locale: "en-US", digits: 1 })} ${formatFixed(y, { locale: "en-US", digits: 1 })}`;
      first = false;
    }
    path += "Z";
  }
  return path;
}

export function GlobeMinimap({
  viewport,
  onRecentre,
}: {
  readonly viewport: GlobeViewport;
  readonly onRecentre: (lon: number, lat: number) => void;
}) {
  const path = useMemo(worldPath, []);
  const rect = minimapViewportRect(viewport, MINIMAP_WIDTH, MINIMAP_HEIGHT);
  return (
    <svg
      aria-label="World minimap. Choose a point to recentre the map."
      role="img"
      data-testid="globe-adapter-minimap"
      className="cursor-crosshair touch-none rounded-md border border-white/30"
      style={{ background: "#00cce0", width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`}
      onPointerDown={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        onRecentre(
          minimapToLongitude(event.clientX - box.left, box.width),
          minimapToLatitude(event.clientY - box.top, box.height),
        );
      }}
    >
      <path d={path} fill="#fcf4f0" fillOpacity={1} />
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="#5fc0ff"
        fillOpacity={0.16}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    </svg>
  );
}

export function GlobeScaleBar({ zoom }: { readonly zoom: number }) {
  const bar = scaleBarForZoom(zoom, 140);
  return (
    <div className="pointer-events-none flex flex-col items-start gap-0.5" aria-hidden="true">
      <span className="text-xs tabular-nums text-white/80">{bar.nauticalMiles} nm</span>
      <div
        className="h-1.5 border-x border-b border-white/70"
        style={{ width: `${Math.round(bar.pixels)}px` }}
      />
    </div>
  );
}

export function GlobeFrameMeter() {
  const meterRef = useRef<HTMLSpanElement | null>(null);
  const meter = useFrameMeter(meterRef);
  const { sample } = meter;
  useLifecycle(() => {
    let frame = requestAnimationFrame(function tick() {
      sample();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [sample]);
  return (
    <span
      ref={meterRef}
      data-testid="globe-adapter-frame-meter"
      className="font-mono text-xs tabular-nums text-white/70"
    />
  );
}
