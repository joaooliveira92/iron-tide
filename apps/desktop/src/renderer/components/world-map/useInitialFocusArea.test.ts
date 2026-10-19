import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { fixtureAnchor } from "./campaign-map-join.js";
import { projectionById } from "./projection.js";
import { HOME_FOCUS_SCALE, useInitialFocusArea } from "./useInitialFocusArea.js";

const projection = projectionById("equirectangular");

describe("useInitialFocusArea", () => {
  afterEach(cleanup);

  it("centres the camera on the home area's projected anchor at the home focus scale", () => {
    const focusOn = vi.fn();
    renderHook(() => useInitialFocusArea({ focusOn }, "eng_home_coast", projection, 0));
    const anchor = fixtureAnchor("area_north_sea");
    expect(anchor).not.toBeNull();
    expect(focusOn).toHaveBeenCalledTimes(1);
    expect(focusOn).toHaveBeenCalledWith(
      ...projection.project(anchor![0], anchor![1]),
      HOME_FOCUS_SCALE,
    );
  });

  it("leaves the camera at fit-world for a null or unmapped area", () => {
    const focusOn = vi.fn();
    const { rerender } = renderHook(
      ({ area }: { area: string | null }) => useInitialFocusArea({ focusOn }, area, projection, 0),
      { initialProps: { area: null as string | null } },
    );
    expect(focusOn).not.toHaveBeenCalled();

    rerender({ area: "not_a_real_area" });
    expect(focusOn).not.toHaveBeenCalled();
  });

  it("re-focuses only when the area changes, not on unrelated re-renders", () => {
    const focusOn = vi.fn();
    const { rerender } = renderHook(
      ({ area }) => useInitialFocusArea({ focusOn }, area, projection, 0),
      {
        initialProps: { area: "eng_home_coast" },
      },
    );
    expect(focusOn).toHaveBeenCalledTimes(1);

    rerender({ area: "eng_home_coast" });
    expect(focusOn).toHaveBeenCalledTimes(1);

    rerender({ area: "jpn_home_coast" });
    expect(focusOn).toHaveBeenCalledTimes(2);
  });
});
