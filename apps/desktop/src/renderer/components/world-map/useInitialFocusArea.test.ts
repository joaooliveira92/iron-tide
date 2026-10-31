import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { AREA_ANCHORS } from "./campaign-anchors.js";
import { projectionById } from "./projection.js";
import { HOME_FOCUS_SCALE, nationFocusPoint, useInitialFocusArea } from "./useInitialFocusArea.js";

const projection = projectionById("equirectangular");

describe("useInitialFocusArea", () => {
  afterEach(cleanup);

  it("centres the camera on the home area's projected anchor at the home focus scale", () => {
    const focusOn = vi.fn();
    renderHook(() => useInitialFocusArea({ focusOn }, "eng_home_coast", projection, 0));
    const anchor = AREA_ANCHORS["eng_home_coast"]!;
    expect(focusOn).toHaveBeenCalledTimes(1);
    expect(focusOn).toHaveBeenCalledWith(
      ...projection.project(anchor[0], anchor[1]),
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

  it("frames a nation's land together with its home waters", () => {
    const focusOn = vi.fn();
    renderHook(() => useInitialFocusArea({ focusOn }, "eng_home_coast", projection, 0, "germany"));
    const anchor = AREA_ANCHORS["eng_home_coast"]!;
    const target = nationFocusPoint(anchor, "germany");
    expect(target).not.toEqual(anchor);
    expect(focusOn).toHaveBeenCalledWith(
      ...projection.project(target[0], target[1]),
      HOME_FOCUS_SCALE,
    );
  });
});

describe("nationFocusPoint", () => {
  const anchor = [3, 56] as const;
  const square = (x0: number, y0: number, x1: number, y1: number) => [
    [x0, y0, x1, y0, x1, y1, x0, y1],
  ];

  it("centres on the main landmass and the waters together", () => {
    const borders = { de: [square(6, 47, 23, 55), square(8, 54, 9, 55)] };
    expect(nationFocusPoint(anchor, "de", borders)).toEqual([13, 51.5]);
  });

  it("keeps the waters' anchor for a continent, an unknown nation, or no nation", () => {
    const borders = { big: [square(-120, 30, -70, 50)] };
    expect(nationFocusPoint(anchor, "big", borders)).toBe(anchor);
    expect(nationFocusPoint(anchor, "nowhere", borders)).toBe(anchor);
    expect(nationFocusPoint(anchor, null, borders)).toBe(anchor);
  });
});
