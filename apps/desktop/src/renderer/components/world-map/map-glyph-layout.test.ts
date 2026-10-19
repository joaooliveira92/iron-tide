import { describe, expect, it } from "vite-plus/test";
import { separateGlyphs, type GlyphBox } from "./map-glyph-layout.js";

const glyph = (id: string, ux: number, uy: number, ships = 1): GlyphBox => ({
  id,
  ships,
  ux,
  uy,
  hw: 25,
  top: -80,
  bottom: -38,
});

describe("separateGlyphs", () => {
  it("leaves glyphs that do not touch exactly where they are", () => {
    const offsets = separateGlyphs([glyph("a", 0, 0), glyph("b", 400, 0)], 1);
    expect(offsets.get("a")).toBe(0);
    expect(offsets.get("b")).toBe(0);
  });

  it("moves the weaker of two overlapping glyphs sideways and keeps the stronger in place", () => {
    const offsets = separateGlyphs([glyph("weak", 10, 0, 2), glyph("strong", 0, 0, 9)], 1);
    expect(offsets.get("strong")).toBe(0);
    expect(offsets.get("weak")).not.toBe(0);
  });

  it("leaves no pair overlapping when there is room to separate them", () => {
    const glyphs = [glyph("a", 0, 0, 5), glyph("b", 8, 0, 4), glyph("c", 16, 0, 3)];
    const offsets = separateGlyphs(glyphs, 1);
    const spans = glyphs.map((g) => {
      const x = g.ux + (offsets.get(g.id) ?? 0);
      return [x - g.hw, x + g.hw] as const;
    });
    for (let i = 0; i < spans.length; i++)
      for (let j = i + 1; j < spans.length; j++)
        expect(spans[i]![1] <= spans[j]![0] || spans[j]![1] <= spans[i]![0]).toBe(true);
  });

  it("does not move a glyph that overlaps only in x, when the other sits clear of it vertically", () => {
    const offsets = separateGlyphs(
      [glyph("a", 0, 0), { ...glyph("b", 0, 0), top: -400, bottom: -300 }],
      1,
    );
    expect(offsets.get("b")).toBe(0);
  });

  it("is deterministic and independent of input order, with ties broken by id", () => {
    const glyphs = [glyph("b", 0, 0, 3), glyph("a", 5, 0, 3), glyph("c", 9, 0, 1)];
    const forward = separateGlyphs(glyphs, 1);
    const backward = separateGlyphs([...glyphs].reverse(), 1);
    expect(backward).toEqual(forward);
    expect(separateGlyphs(glyphs, 1)).toEqual(forward);
  });

  it("works in screen pixels: world distance is scaled by the zoom factor", () => {
    // 10 world units apart is 10 px at factor 1 (overlap), but 100 px at factor 10 (clear).
    const close = separateGlyphs([glyph("a", 0, 0, 2), glyph("b", 10, 0, 1)], 1);
    expect(close.get("b")).not.toBe(0);
    const apart = separateGlyphs([glyph("a", 0, 0, 2), glyph("b", 10, 0, 1)], 10);
    expect(apart.get("b")).toBe(0);
  });

  it("gives up cleanly, leaving a glyph in place, when no nearby spot is free", () => {
    const crowd = Array.from({ length: 12 }, (_, i) =>
      glyph(`g${String(i).padStart(2, "0")}`, i, 0, 12 - i),
    );
    const offsets = separateGlyphs(crowd, 1);
    expect(offsets.size).toBe(12);
    for (const value of offsets.values()) expect(Number.isFinite(value)).toBe(true);
  });
});
