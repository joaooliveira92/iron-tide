import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { MapMinimap } from "./MapMinimap.js";
import { projectionById } from "./projection.js";
import type { MapCamera } from "./useMapCamera.js";

const projection = projectionById("miller");

function setup() {
  const focusOn = vi.fn();
  const subscribe = vi.fn(() => () => undefined);
  const camera = {
    svgRef: { current: null },
    getPixelsPerUnit: () => 1,
    getViewport: () => ({ left: 0, top: 0, width: projection.width, height: projection.height }),
    getTransform: () => ({ scale: 2, x: 0, y: 0 }),
    subscribe,
    focusOn,
  } as unknown as MapCamera;
  render(
    <MapMinimap
      camera={camera}
      projection={projection}
      centre={0}
      polygons={[]}
      land="#333"
      ocean="#111"
      ink="#eee"
      borderColor="#444"
    />,
  );
  const minimap = screen.getByTestId("map-minimap");
  vi.spyOn(minimap, "getBoundingClientRect").mockReturnValue({
    left: 10,
    top: 20,
    width: 200,
    height: 100,
    right: 210,
    bottom: 120,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  });
  return { minimap, focusOn, subscribe };
}

describe("MapMinimap", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("is decorative for assistive tech (keyboard pan/zoom is the accessible path)", () => {
    const { minimap } = setup();
    expect(minimap.getAttribute("aria-hidden")).toBe("true");
  });

  it("follows the camera by subscription and draws the view rectangle", () => {
    const { minimap, subscribe } = setup();
    expect(subscribe).toHaveBeenCalledTimes(1);
    const visible = [...minimap.querySelectorAll("rect")].filter(
      (rect) => rect.getAttribute("visibility") === "visible",
    );
    expect(visible).toHaveLength(1);
    // scale 2 => half the world on each axis.
    expect(Number(visible[0]?.getAttribute("width"))).toBeCloseTo(projection.width / 2, 5);
  });

  it("recentres the main view on click, keeping the current zoom", () => {
    const { minimap, focusOn } = setup();
    fireEvent.pointerDown(minimap, { clientX: 110, clientY: 70, pointerId: 1 });
    expect(focusOn).toHaveBeenCalledTimes(1);
    const [x, y, scale] = focusOn.mock.calls[0] as [number, number, number];
    expect(x).toBeCloseTo(projection.width * 0.5, 5);
    expect(y).toBeCloseTo(projection.height * 0.5, 5);
    expect(scale).toBe(2);
  });

  it("recentres while dragging with the primary button, not on plain hover", () => {
    const { minimap, focusOn } = setup();
    fireEvent.pointerMove(minimap, { clientX: 60, clientY: 40, buttons: 0 });
    expect(focusOn).not.toHaveBeenCalled();
    fireEvent.pointerMove(minimap, { clientX: 60, clientY: 40, buttons: 1 });
    expect(focusOn).toHaveBeenCalledTimes(1);
  });
});
