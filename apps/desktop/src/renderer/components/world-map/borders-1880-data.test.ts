import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { BORDERS_1880 } from "./borders-1880-data.js";

// Package tests run with the package dir (apps/desktop) as cwd.
const COUNTRIES_YAML = resolve(process.cwd(), "../../content/production/1880/countries.yaml");

/** Ids of the nations the production pack marks playable. */
function playableIds(): string[] {
  const blocks = readFileSync(COUNTRIES_YAML, "utf8").split(/\n(?=- id: )/);
  return blocks
    .filter((block) => /\n\s+isPlayable: true/.test(block))
    .map((block) => /- id: (\S+)/.exec(block)?.[1] as string);
}

describe("1880 borders (baked from historical-basemaps)", () => {
  it("covers exactly the playable nations", () => {
    expect(Object.keys(BORDERS_1880).sort()).toEqual(playableIds().sort());
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
