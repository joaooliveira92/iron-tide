import { describe, expect, it } from "vite-plus/test";
import {
  PLOT_CENTER,
  PLOT_INNER_RADIUS,
  PLOT_OUTER_RADIUS,
  nationCode,
  percentAt,
  plotLayout,
  shortNationName,
  tensionRadius,
} from "./diplomacy-plot.js";

describe("tensionRadius", () => {
  it("puts the most tense nations nearest the centre and clamps out-of-range values", () => {
    expect(tensionRadius(0)).toBe(PLOT_OUTER_RADIUS);
    expect(tensionRadius(10)).toBe(PLOT_INNER_RADIUS);
    expect(tensionRadius(-4)).toBe(PLOT_OUTER_RADIUS);
    expect(tensionRadius(99)).toBe(PLOT_INNER_RADIUS);
    expect(tensionRadius(7)).toBeLessThan(tensionRadius(5));
  });
});

describe("nationCode", () => {
  it("uses the first distinctive word of the name", () => {
    expect(nationCode("Russian Empire")).toBe("RUS");
    expect(nationCode("Empire of Brazil")).toBe("BRA");
    expect(nationCode("Austro-Hungarian Empire")).toBe("AUS");
    expect(nationCode("Kingdom of Italy")).toBe("ITA");
    expect(nationCode("Netherlands")).toBe("NET");
  });

  it("falls back to initials when every word is generic", () => {
    expect(nationCode("United States")).toBe("US");
  });
});

describe("plotLayout", () => {
  const rows = [
    { partnerNationId: "spain", partnerName: "Spain", tension: 5 },
    { partnerNationId: "brazil", partnerName: "Brazil", tension: 5 },
    { partnerNationId: "france", partnerName: "France", tension: 9 },
  ];

  it("is independent of input order and spreads nations evenly around the centre", () => {
    const forward = plotLayout(rows);
    const reversed = plotLayout([...rows].reverse());
    expect(forward).toEqual(reversed);
    expect(forward.map((n) => n.id)).toEqual(["brazil", "france", "spain"]);
    expect(forward.map((n) => n.angle)).toEqual([-30, 90, 210]);
  });

  it("places each nation on the ring for its tension and never on the vertical axis", () => {
    const nodes = plotLayout(rows);
    const france = nodes.find((n) => n.id === "france")!;
    const brazil = nodes.find((n) => n.id === "brazil")!;
    expect(france.radius).toBe(tensionRadius(9));
    expect(france.radius).toBeLessThan(brazil.radius);
    expect(nodes.every((n) => n.angle !== -90)).toBe(true);
  });

  it("returns nothing for an empty roster", () => {
    expect(plotLayout([])).toEqual([]);
  });
});

describe("shortNationName", () => {
  it("drops the generic title so map labels stay short", () => {
    expect(shortNationName("Russian Empire")).toBe("Russian");
    expect(shortNationName("Kingdom of Italy")).toBe("Italy");
    expect(shortNationName("Empire of Brazil")).toBe("Brazil");
    expect(shortNationName("French Republic")).toBe("French");
    expect(shortNationName("Netherlands")).toBe("Netherlands");
  });

  it("keeps the full name when nothing distinctive is left", () => {
    expect(shortNationName("Grand Duchy")).toBe("Grand Duchy");
  });
});

describe("percentAt", () => {
  it("maps plot coordinates onto the padded plot box", () => {
    expect(percentAt(-110, -20)).toEqual({ left: "0%", top: "0%" });
    expect(percentAt(PLOT_CENTER, PLOT_CENTER)).toEqual({ left: "50%", top: "50%" });
  });
});
