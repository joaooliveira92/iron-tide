import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { PrimaryAction } from "./primary-action.js";
import { usePrimaryAction } from "./usePrimaryAction.js";

describe("usePrimaryAction", () => {
  it("registers the action and clears it on unmount", () => {
    const onChange = vi.fn();
    const action: PrimaryAction = { label: "Next", disabled: false, onTrigger: vi.fn() };

    const { unmount } = renderHook(() => usePrimaryAction(action, onChange));

    expect(onChange).toHaveBeenCalledWith(action);
    unmount();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("does not register while the action is null", () => {
    const onChange = vi.fn();

    renderHook(() => usePrimaryAction(null, onChange));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("replaces the registration when the action changes", () => {
    const onChange = vi.fn();
    const first: PrimaryAction = { label: "A", disabled: false, onTrigger: vi.fn() };
    const second: PrimaryAction = { label: "B", disabled: false, onTrigger: vi.fn() };

    const { rerender } = renderHook(
      ({ action }: { action: PrimaryAction }) => usePrimaryAction(action, onChange),
      { initialProps: { action: first } },
    );
    rerender({ action: second });

    expect(onChange).toHaveBeenCalledWith(first);
    expect(onChange).toHaveBeenLastCalledWith(second);
  });
});
