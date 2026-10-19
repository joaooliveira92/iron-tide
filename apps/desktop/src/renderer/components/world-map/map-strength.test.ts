import { describe, expect, it } from "vite-plus/test";
import {
  BAR_MAX_COMPACT,
  COMPACT_BELOW_PX,
  FLAG_CLUSTER_LIMIT,
  barHeight,
  compactGlyphs,
  buildRegionStrengths,
  describeStrength,
  type StrengthOptions,
} from "./map-strength.js";
import type { FleetPlacement } from "./map-markers.js";

const options: StrengthOptions = {
  nameFor: (nation) => (nation === null ? "Unclaimed" : `Nation ${nation}`),
  flagUrlFor: (nation) => (nation === null ? null : `flag://${nation}`),
};

function fleet(id: string, area: string, ships: number, owner: string | null): FleetPlacement {
  return { id, area, ships, owner };
}

describe("buildRegionStrengths", () => {
  it("sums ships per region and per nation from the fleets", () => {
    const [north] = buildRegionStrengths(
      [fleet("f1", "north", 3, "uk"), fleet("f2", "north", 2, "uk"), fleet("f3", "north", 4, "fr")],
      options,
    );
    expect(north?.areaId).toBe("north");
    expect(north?.total).toBe(9);
    expect(north?.nations.map((n) => [n.nation, n.ships])).toEqual([
      ["uk", 5],
      ["fr", 4],
    ]);
  });

  it("orders flags by ships descending, then by nation id, with unclaimed last", () => {
    const [region] = buildRegionStrengths(
      [
        fleet("a", "x", 2, "zz"),
        fleet("b", "x", 2, "aa"),
        fleet("c", "x", 2, null),
        fleet("d", "x", 5, "mm"),
      ],
      options,
    );
    expect(region?.nations.map((n) => n.nation)).toEqual(["mm", "aa", "zz", null]);
  });

  it("is independent of input order", () => {
    const fleets = [
      fleet("a", "x", 2, "zz"),
      fleet("b", "y", 7, "aa"),
      fleet("c", "x", 2, "aa"),
      fleet("d", "y", 1, "zz"),
    ];
    const forward = buildRegionStrengths(fleets, options);
    const backward = buildRegionStrengths([...fleets].reverse(), options);
    expect(backward).toEqual(forward);
  });

  it("omits regions with no ships instead of inventing a strength", () => {
    const regions = buildRegionStrengths(
      [
        fleet("a", "empty", 0, "uk"),
        fleet("b", "bad", Number.NaN, "uk"),
        fleet("c", "neg", -3, "uk"),
      ],
      options,
    );
    expect(regions).toEqual([]);
  });

  it("normalises bars against the strongest region, so the maximum is 1", () => {
    const regions = buildRegionStrengths(
      [fleet("a", "big", 10, "uk"), fleet("b", "small", 5, "uk"), fleet("c", "tiny", 1, "fr")],
      options,
    );
    const byId = new Map(regions.map((r) => [r.areaId, r]));
    expect(byId.get("big")?.fraction).toBe(1);
    expect(byId.get("small")?.fraction).toBe(0.5);
    expect(byId.get("tiny")?.fraction).toBeCloseTo(0.1);
  });

  it("gives tied regions identical bars", () => {
    const regions = buildRegionStrengths(
      [fleet("a", "p", 4, "uk"), fleet("b", "q", 4, "fr")],
      options,
    );
    expect(regions.map((r) => r.fraction)).toEqual([1, 1]);
  });

  it("caps the flag cluster and carries the rest as an overflow count", () => {
    const fleets = ["a", "b", "c", "d", "e"].map((n, i) => fleet(n, "x", 10 - i, n));
    const [region] = buildRegionStrengths(fleets, options);
    expect(region?.flags).toHaveLength(FLAG_CLUSTER_LIMIT);
    expect(region?.flags.map((f) => f.nation)).toEqual(["a", "b", "c"]);
    expect(region?.overflow).toBe(2);
    expect(region?.overflowShips).toBe(7 + 6);
    expect(region?.total).toBe(10 + 9 + 8 + 7 + 6);
  });

  it("has no overflow at or under the limit", () => {
    const [region] = buildRegionStrengths(
      [fleet("a", "x", 1, "a"), fleet("b", "x", 1, "b")],
      options,
    );
    expect(region?.overflow).toBe(0);
    expect(region?.overflowShips).toBe(0);
  });

  it("resolves flag art and display names through the injected lookups", () => {
    const [region] = buildRegionStrengths([fleet("a", "x", 2, "uk")], options);
    expect(region?.flags[0]).toMatchObject({
      nation: "uk",
      name: "Nation uk",
      flagUrl: "flag://uk",
      ships: 2,
    });
  });

  it("sorts regions by area id so rendering order is stable", () => {
    const regions = buildRegionStrengths(
      [fleet("a", "zeta", 1, "uk"), fleet("b", "alpha", 1, "uk")],
      options,
    );
    expect(regions.map((r) => r.areaId)).toEqual(["alpha", "zeta"]);
  });
});

describe("barHeight compact", () => {
  it("shortens every bar on a small map, keeping the order and a visible stub", () => {
    for (const fraction of [0.01, 0.25, 0.5, 1]) {
      expect(barHeight(fraction, true)).toBeLessThan(barHeight(fraction));
    }
    expect(barHeight(1, true)).toBe(BAR_MAX_COMPACT);
    expect(barHeight(0.01, true)).toBeGreaterThanOrEqual(5);
    expect(barHeight(0.25, true)).toBeLessThan(barHeight(0.5, true));
  });
});

describe("compactGlyphs", () => {
  it("is on only for a laid-out map shorter than the compact threshold", () => {
    expect(compactGlyphs(0)).toBe(false); // not laid out yet
    expect(compactGlyphs(COMPACT_BELOW_PX - 1)).toBe(true);
    expect(compactGlyphs(COMPACT_BELOW_PX)).toBe(false);
    expect(compactGlyphs(900)).toBe(false);
  });
});

describe("barHeight", () => {
  it("keeps a visible stub for the weakest region and tops out at the maximum", () => {
    expect(barHeight(0.01)).toBeGreaterThanOrEqual(6);
    expect(barHeight(1)).toBe(44);
    expect(barHeight(0.5)).toBeLessThan(barHeight(1));
  });
});

describe("describeStrength", () => {
  it("names the total and every nation, not only the flags shown", () => {
    const fleets = ["a", "b", "c", "d"].map((n, i) => fleet(n, "x", 4 - i, n));
    const [region] = buildRegionStrengths(fleets, options);
    expect(describeStrength(region!)).toBe(
      "strength 10 ships (Nation a 4, Nation b 3, Nation c 2, Nation d 1)",
    );
  });

  it("uses the singular for one ship", () => {
    const [region] = buildRegionStrengths([fleet("a", "x", 1, "uk")], options);
    expect(describeStrength(region!)).toBe("strength 1 ship (Nation uk 1)");
  });
});
