import { describe, expect, it } from "vite-plus/test";
import { projectionById, type ProjectedArea } from "./projection.js";
import { layoutLabels, type LabelLayoutRequest } from "./map-label-layout.js";
import type { PortMark } from "./map-markers.js";

const projection = projectionById("equirectangular");

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
    flags: { possessions: true, fleets: true, passages: true },
    portMarks: [],
    fleetMarks: [],
    passageAnchors: [],
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
