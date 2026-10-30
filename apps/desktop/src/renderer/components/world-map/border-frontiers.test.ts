import { describe, expect, it } from "vite-plus/test";
import { decodeCoastline } from "../../lib/coastline-codec.js";
import { BORDERS_1880 } from "./borders-1880-data.js";
import { BORDER_FRONTIERS_1880 } from "./borders-1880-frontiers-data.js";
import { COASTLINE_BASE64 } from "./coastline-data.js";
import { deriveBorderFrontiers } from "./border-frontiers.js";

function decodedCoast() {
  return decodeCoastline(Buffer.from(COASTLINE_BASE64, "base64").buffer);
}

describe("border frontiers", () => {
  it("keeps inland rings whole and drops the runs that hug the coast", () => {
    const coast = [[[0, 0, 10, 0, 10, 10, 0, 10]]];
    const borders = {
      inland: [[[2, 2, 8, 2, 8, 8, 2, 8]]],
      coastal: [[[0, 2, 0, 5, 2, 5, 2, 8, 0, 8]]],
      island: [[[0, 0, 10, 0, 10, 10, 0, 10]]],
    };

    expect(deriveBorderFrontiers(borders, coast)).toEqual({
      inland: [[2, 2, 8, 2, 8, 8, 2, 8, 2, 2]],
      coastal: [[2, 5, 2, 8]],
      island: [],
    });
  });

  it("covers the same nations as the baked borders", () => {
    expect(Object.keys(BORDER_FRONTIERS_1880).sort()).toEqual(Object.keys(BORDERS_1880).sort());
  });

  it("holds open lon/lat polylines", () => {
    for (const [nation, lines] of Object.entries(BORDER_FRONTIERS_1880)) {
      for (const line of lines) {
        expect(line.length % 2, nation).toBe(0);
        expect(line.length, nation).toBeGreaterThanOrEqual(4);
        for (let index = 0; index < line.length; index += 2) {
          expect(Math.abs(line[index] as number), nation).toBeLessThanOrEqual(180);
          expect(Math.abs(line[index + 1] as number), nation).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it("matches the checked-in bake and never follows the coastline", () => {
    expect(deriveBorderFrontiers(BORDERS_1880, decodedCoast())).toEqual(BORDER_FRONTIERS_1880);
  });
});
