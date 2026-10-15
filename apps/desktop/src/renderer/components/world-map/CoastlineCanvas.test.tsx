import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CoastlineCanvas } from "./CoastlineCanvas.js";
import { projectionById } from "./projection.js";
import type { MapCamera } from "./useMapCamera.js";

function fakeCamera(subscribe: MapCamera["subscribe"]): MapCamera {
  return {
    svgRef: { current: null },
    getTransform: () => ({ scale: 1, x: 0, y: 0 }),
    subscribe,
  } as unknown as MapCamera;
}

describe("CoastlineCanvas lifecycle", () => {
  beforeEach(() => {
    vi.stubGlobal("Path2D", class {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not restart (and discard its built tiers) when the parent re-renders with a new camera object", () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);
    const props = {
      polygons: [],
      projection: projectionById("miller"),
      centre: 0,
      fill: "#222",
      stroke: "#444",
    };
    const { rerender } = render(<CoastlineCanvas camera={fakeCamera(subscribe)} {...props} />);
    expect(subscribe).toHaveBeenCalledTimes(1);

    // The zoom-band state change re-renders the chart; useMapCamera hands back a new object.
    rerender(<CoastlineCanvas camera={fakeCamera(subscribe)} {...props} />);
    rerender(<CoastlineCanvas camera={fakeCamera(subscribe)} {...props} />);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("restarts when the geometry inputs genuinely change", () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);
    const base = {
      polygons: [],
      projection: projectionById("miller"),
      fill: "#222",
      stroke: "#444",
    };
    const { rerender } = render(
      <CoastlineCanvas camera={fakeCamera(subscribe)} centre={0} {...base} />,
    );
    rerender(<CoastlineCanvas camera={fakeCamera(subscribe)} centre={30} {...base} />);
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
