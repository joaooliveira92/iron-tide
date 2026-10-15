import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { PrimaryAction } from "../../shell/primary-action.js";
import { useBriefingPager } from "./useBriefingPager.js";

function primaryRecorder() {
  let primary: PrimaryAction | null = null;
  const onPrimaryActionChange = vi.fn((action: PrimaryAction | null) => {
    primary = action;
  });
  return { onPrimaryActionChange, primary: () => primary };
}

describe("useBriefingPager", () => {
  it("registers no primary action until the briefing is ready", () => {
    const { onPrimaryActionChange } = primaryRecorder();

    renderHook(() =>
      useBriefingPager({
        sessionId: "s1",
        ready: false,
        onTakeCommand: vi.fn(),
        onPrimaryActionChange,
      }),
    );

    expect(onPrimaryActionChange).not.toHaveBeenCalled();
  });

  it("labels page 1 and advances toward the next page", () => {
    const { onPrimaryActionChange, primary } = primaryRecorder();
    const { result } = renderHook(() =>
      useBriefingPager({
        sessionId: "s1",
        ready: true,
        onTakeCommand: vi.fn(),
        onPrimaryActionChange,
      }),
    );

    expect(result.current.pageIndex).toBe(0);
    expect(primary()?.label).toBe("Review Naval Estimates");

    act(() => primary()?.onTrigger());

    expect(result.current.pageIndex).toBe(1);
    expect(primary()?.label).toBe("Next");
  });

  it("uses the closing label on the last page and fires the take-command action", () => {
    const onTakeCommand = vi.fn();
    const { onPrimaryActionChange, primary } = primaryRecorder();
    const { result } = renderHook(() =>
      useBriefingPager({ sessionId: "s1", ready: true, onTakeCommand, onPrimaryActionChange }),
    );

    for (let i = 0; i < 4; i += 1) {
      act(() => primary()?.onTrigger());
    }

    expect(result.current.pageIndex).toBe(4);
    expect(primary()?.label).toBe("Take command");

    act(() => primary()?.onTrigger());
    expect(onTakeCommand).toHaveBeenCalledTimes(1);
  });

  it("steps the cursor back", () => {
    const { onPrimaryActionChange, primary } = primaryRecorder();
    const { result } = renderHook(() =>
      useBriefingPager({
        sessionId: "s1",
        ready: true,
        onTakeCommand: vi.fn(),
        onPrimaryActionChange,
      }),
    );
    act(() => primary()?.onTrigger());

    act(() => result.current.goBack());

    expect(result.current.pageIndex).toBe(0);
  });

  it("resets to the first page when the session changes", () => {
    const { onPrimaryActionChange, primary } = primaryRecorder();
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) =>
        useBriefingPager({
          sessionId,
          ready: true,
          onTakeCommand: vi.fn(),
          onPrimaryActionChange,
        }),
      { initialProps: { sessionId: "s1" } },
    );
    act(() => primary()?.onTrigger());
    expect(result.current.pageIndex).toBe(1);

    rerender({ sessionId: "s2" });

    expect(result.current.pageIndex).toBe(0);
  });
});
