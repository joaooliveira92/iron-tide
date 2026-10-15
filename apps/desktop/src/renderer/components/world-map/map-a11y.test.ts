import { describe, expect, it } from "vite-plus/test";
import { areaMetricText, buildOwnershipRows, describeArea, filterAreaRows } from "./map-a11y.js";

describe("describeArea", () => {
  it("states ownership and fleet count in words", () => {
    expect(
      describeArea({
        id: "a",
        name: "North Sea",
        owner: "Britain",
        fleets: 2,
        possessions: 1,
        selected: false,
      }),
    ).toBe("North Sea: held by Britain, 2 fleets");
    expect(
      describeArea({
        id: "b",
        name: "Baltic",
        owner: null,
        fleets: 1,
        possessions: 0,
        selected: false,
      }),
    ).toBe("Baltic: unclaimed, 1 fleet");
    expect(
      describeArea({
        id: "c",
        name: "Arctic",
        owner: "Russia",
        fleets: 0,
        possessions: 0,
        selected: false,
      }),
    ).toBe("Arctic: held by Russia, no fleets");
  });
});

describe("buildOwnershipRows", () => {
  it("sorts by name and marks the selection", () => {
    const rows = buildOwnershipRows(
      [
        { id: "z", name: "Zanzibar" },
        { id: "a", name: "Aden" },
      ],
      (id) => (id === "a" ? "Britain" : null),
      (id) => (id === "z" ? 3 : 0),
      (id) => (id === "a" ? 2 : 0),
      "z",
    );
    expect(rows.map((r) => r.name)).toEqual(["Aden", "Zanzibar"]);
    expect(rows[0]).toMatchObject({ owner: "Britain", fleets: 0, possessions: 2, selected: false });
    expect(rows[1]).toMatchObject({ owner: null, fleets: 3, selected: true });
  });
});

describe("filterAreaRows", () => {
  const rows = [
    { id: "a", name: "North Sea", owner: "Britain", fleets: 2, possessions: 1, selected: false },
    { id: "b", name: "Baltic", owner: "Germany", fleets: 0, possessions: 0, selected: false },
    { id: "c", name: "Arabian Sea", owner: null, fleets: 0, possessions: 0, selected: false },
  ];

  it("keeps everything for an empty or blank query", () => {
    expect(filterAreaRows(rows, "")).toEqual(rows);
    expect(filterAreaRows(rows, "   ")).toEqual(rows);
  });

  it("matches the area name or the owner, ignoring case and surrounding spaces", () => {
    expect(filterAreaRows(rows, " sea ").map((r) => r.id)).toEqual(["a", "c"]);
    expect(filterAreaRows(rows, "GERMANY").map((r) => r.id)).toEqual(["b"]);
  });

  it("lets the player find unclaimed areas by typing 'unclaimed'", () => {
    expect(filterAreaRows(rows, "unclaimed").map((r) => r.id)).toEqual(["c"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterAreaRows(rows, "zzz")).toEqual([]);
  });
});

describe("areaMetricText", () => {
  const row = { id: "a", name: "A", owner: null, fleets: 1, possessions: 3, selected: false };

  it("words the count for the chosen metric, singular and plural", () => {
    expect(areaMetricText(row, "ships")).toBe("1 fleet");
    expect(areaMetricText({ ...row, fleets: 2 }, "ships")).toBe("2 fleets");
    expect(areaMetricText(row, "possessions")).toBe("3 possessions");
    expect(areaMetricText({ ...row, possessions: 1 }, "possessions")).toBe("1 possession");
  });

  it("shows nothing for an area with none, so empty areas stay quiet", () => {
    expect(areaMetricText({ ...row, fleets: 0 }, "ships")).toBeNull();
    expect(areaMetricText({ ...row, possessions: 0 }, "possessions")).toBeNull();
  });
});
