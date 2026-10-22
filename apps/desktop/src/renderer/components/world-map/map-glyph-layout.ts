export interface GlyphBox {
  readonly id: string;
  readonly ships: number;
  readonly ux: number;
  readonly uy: number;
  readonly hw: number;
  readonly top: number;
  readonly bottom: number;
}

const STEP_PX = 8;
const MAX_STEPS = 12;
const CANDIDATES: readonly number[] = [
  0,
  ...Array.from({ length: MAX_STEPS }, (_, i) => [(i + 1) * STEP_PX, -(i + 1) * STEP_PX]).flat(),
];

interface Placed {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

export function separateGlyphs(glyphs: readonly GlyphBox[], factor: number): Map<string, number> {
  const order = [...glyphs].sort((a, b) =>
    a.ships !== b.ships ? b.ships - a.ships : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const placed: Placed[] = [];
  const offsets = new Map<string, number>();
  for (const glyph of order) {
    const y0 = glyph.uy * factor + glyph.top;
    const y1 = glyph.uy * factor + glyph.bottom;
    const boxAt = (dx: number): Placed => {
      const x = glyph.ux * factor + dx;
      return { x0: x - glyph.hw, x1: x + glyph.hw, y0, y1 };
    };
    const free = (box: Placed) =>
      !placed.some((o) => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0);
    const dx = CANDIDATES.find((candidate) => free(boxAt(candidate))) ?? 0;
    offsets.set(glyph.id, dx);
    placed.push(boxAt(dx));
  }
  return offsets;
}
