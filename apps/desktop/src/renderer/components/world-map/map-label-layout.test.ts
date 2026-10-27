import { describe, expect, it } from "vite-plus/test";
import { projectionById, type ProjectedArea } from "./projection.js";
import { layoutLabels, type LabelLayoutRequest } from "./map-label-layout.js";
import type { PortMark } from "./map-markers.js";
import { strengthExtent } from "./layers/StrengthLayer.js";
import { buildRegionStrengths } from "./map-strength.js";

const projection = projectionById("equirectangular");

const glyphRegion = buildRegionStrengths([{ id: "f", area: "big", ships: 5, owner: "uk" }], {
  nameFor: () => "UK",
  flagUrlFor: () => null,
})[0]!;

function fakeSvg(width: number, height: number): SVGSVGElement {
  return {
    clientWidth: width,
    getScreenCTM: () => ({ a: 1, d: 1, e: 0, f: 0 }),
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
    }),
  } as unknown as SVGSVGElement;
}

function fakeRootCoveringEverything(): HTMLElement {
  return {
    querySelectorAll: () => [
      {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 6000,
          height: 1200,
          right: 6000,
          bottom: 1200,
        }),
      },
    ],
  } as unknown as HTMLElement;
}

function request(overrides: Partial<LabelLayoutRequest> = {}): LabelLayoutRequest {
  return {
    areas: [],
    areaName: () => undefined,
    projection,
    centre: 0,
    flags: { possessions: true, fleets: true },
    portMarks: [],
    fleetMarks: [],
    strengthMarks: [],
    transform: { scale: 1, x: 0, y: 0 },
    minScale: 1,
    turns: [0],
    svg: fakeSvg(6000, 1200),
    root: null,
    ...overrides,
  };
}

const area = (id: string, label: readonly [number, number], size: number): ProjectedArea => ({
  id,
  path: "M0 0",
  ring: [],
  label,
  centroid: label,
  bounds: { width: size, height: size },
});

describe("layoutLabels", () => {
  it("places a country name at its anchor with no nudge when unobstructed", () => {
    const labels = layoutLabels(request());
    const uk = labels.find((entry) => entry.spec.key === "country:United Kingdom");
    expect(uk).toBeDefined();
    expect(uk).toMatchObject({ turn: 0, dx: 0, dy: 0 });
    expect(uk?.spec.text).toBe("United Kingdom");
  });

  it("ranks countries above continents", () => {
    expect(layoutLabels(request())[0]?.spec.kind).toBe("country");
  });

  it("drops every name that would sit under floating chrome", () => {
    const labels = layoutLabels(request({ root: fakeRootCoveringEverything() }));
    expect(labels).toEqual([]);
  });

  it("shows a big sea when zoomed out, but not a small one", () => {
    const labels = layoutLabels(
      request({
        areas: [area("big", [300, 300], 200), area("small", [800, 300], 100)],
        areaName: (id) => (id === "big" ? "North Sea" : "Gulf"),
      }),
    );
    const texts = labels.map((entry) => entry.spec.text);
    expect(texts).toContain("North Sea");
    expect(texts).not.toContain("Gulf");
  });

  it("keeps a sea's name beside its strength glyph: the glyph is an obstacle, and the name stays", () => {
    const big = area("big", [300, 300], 200);
    const base = { areas: [big], areaName: () => "North Sea" };
    const clear = layoutLabels(request(base)).find((entry) => entry.spec.text === "North Sea");
    expect(clear).toMatchObject({ dx: 0, dy: 0 });

    const covering = layoutLabels(
      request({
        ...base,
        strengthMarks: [{ ux: 300, uy: 300, hw: 40, top: -20, bottom: 10 }],
      }),
    ).find((entry) => entry.spec.text === "North Sea");
    expect(covering === undefined || covering.dx !== 0 || covering.dy !== 0).toBe(true);

    const above = layoutLabels(
      request({
        ...base,
        strengthMarks: [{ ux: 300, uy: 300, hw: 26, ...strengthExtent(glyphRegion) }],
      }),
    ).find((entry) => entry.spec.text === "North Sea");
    expect(above).toMatchObject({ dx: 0, dy: 0 });
  });

  it("does not let a port's name sit on a strength glyph pinned at the same point", () => {
    const port: PortMark = {
      id: "p1",
      name: "Algiers",
      ux: 500,
      uy: 400,
      owner: "france",
      major: true,
      count: 1,
    };
    const glyph = { ux: 500, uy: 400, hw: 40, top: -30, bottom: 30 };
    const labels = layoutLabels(
      request({ portMarks: [port], strengthMarks: [glyph], minScale: 0.25 }),
    );
    const name = labels.find((entry) => entry.spec.text === "Algiers");
    expect(name === undefined || Math.abs(name.dx) >= 40 || Math.abs(name.dy) >= 30).toBe(true);
  });

  it("only names a major port once zoomed past its window", () => {
    const port: PortMark = {
      id: "p1",
      name: "Gibraltar",
      ux: 500,
      uy: 400,
      owner: "britain",
      major: true,
      count: 1,
    };
    const zoomedOut = layoutLabels(request({ portMarks: [port] }));
    expect(zoomedOut.some((entry) => entry.spec.kind === "port")).toBe(false);
    const zoomedIn = layoutLabels(request({ portMarks: [port], minScale: 0.25 }));
    expect(
      zoomedIn.some((entry) => entry.spec.kind === "port" && entry.spec.text === "Gibraltar"),
    ).toBe(true);
  });

  it("draws one copy of a name per requested world turn", () => {
    const labels = layoutLabels(request({ turns: [0, 1] }));
    expect(labels.some((entry) => entry.turn === 0)).toBe(true);
    expect(labels.some((entry) => entry.turn === 1)).toBe(true);
  });
});
