import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { BORDERS_1880 } from "./borders-1880-data.js";

// Package tests run with the package dir (apps/desktop) as cwd.
const COUNTRIES_YAML = resolve(process.cwd(), "../../content/production/1880/countries.yaml");

/** Nation id -> the production pack's isPlayable flag. */
function nationPlayability(): Map<string, boolean> {
  const blocks = readFileSync(COUNTRIES_YAML, "utf8").split(/\n(?=- id: )/);
  const result = new Map<string, boolean>();
  for (const block of blocks) {
    const id = /- id: (\S+)/.exec(block)?.[1];
    if (id === undefined) continue;
    result.set(id, /\n\s+isPlayable: true/.test(block));
  }
  return result;
}

describe("1880 borders (baked from historical-basemaps)", () => {
  it("covers every playable nation, and only adds AI-only nations", () => {
    const playability = nationPlayability();
    const playable = [...playability].filter(([, isPlayable]) => isPlayable).map(([id]) => id);
    const baked = Object.keys(BORDERS_1880);

    // Every playable nation's territory is baked.
    for (const id of playable) expect(baked).toContain(id);

    // Any extra baked nation is a real, AI-only nation: the USA is promoted to
    // playable by DR-014 / ADR-0214 but is also a power drawn on the strategic map.
    for (const id of baked) {
      expect(playability.has(id), `${id} is not a production nation`).toBe(true);
      if (!playable.includes(id)) {
        expect(playability.get(id), `${id} must be AI-only`).toBe(false);
      }
    }
  });

  it("holds well-formed lon/lat rings", () => {
    for (const [nation, polygons] of Object.entries(BORDERS_1880)) {
      expect(polygons.length, nation).toBeGreaterThan(0);
      for (const rings of polygons) {
        for (const ring of rings) {
          expect(ring.length % 2, nation).toBe(0);
          expect(ring.length, nation).toBeGreaterThanOrEqual(6);
          for (let i = 0; i < ring.length; i += 2) {
            expect(Math.abs(ring[i] as number), nation).toBeLessThanOrEqual(180);
            expect(Math.abs(ring[i + 1] as number), nation).toBeLessThanOrEqual(90);
          }
        }
      }
    }
  });
});
