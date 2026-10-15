/**
 * The parallels and meridians drawn behind every layer. Pure geometry (no
 * React, no DOM), so it can be memoised independently of the chart body.
 */

import type { Projection } from "./projection.js";

export function buildGraticule(projection: Projection): string {
  const lines: string[] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, y] = projection.project(0, lat);
    lines.push(`M${-projection.width} ${y}L${projection.width * 2} ${y}`);
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const [x] = projection.project(lon, 0);
    lines.push(`M${x} 0L${x} ${projection.height}`);
  }
  return lines.join("");
}
