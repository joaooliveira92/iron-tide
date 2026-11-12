import { LngLat, type Map as MapLibreMap } from "maplibre-gl";

import type { GlobeSpikeApi } from "./globe-spike-api.js";
import { centroid, nextFrame } from "./globe-spike-entities.js";
import { EMPTY } from "./globe-spike-style.js";

export function waitForIdle(active: MapLibreMap): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (active.loaded() && !active.isMoving()) resolve();
      else active.once("idle", () => resolve());
    };
    requestAnimationFrame(() => requestAnimationFrame(check));
  });
}

export function createProbeApi(
  active: MapLibreMap,
): Pick<
  GlobeSpikeApi,
  "samplePixels" | "markerRenderedPixels" | "runProbes" | "canvasPaintedPixels"
> {
  const waitIdle = () => waitForIdle(active);
  return {
    samplePixels: (points) => {
      const source = active.getCanvas();
      const scale = source.width / active.getContainer().clientWidth;
      const copy = document.createElement("canvas");
      copy.width = source.width;
      copy.height = source.height;
      const context = copy.getContext("2d", { willReadFrequently: true });
      if (context === null) return [];
      context.drawImage(source, 0, 0);
      return points.map(([x, y]) => {
        const { data } = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1);
        return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0] as const;
      });
    },
    markerRenderedPixels: async (id) => {
      active.setFilter("markers", ["==", ["get", "id"], id]);
      for (let frame = 0; frame < 2; frame++) {
        await new Promise<void>((resolve) => {
          active.once("render", () => resolve());
          active.triggerRepaint();
        });
      }
      await nextFrame();
      const source = active.getCanvas();
      const copy = document.createElement("canvas");
      copy.width = Math.max(1, Math.floor(source.width / 4));
      copy.height = Math.max(1, Math.floor(source.height / 4));
      const context = copy.getContext("2d", { willReadFrequently: true });
      let count = 0;
      if (context !== null) {
        context.drawImage(source, 0, 0, copy.width, copy.height);
        const { data } = context.getImageData(0, 0, copy.width, copy.height);
        for (let index = 0; index < data.length; index += 4) {
          if (
            (data[index] ?? 0) > 200 &&
            (data[index + 1] ?? 0) > 170 &&
            (data[index + 2] ?? 0) < 140
          ) {
            count++;
          }
        }
      }
      active.setFilter("markers", null);
      return count;
    },
    runProbes: async (points) => {
      const source = active.getSource("probe");
      if (source === undefined || !("setData" in source)) {
        return {
          requested: points.length,
          missing: points.length,
          maxErrorPx: null,
          meanErrorPx: null,
        };
      }
      (source as { setData: (data: unknown) => void }).setData({
        type: "FeatureCollection",
        features: points.map((point, index) => ({
          type: "Feature",
          properties: { index },
          geometry: { type: "Point", coordinates: [point[0], point[1]] },
        })),
      });
      await waitIdle();
      await nextFrame();
      await waitIdle();
      const canvas = active.getCanvas();
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      const context = copy.getContext("2d", { willReadFrequently: true });
      if (context === null) {
        return {
          requested: points.length,
          missing: points.length,
          maxErrorPx: null,
          meanErrorPx: null,
        };
      }
      context.drawImage(canvas, 0, 0);
      const scale = canvas.width / canvas.clientWidth;
      const errors: number[] = [];
      let missing = 0;
      for (const point of points) {
        const expected = active.project(new LngLat(point[0], point[1]));
        const found = centroid(
          context,
          canvas.width,
          canvas.height,
          expected.x * scale,
          expected.y * scale,
          12 * scale,
        );
        if (found === null) {
          missing++;
          continue;
        }
        errors.push(Math.hypot(found[0] / scale - expected.x, found[1] / scale - expected.y));
      }
      (source as { setData: (data: unknown) => void }).setData(EMPTY);
      return {
        requested: points.length,
        missing,
        maxErrorPx: errors.length > 0 ? Math.max(...errors) : null,
        meanErrorPx: errors.length > 0 ? errors.reduce((a, b) => a + b, 0) / errors.length : null,
      };
    },
    canvasPaintedPixels: () => {
      const source = active.getCanvas();
      const probe = document.createElement("canvas");
      probe.width = Math.min(64, source.width);
      probe.height = Math.min(64, source.height);
      const context = probe.getContext("2d", { willReadFrequently: true });
      if (context === null) return -1;
      context.drawImage(source, 0, 0, probe.width, probe.height);
      const { data } = context.getImageData(0, 0, probe.width, probe.height);
      let painted = 0;
      for (let index = 0; index < data.length; index += 4) {
        if ((data[index + 3] ?? 0) > 0 && (data[index] ?? 0) + (data[index + 1] ?? 0) > 0) {
          painted++;
        }
      }
      return painted;
    },
  };
}
