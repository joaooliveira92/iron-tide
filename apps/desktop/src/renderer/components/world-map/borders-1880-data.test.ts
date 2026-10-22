import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { decodeCoastline } from "../../lib/coastline-codec.js";
import { BORDERS_1880 } from "./borders-1880-data.js";
import { COASTLINE_BASE64 } from "./coastline-data.js";

const COUNTRIES_YAML = resolve(process.cwd(), "../../content/production/1880/countries.yaml");

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

    for (const id of playable) expect(baked).toContain(id);

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

  it("is clipped to the coastline's own detail, not the coarse 1880 outline", () => {
    const points = (BORDERS_1880.germany ?? []).reduce(
      (n, rings) => n + rings.reduce((m, ring) => m + ring.length / 2, 0),
      0,
    );
    expect(points).toBeGreaterThan(1000);
  });

  it("still follows the current coastline (rebake the borders after a coastline rebake)", () => {
    const coast = new Set<string>();
    for (const polygon of decodeCoastline(Buffer.from(COASTLINE_BASE64, "base64").buffer)) {
      for (const ring of polygon) {
        for (let i = 0; i < ring.length; i += 2) coast.add(`${ring[i]},${ring[i + 1]}`);
      }
    }
    for (const [nation, polygons] of Object.entries(BORDERS_1880)) {
      let total = 0;
      let onCoast = 0;
      for (const rings of polygons) {
        for (const ring of rings) {
          for (let i = 0; i < ring.length; i += 2) {
            total++;
            if (coast.has(`${ring[i]},${ring[i + 1]}`)) onCoast++;
          }
        }
      }
      expect(onCoast / total, nation).toBeGreaterThan(0.5);
    }
  });
});
