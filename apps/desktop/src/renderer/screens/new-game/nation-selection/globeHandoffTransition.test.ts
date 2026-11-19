import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useArmedAfterMount } from "./globeHandoffTransition.js";

function stubMotionPreference(reduced: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduced })),
  );
  window.matchMedia = globalThis.matchMedia;
}

describe("useArmedAfterMount", () => {
  let frames: Array<() => void> = [];

  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function runFrame(): void {
    const next = frames.shift();
    act(() => next?.());
  }

  it("arms after two animation frames when motion is allowed", () => {
    stubMotionPreference(false);
    const { result } = renderHook(() => useArmedAfterMount(true));
    expect(result.current).toBe(false);
    runFrame();
    expect(result.current).toBe(false);
    runFrame();
    expect(result.current).toBe(true);
  });

  it("is armed immediately when reduced motion is preferred", () => {
    stubMotionPreference(true);
    const { result } = renderHook(() => useArmedAfterMount(true));
    expect(result.current).toBe(true);
  });

  it("stays disarmed while inactive and re-arms after reactivation", () => {
    stubMotionPreference(false);
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useArmedAfterMount(active),
      { initialProps: { active: false } },
    );
    expect(result.current).toBe(false);
    expect(frames).toHaveLength(0);

    rerender({ active: true });
    runFrame();
    runFrame();
    expect(result.current).toBe(true);

    rerender({ active: false });
    expect(result.current).toBe(false);
  });
});
