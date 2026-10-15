import { describe, expect, it } from "vite-plus/test";
import {
  buildFleetMarks,
  buildPortMarks,
  clearOfPorts,
  fleetSingles,
  portSingles,
  type FleetMark,
  type PortMark,
} from "./map-markers.js";
import { projectionById } from "./projection.js";

const projection = projectionById("equirectangular");

const port = (over: Partial<PortMark> = {}): PortMark => ({
  id: "p",
  name: "P",
  ux: 0,
  uy: 0,
  owner: null,
  major: true,
  count: 1,
  ...over,
});

const fleet = (over: Partial<FleetMark> = {}): FleetMark => ({
  id: "f",
  ux: 0,
  uy: 0,
  ships: 3,
  owner: "britain",
  count: 1,
  ...over,
});

describe("portSingles", () => {
  it("projects each possession and reads its base rank", () => {
    const marks = portSingles(
      [{ id: "p1", name: "Gibraltar", at: [0, 0], owner: "britain", base: "major" }],
      projection,
      0,
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({
      id: "p1",
      name: "Gibraltar",
      owner: "britain",
      major: true,
      count: 1,
    });
    expect(marks[0]?.ux).toBeCloseTo(1000);
    expect(marks[0]?.uy).toBeCloseTo(500);
  });
});

describe("fleetSingles", () => {
  it("fans fleets around their area anchor and drops unmapped areas", () => {
    const anchors = new Map([["area_a", [100, 200] as const]]);
    const marks = fleetSingles(
      [
        { id: "f0", area: "area_a", ships: 3, owner: "britain" },
        { id: "f1", area: "area_a", ships: 2, owner: "britain" },
        { id: "f2", area: "area_a", ships: 1, owner: "britain" },
        { id: "f3", area: "area_a", ships: 4, owner: "britain" },
        { id: "missing", area: "area_x", ships: 9, owner: "britain" },
      ],
      anchors,
    );
    expect(marks.map((mark) => mark.id)).toEqual(["f0", "f1", "f2", "f3"]);
    expect(marks[0]).toMatchObject({ ux: 84, uy: 218, count: 1 });
    expect(marks[1]?.ux).toBe(100);
    expect(marks[2]?.ux).toBe(116);
    expect(marks[3]?.ux).toBe(84);
  });
});

describe("buildPortMarks", () => {
  const singles: readonly PortMark[] = [
    port({ id: "a", ux: 0, owner: "britain", major: false }),
    port({ id: "b", ux: 10, owner: "france", major: true }),
    port({ id: "c", ux: 100, owner: "britain", major: false }),
  ];

  it("leaves every dot alone above the home zoom band", () => {
    const out = buildPortMarks(singles, false, 1);
    expect(out.map((mark) => mark.id)).toEqual(["a", "b", "c"]);
    expect(out[0]).not.toBe(singles[0]);
  });

  it("merges dots within a dot's width and nulls a mixed owner", () => {
    const out = buildPortMarks(singles, true, 1);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ count: 2, owner: null, major: true });
    expect(out[0]?.ux).toBeCloseTo(5);
    expect(out[0]?.uy).toBeCloseTo(0);
  });

  it("keeps a shared owner and non-major rank a cluster agrees on", () => {
    const out = buildPortMarks(
      [
        port({ id: "a", ux: 0, owner: "britain", major: false }),
        port({ id: "b", ux: 10, owner: "britain", major: false }),
      ],
      true,
      1,
    );
    expect(out[0]?.owner).toBe("britain");
    expect(out[0]?.major).toBe(false);
  });
});

describe("clearOfPorts", () => {
  it("pushes a fleet clear of a port it overlaps", () => {
    const [moved] = clearOfPorts([fleet()], [port()], 1);
    expect(moved?.uy).toBe(14);
    expect(moved?.ux).toBe(0);
  });

  it("leaves a fleet that does not overlap", () => {
    const [moved] = clearOfPorts([fleet({ uy: 200 })], [port()], 1);
    expect(moved?.uy).toBe(200);
  });
});

describe("buildFleetMarks", () => {
  it("collapses nearby fleets above the home band, summing ships", () => {
    const out = buildFleetMarks(
      [fleet({ id: "f0", ux: 0, ships: 3 }), fleet({ id: "f1", ux: 10, ships: 2 })],
      true,
      1,
      [],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ count: 2, ships: 5, owner: "britain" });
    expect(out[0]?.ux).toBeCloseTo(5);
  });

  it("clears badges of ports at the home band too", () => {
    const out = buildFleetMarks([fleet({ owner: null })], true, 1, [port()]);
    expect(out[0]?.uy).toBe(14);
  });
});
