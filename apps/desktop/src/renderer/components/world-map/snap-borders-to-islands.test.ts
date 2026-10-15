import { describe, expect, it } from "vite-plus/test";
import { snapBordersToIslands } from "./snap-borders-to-islands.js";

const square = (x: number, y: number, size: number) => [
  [x, y, x + size, y, x + size, y + size, x, y + size, x, y],
];

describe("snapBordersToIslands", () => {
  it("replaces a coarse polygon over an island with the whole landmass", () => {
    const island = square(0, 0, 4);
    const coarse = square(-1, -1, 4.5);
    const [set] = snapBordersToIslands([{ id: "spain", polygons: [coarse] }], [island]);
    expect(set?.polygons).toEqual([island]);
  });

  it("leaves continents and unowned islands alone", () => {
    const continent = square(0, 0, 40);
    const coarse = square(0, 0, 20);
    const elsewhere = square(100, 50, 3);
    const [set] = snapBordersToIslands([{ id: "usa", polygons: [coarse] }], [continent, elsewhere]);
    expect(set?.polygons).toEqual([coarse]);
  });

  it("keeps a continental polygon that has islands inside its box", () => {
    const mainland = square(0, 0, 30);
    const corsica = square(10, 10, 2);
    const [set] = snapBordersToIslands([{ id: "france", polygons: [mainland] }], [corsica]);
    expect(set?.polygons).toEqual([mainland]);
  });

  it("keeps a mainland polygon under the island span that holds a small island", () => {
    const iberia = square(0, 0, 10);
    const mallorca = square(4, 4, 1);
    const [set] = snapBordersToIslands([{ id: "spain", polygons: [iberia] }], [mallorca]);
    expect(set?.polygons).toEqual([iberia]);
  });

  it("does not claim an island a border polygon only partly covers", () => {
    const island = square(0, 0, 10);
    const coarse = square(0, 0, 3);
    const [set] = snapBordersToIslands([{ id: "x", polygons: [coarse] }], [island]);
    expect(set?.polygons).toEqual([coarse]);
  });
});
