import { useEffect, useRef } from "react";
import { formatNauticalMiles, niceScaleBar, pixelsPerNauticalMile } from "./map-scale.js";
import type { MapCamera } from "./useMapCamera.js";

const MAX_BAR_PX = 140;

/**
 * Live scale bar. Follows the camera by subscription and writes straight to the
 * DOM, so panning and zooming never cost a React render (same rule as the
 * camera itself).
 */
export function MapScaleBar({
  camera,
  worldWidth,
}: {
  readonly camera: MapCamera;
  readonly worldWidth: number;
}) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const update = () => {
      const bar = barRef.current;
      const label = labelRef.current;
      if (bar === null || label === null) return;
      const { scale } = camera.getTransform();
      const result = niceScaleBar(
        pixelsPerNauticalMile(camera.getPixelsPerUnit(), scale, worldWidth),
        MAX_BAR_PX,
      );
      bar.style.width = `${result.px}px`;
      label.textContent = result.nm > 0 ? formatNauticalMiles(result.nm) : "";
    };
    update();
    const unsubscribe = camera.subscribe(update);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    const svg = camera.svgRef.current;
    if (svg !== null) observer?.observe(svg);
    return () => {
      unsubscribe();
      observer?.disconnect();
    };
  }, [camera, worldWidth]);

  return (
    <div className="pointer-events-none flex flex-col items-start gap-0.5" aria-hidden="true">
      <span ref={labelRef} className="text-xs tabular-nums" />
      <div
        ref={barRef}
        className="h-1.5 border-x border-b"
        style={{ borderColor: "oklch(0.92 0.01 240)" }}
      />
    </div>
  );
}
