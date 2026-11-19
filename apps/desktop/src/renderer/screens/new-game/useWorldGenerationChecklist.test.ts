import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { useWorldGenerationChecklist } from "./useWorldGenerationChecklist.js";
import {
  CHECKLIST_LINES,
  CHECKLIST_REVEAL_INTERVAL_MS,
  FLAVOR_MESSAGES,
  FLAVOR_ROTATION_INTERVAL_MS,
} from "./world-generation-presentation.js";

describe("useWorldGenerationChecklist", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reveals lines and rotates flavour text while active", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useWorldGenerationChecklist(true));
    expect(result.current.revealedCount).toBe(1);
    expect(result.current.flavorText).toBe(FLAVOR_MESSAGES[0]);

    act(() => {
      vi.advanceTimersByTime(CHECKLIST_REVEAL_INTERVAL_MS);
    });
    expect(result.current.revealedCount).toBe(2);

    act(() => {
      vi.advanceTimersByTime(FLAVOR_ROTATION_INTERVAL_MS);
    });
    expect(result.current.flavorText).toBe(FLAVOR_MESSAGES[1 % FLAVOR_MESSAGES.length]);
  });

  it("never reveals past the last line", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useWorldGenerationChecklist(true));
    act(() => {
      vi.advanceTimersByTime(CHECKLIST_REVEAL_INTERVAL_MS * (CHECKLIST_LINES.length + 5));
    });
    expect(result.current.revealedCount).toBe(CHECKLIST_LINES.length);
  });

  it("pauses while inactive and resumes from the same progress", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useWorldGenerationChecklist(active),
      { initialProps: { active: true } },
    );
    act(() => {
      vi.advanceTimersByTime(CHECKLIST_REVEAL_INTERVAL_MS);
    });
    expect(result.current.revealedCount).toBe(2);

    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(CHECKLIST_REVEAL_INTERVAL_MS * 3);
    });
    expect(result.current.revealedCount).toBe(2);

    rerender({ active: true });
    act(() => {
      vi.advanceTimersByTime(CHECKLIST_REVEAL_INTERVAL_MS);
    });
    expect(result.current.revealedCount).toBe(3);
  });

  it("clears its timers on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useWorldGenerationChecklist(true));
    expect(vi.getTimerCount()).toBe(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
