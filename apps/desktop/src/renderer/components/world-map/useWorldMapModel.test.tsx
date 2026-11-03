import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { EMPTY_LIVE_OVERLAY } from "./campaign-map-join.js";
import { DARK_MAP_PALETTE } from "./map-palette.js";
import { initialMapPrototypeState, type MapPrototypeState } from "./map-state.js";
import { projectionById } from "./projection.js";
import { useMapCamera, type MapCamera } from "./useMapCamera.js";
import { useWorldMapModel, type WorldMapModel } from "./useWorldMapModel.js";

const projection = projectionById("equirectangular");

interface ProbeProps {
  readonly state: MapPrototypeState;
  readonly onModel: (model: WorldMapModel) => void;
  readonly onCamera: (camera: MapCamera) => void;
}

function MapProbe({ state, onModel, onCamera }: ProbeProps) {
  const camera = useMapCamera(projection.width, projection.height, { wrapHorizontally: true });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const model = useWorldMapModel({
    state,
    route: null,
    overlay: EMPTY_LIVE_OVERLAY,
    projection,
    palette: DARK_MAP_PALETTE,
    camera,
    rootRef,
  });
  onModel(model);
  onCamera(camera);
  return (
    <div ref={rootRef}>
      <svg ref={camera.svgRef}>
        <g ref={camera.worldRef} />
      </svg>
    </div>
  );
}

function last<T>(items: readonly T[]): T {
  return items[items.length - 1] as T;
}

describe("useWorldMapModel render stability", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function mount(state: MapPrototypeState = initialMapPrototypeState) {
    vi.useFakeTimers();
    const models: WorldMapModel[] = [];
    const cameras: MapCamera[] = [];
    const view = render(
      <MapProbe
        state={state}
        onModel={(model) => models.push(model)}
        onCamera={(camera) => cameras.push(camera)}
      />,
    );
    act(() => {
      vi.runOnlyPendingTimers();
    });
    return { ...view, models, cameras };
  }

  it("keeps one model object and one set of closures across a re-render with unchanged inputs", () => {
    const { models, rerender } = mount();
    const settled = last(models);
    models.length = 0;

    rerender(
      <MapProbe
        state={initialMapPrototypeState}
        onModel={(model) => models.push(model)}
        onCamera={() => undefined}
      />,
    );

    const next = last(models);
    expect(next).toBe(settled);
    expect(next.fillFor).toBe(settled.fillFor);
    expect(next.strokeFor).toBe(settled.strokeFor);
    expect(next.nameFor).toBe(settled.nameFor);
    expect(next.describeAreaFor).toBe(settled.describeAreaFor);
    expect(next.anchorOf).toBe(settled.anchorOf);
    expect(next.portMarks).toBe(settled.portMarks);
    expect(next.placedLabels).toBe(settled.placedLabels);
  });

  it("recomputes the model when the camera moves", () => {
    const { models, cameras } = mount();
    const before = last(models);

    act(() => {
      last(cameras).panBy(120, 0);
      vi.runOnlyPendingTimers();
    });

    const after = last(models);
    expect(after).not.toBe(before);
    expect(after.placedLabels).not.toBe(before.placedLabels);
  });

  it("recomputes marks when the layer toggle changes the model input", () => {
    const { models, rerender } = mount();
    const before = last(models);
    const toggled: MapPrototypeState = {
      ...initialMapPrototypeState,
      layers: { ...initialMapPrototypeState.layers, labels: false },
    };

    rerender(
      <MapProbe
        state={toggled}
        onModel={(model) => models.push(model)}
        onCamera={() => undefined}
      />,
    );

    expect(last(models)).not.toBe(before);
    expect(last(models).placedLabels).toEqual([]);
  });
});
