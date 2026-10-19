/**
 * Keeps regional strength glyphs from sitting on top of each other. Pure.
 *
 * Two regions whose anchors are close (the Adriatic under Austria-Hungary, say) would draw
 * their glyphs over one another. Shrinking a bar would change the value it encodes, so the
 * weaker glyph slides sideways instead, to the nearest free spot. The strongest region is
 * placed first and never moves; ties fall to the region id, so the result does not depend
 * on input order.
 */

export interface GlyphBox {
  readonly id: string;
  readonly ships: number;
  /** The glyph's anchor in world user units. */
  readonly ux: number;
  readonly uy: number;
  /** Half the glyph's width, and its vertical extent relative to the anchor (negative is up), in screen px. */
  readonly hw: number;
  readonly top: number;
  readonly bottom: number;
}

/** Sideways steps tried, nearest first: 0, +8, -8, +16, -16 ... up to ±96 px. */
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

/**
 * The horizontal offset, in screen pixels, for each glyph. `factor` is screen pixels per world
 * user unit. A glyph with no free spot nearby stays where it is.
 */
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
