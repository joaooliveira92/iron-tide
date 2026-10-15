/**
 * Small SVG presentation helpers shared by the map's marker/label layers. A
 * child pinned with `pinned` holds a constant screen size because the camera
 * writes `--map-inv` (the inverse of the world→screen scale).
 */

export function pinned(x: number, y: number) {
  return { transform: `translate(${x}px, ${y}px) scale(var(--map-inv, 1))` };
}

/** Text for a pinned group: `--map-inv` already makes one user unit one screen pixel. */
export function screenText(px: number, strokePx: number) {
  return { fontSize: px, strokeWidth: strokePx, strokeLinejoin: "round" as const };
}
