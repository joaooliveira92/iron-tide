import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";

import type { AppCameraState } from "../globe-adapter/camera-contract.js";
import { SharedWorldMapProvider } from "./shared-world-map.js";
import { useWorldMapController } from "./useWorldMapController.js";

const FRANCE_CAMERA: AppCameraState = {
  version: 1,
  centre: [2.4, 46.6],
  zoom: 5.5,
  bearing: 0,
  pitch: 20,
  projection: "globe",
};

function wrapper({ children }: { readonly children: ReactNode }) {
  return <SharedWorldMapProvider>{children}</SharedWorldMapProvider>;
}

describe("shared world map state", () => {
  it("keeps map state and camera when the consuming screen is replaced", () => {
    const overview = renderHook(() => useWorldMapController(null), { wrapper });
    act(() => {
      overview.result.current.onSelect("area_north_sea");
      overview.result.current.onSetProjection("equirectangular");
      overview.result.current.onCameraChange?.(FRANCE_CAMERA);
    });
    expect(overview.result.current.state.selected).toBe("area_north_sea");
    expect(overview.result.current.camera).toEqual(FRANCE_CAMERA);
  });

  it("gives two screens under one provider the same state", () => {
    const { result } = renderHook(
      () => ({
        overview: useWorldMapController(null),
        map: useWorldMapController(null),
      }),
      { wrapper },
    );
    act(() => {
      result.current.overview.onSelect("area_north_sea");
      result.current.overview.onCameraChange?.(FRANCE_CAMERA);
    });
    expect(result.current.map.state.selected).toBe("area_north_sea");
    expect(result.current.map.camera).toEqual(FRANCE_CAMERA);
  });

  it("starts without a camera so the globe frames the home area", () => {
    const { result } = renderHook(() => useWorldMapController(null), { wrapper });
    expect(result.current.camera).toBeNull();
  });

  it("still works standalone, with local state and no camera reporting", () => {
    const { result } = renderHook(() => useWorldMapController(null));
    act(() => result.current.onSelect("area_north_sea"));
    expect(result.current.state.selected).toBe("area_north_sea");
    expect(result.current.camera).toBeNull();
    expect(result.current.onCameraChange).toBeUndefined();
  });
});
