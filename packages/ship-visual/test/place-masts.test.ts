import { describe, expect, it } from "vite-plus/test";
import { placeMasts, type MastSurface } from "../src/index.js";
import { catalog, mast } from "./fixtures.js";

const surface: MastSurface = {
  x: (p) => p,
  deckY: () => 50,
  houseTopY: (p) => (p >= 300 && p <= 600 ? 40 : undefined),
  pxPerM: 2,
  topY: 10,
};

const masts = catalog(
  [],
  [mast("x-v-mast", "X", "VICTORIAN"), mast("x-d-mast", "X", "DREADNOUGHT")],
);

describe("placeMasts", () => {
  it("stands each mast on the house top at its station, in station order", () => {
    const placed = placeMasts(masts, { style: "B", era: "VICTORIAN" }, [600, 360], surface);
    expect(placed).toEqual([
      expect.objectContaining({ stationPermille: 360, partId: "x-v-mast", step: 2, x: 360, y: 40 }),
      expect.objectContaining({ stationPermille: 600, partId: "x-v-mast", step: 2, x: 600, y: 40 }),
    ]);
  });

  it("draws at the profile scale when the mast fits under the top pad", () => {
    const [m] = placeMasts(masts, { style: "X", era: "VICTORIAN" }, [400], {
      ...surface,
      pxPerM: 1.5,
    });
    expect(m).toMatchObject({ scaleX: 1.5, scaleY: 1.5 });
  });

  it("shrinks the whole mast, keeping its proportions, so the masthead never rises above the top pad", () => {
    const [m] = placeMasts(masts, { style: "X", era: "VICTORIAN" }, [400], surface);
    expect(m).toMatchObject({ scaleX: 1.5, scaleY: 1.5 });
  });

  it("seats on the deck outside the superstructure, and falls back to the dreadnought mast", () => {
    const [m] = placeMasts(masts, { style: "B", era: "LATE_DREADNOUGHT" }, [800], surface);
    expect(m).toMatchObject({ partId: "x-d-mast", step: 4, y: 50 });
  });

  it("draws nothing without stations or without any mast drawing", () => {
    expect(placeMasts(masts, { style: "X", era: "VICTORIAN" }, [], surface)).toEqual([]);
    expect(placeMasts(catalog([]), { style: "X", era: "VICTORIAN" }, [400], surface)).toEqual([]);
  });
});
