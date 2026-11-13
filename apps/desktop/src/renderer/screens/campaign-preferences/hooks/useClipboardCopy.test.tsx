/* @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useClipboardCopy } from "./useClipboardCopy.js";

const RESET_DELAY_MS = 2000;

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  });
});

afterEach(() => {
  vi.useRealTimers();
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
});

describe("useClipboardCopy reset timer", () => {
  it("clears the pending reset timer on unmount", async () => {
    const { result, unmount } = renderHook(() => useClipboardCopy(RESET_DELAY_MS));
    await act(async () => {
      await result.current.copy("text");
    });
    expect(result.current.copied).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("restarts the reset window on a second copy so the first timer cannot clear copied early", async () => {
    const { result } = renderHook(() => useClipboardCopy(RESET_DELAY_MS));
    await act(async () => {
      await result.current.copy("first");
    });

    act(() => {
      vi.advanceTimersByTime(RESET_DELAY_MS - 500);
    });
    await act(async () => {
      await result.current.copy("second");
    });

    act(() => {
      vi.advanceTimersByTime(RESET_DELAY_MS - 100);
    });
    expect(result.current.copied).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.copied).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
