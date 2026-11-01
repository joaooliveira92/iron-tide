import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { stepIntervalMs } from "./tactical-time.js";
import { useTacticalPacer, type TacticalPacerInput } from "./useTacticalPacer.js";

const idle: TacticalPacerInput = {
  running: true,
  scale: 1,
  busy: false,
  ended: false,
  onStep: () => undefined,
};

describe("tactical pacer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("requests one step after the scale's interval", async () => {
    const onStep = vi.fn();
    renderHook(() => useTacticalPacer({ ...idle, onStep }));
    await act(async () => {
      vi.advanceTimersByTime(stepIntervalMs(1) - 1);
    });
    expect(onStep).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it("requests no step while paused, busy or ended", async () => {
    for (const patch of [{ running: false }, { busy: true }, { ended: true }]) {
      const onStep = vi.fn();
      const { unmount } = renderHook(() => useTacticalPacer({ ...idle, ...patch, onStep }));
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
      expect(onStep).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("steps sooner at a higher scale without changing what one step is", async () => {
    const onStep = vi.fn();
    renderHook(() => useTacticalPacer({ ...idle, scale: 8, onStep }));
    await act(async () => {
      vi.advanceTimersByTime(stepIntervalMs(8));
    });
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it("drops the pending step when it pauses", async () => {
    const onStep = vi.fn();
    const { rerender } = renderHook((props: TacticalPacerInput) => useTacticalPacer(props), {
      initialProps: { ...idle, onStep },
    });
    rerender({ ...idle, running: false, onStep });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onStep).not.toHaveBeenCalled();
  });

  it("clears its timer on unmount", async () => {
    const onStep = vi.fn();
    const { unmount } = renderHook(() => useTacticalPacer({ ...idle, onStep }));
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onStep).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
