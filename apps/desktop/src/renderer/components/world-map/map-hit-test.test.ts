import { describe, expect, it } from "vite-plus/test";
import { areaAtPoint } from "./map-hit-test.js";
import type { MapAreaGeometry } from "./map-geometry.js";

function area(
  id: string,
  ring: readonly (readonly [number, number])[],
  label: readonly [number, number],
): MapAreaGeometry {
  return { id, name: id, short: id, ring, label, tile: [0, 0], climate: "temperate" };
}

const square = (x: number, y: number, size: number) =>
  [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
  ] as const;

const west = area("west", square(0, 0, 100), [40, 50]);
const east = area("east", square(50, 0, 100), [140, 50]);

describe("areaAtPoint", () => {
  it("returns the polygon under the point", () => {
    expect(areaAtPoint([west, east], { x: 20, y: 20 }, 1000)).toBe("west");
    expect(areaAtPoint([west, east], { x: 140, y: 20 }, 1000)).toBe("east");
  });

  it("resolves an overlap to the polygon whose label is nearest, not to draw order", () => {
    expect(areaAtPoint([west, east], { x: 55, y: 50 }, 1000)).toBe("west");
    expect(areaAtPoint([east, west], { x: 55, y: 50 }, 1000)).toBe("west");
  });

  it("returns nothing for a point outside every polygon", () => {
    expect(areaAtPoint([west, east], { x: 500, y: 500 }, 1000)).toBeNull();
  });

  it("finds a polygon in a wrapped copy of the world", () => {
    expect(areaAtPoint([west, east], { x: 1020, y: 20 }, 1000)).toBe("west");
    expect(areaAtPoint([west, east], { x: -880, y: 20 }, 1000)).toBe("east");
  });
});
