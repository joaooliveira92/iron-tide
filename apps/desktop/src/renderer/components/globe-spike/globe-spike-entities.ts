import { SPIKE_MARKERS } from "./globe-spike-scene.js";
import type { MapEntity } from "./MapEntityList.js";

export function entities(): readonly MapEntity[] {
  const ports: MapEntity[] = SPIKE_MARKERS.map((marker) => ({
    id: marker.id,
    name: marker.name,
    kind: "port",
  }));
  return ports;
}

export function centroid(
  context: {
    getImageData: (x: number, y: number, w: number, h: number) => { data: ArrayLike<number> };
  },
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
): readonly [number, number] | null {
  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const w = Math.min(width - x0, Math.ceil(radius * 2));
  const h = Math.min(height - y0, Math.ceil(radius * 2));
  if (w <= 0 || h <= 0) return null;
  const { data } = context.getImageData(x0, y0, w, h);
  let sumX = 0;
  let sumY = 0;
  let sumW = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4;
      const red = data[k] ?? 0;
      const weight = Math.max(0, red - Math.max(data[k + 1] ?? 0, data[k + 2] ?? 0) - 40);
      sumX += (x0 + i + 0.5) * weight;
      sumY += (y0 + j + 0.5) * weight;
      sumW += weight;
    }
  }
  return sumW < 200 ? null : [sumX / sumW, sumY / sumW];
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
