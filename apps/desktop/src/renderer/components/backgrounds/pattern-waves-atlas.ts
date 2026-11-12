import { DEFAULT_CHARACTERS } from "./pattern-waves-settings.js";

const GLYPH_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const ATLAS_TILE = 128;

export interface GlyphAtlas {
  canvas: HTMLCanvasElement;
  columns: number;
  lines: number;
  count: number;
}

export function buildAtlas(characters: string): GlyphAtlas | null {
  const glyphs = Array.from(characters && characters.length ? characters : DEFAULT_CHARACTERS);
  const columns = Math.ceil(Math.sqrt(glyphs.length));
  const lines = Math.ceil(glyphs.length / columns);
  const canvas = document.createElement("canvas");
  canvas.width = columns * ATLAS_TILE;
  canvas.height = lines * ATLAS_TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${Math.round(ATLAS_TILE * 0.86)}px ${GLYPH_FONT}`;
  glyphs.forEach((glyph, index) => {
    const x = (index % columns) * ATLAS_TILE + ATLAS_TILE / 2;
    const y = Math.floor(index / columns) * ATLAS_TILE + ATLAS_TILE / 2;
    ctx.fillText(glyph, x, y);
  });
  return { canvas, columns, lines, count: glyphs.length };
}
