import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { stepIntervalMs } from "../tactical/tactical-time.js";
import { useBattleClock, type BattleClockInput } from "./use-battle-clock.js";

const idle: BattleClockInput = {
  busy: false,
  ended: false,
  loaded: true,
  onStep: () => undefined,
};

describe("battle clock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("starts paused and only steps once the player resumes it", async () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useBattleClock({ ...idle, onStep }));
    expect(result.current.running).toBe(false);
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onStep).not.toHaveBeenCalled();

    act(() => result.current.toggleRunning());
    expect(result.current.running).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(stepIntervalMs(result.current.scale));
    });
    expect(onStep).toHaveBeenCalledTimes(1);

    act(() => result.current.pause());
    expect(result.current.running).toBe(false);
  });

  it("stops running when the battle ends and stays stopped", async () => {
    const onStep = vi.fn();
    const { result, rerender } = renderHook((props: BattleClockInput) => useBattleClock(props), {
      initialProps: { ...idle, onStep },
    });
    act(() => result.current.toggleRunning());
    expect(result.current.running).toBe(true);

    rerender({ ...idle, ended: true, onStep });
    expect(result.current.running).toBe(false);
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onStep).not.toHaveBeenCalled();
  });

  it("does not step before the battle has loaded", async () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useBattleClock({ ...idle, loaded: false, onStep }));
    act(() => result.current.toggleRunning());
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onStep).not.toHaveBeenCalled();
  });

  it("changes the pace through the scale", async () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useBattleClock({ ...idle, onStep }));
    act(() => result.current.setScale(8));
    act(() => result.current.toggleRunning());
    await act(async () => {
      vi.advanceTimersByTime(stepIntervalMs(8));
    });
    expect(onStep).toHaveBeenCalledTimes(1);
  });
});
