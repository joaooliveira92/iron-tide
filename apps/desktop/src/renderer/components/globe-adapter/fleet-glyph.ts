export const FLEET_GLYPH_ID = "fleet-square";

const SIZE = 32;
const BUFFER = 8;
const CUTOFF = 0.25;

export interface FleetGlyphImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

function boxDistance(x: number, y: number, half: number): number {
  const qx = Math.abs(x - SIZE / 2) - half;
  const qy = Math.abs(y - SIZE / 2) - half;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
}

export function buildFleetGlyph(): FleetGlyphImage {
  const half = SIZE / 2 - BUFFER;
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const distance = boxDistance(x + 0.5, y + 0.5, half);
      const alpha = Math.max(0, Math.min(1, 1 - (distance / BUFFER + CUTOFF)));
      data[(y * SIZE + x) * 4 + 3] = Math.round(alpha * 255);
    }
  }
  return { width: SIZE, height: SIZE, data };
}
