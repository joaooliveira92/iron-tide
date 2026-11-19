import { act, renderHook } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { createTimedFlag } from "./timed-flag.js";

describe("createTimedFlag", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("raises, then lowers after the duration; a second raise restarts the window", () => {
    vi.useFakeTimers();
    const flag = createTimedFlag(1000);
    const { result } = renderHook(() => useSyncExternalStore(flag.subscribe, flag.get));
    expect(result.current).toBe(false);

    act(() => flag.raise());
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    act(() => flag.raise());
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe(false);
  });

  it("clears the pending timer when the last subscriber leaves", () => {
    vi.useFakeTimers();
    const flag = createTimedFlag(1000);
    const { unmount } = renderHook(() => useSyncExternalStore(flag.subscribe, flag.get));
    act(() => flag.raise());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
