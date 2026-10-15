import { describe, expect, it } from "vite-plus/test";
import { placeMounts, type ProfileSurface, type VisualMountInput } from "../src/index.js";
import { catalog, mount } from "./fixtures.js";

/** 1 px per permille; deck at y 50; a house top at y 40 over 300–600‰; 2 px per metre. */
const surface: ProfileSurface = {
  x: (p) => p,
  deckY: () => 50,
  houseTopY: (p) => (p >= 300 && p <= 600 ? 40 : undefined),
  pxPerM: 2,
};

const all = catalog(
  (["SMALL", "MEDIUM", "LARGE"] as const).flatMap((size) =>
    (["TURRET", "BARBETTE", "SHIELDED", "OPEN", "CASEMATE"] as const).map((mountClass) =>
      mount(`x-d-${size}-${mountClass}`, {
        style: "X",
        era: "DREADNOUGHT",
        sizes: [size],
        mountClass,
      }),
    ),
  ),
);

const gun = (over: Partial<VisualMountInput>): VisualMountInput => ({
  instanceId: "m",
  stationPermille: 200,
  side: "CENTRE",
  category: "MAIN_GUN",
  mountType: "TURRET",
  gunCount: 2,
  caliberUm: 304_800,
  ...over,
});

const place = (inputs: readonly VisualMountInput[], pxPerM = 2) =>
  placeMounts(all, inputs, { style: "X", era: "DREADNOUGHT" }, { ...surface, pxPerM });

describe("placeMounts", () => {
  it("seats a forward 12-inch turret on the deck at its station, at full scale, facing the bow", () => {
    const [m] = place([gun({})]).placed;
    expect(m).toMatchObject({
      instanceId: "m",
      partId: "x-d-LARGE-TURRET",
      step: 1,
      mountClass: "TURRET",
      size: "LARGE",
      guns: 2,
      facing: "BOW",
      far: false,
      symbols: [{ x: 200, y: 50, scale: 2 }],
    });
  });

  it("faces the stern from amidships aft", () => {
    expect(place([gun({ stationPermille: 500 })]).placed[0]!.facing).toBe("STERN");
  });

  it("seats on the house top inside the superstructure", () => {
    expect(place([gun({ stationPermille: 400 })]).placed[0]!.symbols[0]).toMatchObject({ y: 40 });
  });

  it("draws a casemate battery as one single-gun symbol per gun, in the hull side, scaled by calibre", () => {
    const [m] = place([
      gun({
        mountType: "CASEMATE",
        gunCount: 3,
        caliberUm: 152_400,
        side: "STBD",
        stationPermille: 400,
      }),
    ]).placed;
    expect(m!.guns).toBe(1);
    // 6/12 of 2 px/m = 1 px/m; a 10 m body is 10 px, so the pitch is 11.5 px; seated at the deck edge (y 50).
    expect(m!.symbols).toEqual([
      { x: 388.5, y: 50, scale: 1 },
      { x: 400, y: 50, scale: 1 },
      { x: 411.5, y: 50, scale: 1 },
    ]);
  });

  it("clamps a multi-gun mount's drawn guns to 1–4 but keeps the true count", () => {
    const [m] = place([gun({ gunCount: 6 })]).placed;
    expect(m).toMatchObject({ guns: 4, gunCount: 6 });
  });

  it("clamps the calibre factor and keeps a symbol at least 4 px wide", () => {
    // 1 in: factor clamps to 0.3, so 0.6 px/m and a 6 px body.
    expect(place([gun({ caliberUm: 25_400 })]).placed[0]!.symbols[0]!.scale).toBeCloseTo(0.6);
    // 18 in: factor clamps to 1.5.
    expect(place([gun({ caliberUm: 457_200 })]).placed[0]!.symbols[0]!.scale).toBeCloseTo(3);
    // At 0.5 px/m a 1 in body would be 1.5 px; the floor lifts it to 4 px (0.4 px/m).
    expect(place([gun({ caliberUm: 25_400 })], 0.5).placed[0]!.symbols[0]!.scale).toBeCloseTo(0.4);
  });

  it("draws port-side mounts first and marks them as on the far side", () => {
    const { placed } = place([
      gun({ instanceId: "s", side: "STBD", stationPermille: 100 }),
      gun({ instanceId: "c", stationPermille: 300 }),
      gun({ instanceId: "p2", side: "PORT", stationPermille: 900 }),
      gun({ instanceId: "p1", side: "PORT", stationPermille: 100 }),
    ]);
    expect(placed.map((m) => m.instanceId)).toEqual(["p1", "p2", "c", "s"]);
    expect(placed.map((m) => m.far)).toEqual([true, true, false, false]);
  });

  it("skips non-guns silently and reports guns it cannot size", () => {
    const result = place([
      gun({ instanceId: "boiler", category: "BOILER", mountType: undefined }),
      gun({ instanceId: "tube", category: "TORPEDO_TUBE", mountType: "ABOVE_WATER_TUBE" }),
      gun({ instanceId: "nocal", caliberUm: undefined }),
    ]);
    expect(result.placed).toEqual([]);
    expect(result.unresolved).toEqual(["nocal"]);
  });

  it("is deterministic: the same inputs in any order give the same output", () => {
    const inputs = [
      gun({ instanceId: "a", stationPermille: 700 }),
      gun({ instanceId: "b", stationPermille: 700 }),
      gun({ instanceId: "c", stationPermille: 100, side: "PORT" }),
    ];
    expect(place([...inputs].reverse())).toEqual(place(inputs));
  });
});
