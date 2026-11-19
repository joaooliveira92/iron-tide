import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { BridgeProvider } from "../../../lib/bridge-context.js";
import { useAstInspector } from "./useAstInspector.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness() {
  const inspector = useAstInspector("ses_1");
  return (
    <div>
      <input ref={inspector.searchRef} aria-label="search" />
      <span data-testid="copied">{String(inspector.copied)}</span>
      <button type="button" onClick={inspector.copyRecord}>
        copy
      </button>
    </div>
  );
}

function mount() {
  return render(
    <BridgeProvider bridge={undefined}>
      <Harness />
    </BridgeProvider>,
  );
}

describe("useAstInspector", () => {
  it("focuses the search box on '/' outside text inputs", () => {
    const view = mount();
    const search = view.getByLabelText("search");

    fireEvent.keyDown(window, { key: "/" });

    expect(document.activeElement).toBe(search);
  });

  it("leaves '/' alone while typing in an input", () => {
    const view = mount();
    const search = view.getByLabelText("search");
    const other = document.createElement("input");
    document.body.append(other);
    other.focus();

    fireEvent.keyDown(other, { key: "/" });

    expect(document.activeElement).toBe(other);
    expect(document.activeElement).not.toBe(search);
    other.remove();
  });

  it("stops listening once the search box unmounts", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const view = mount();
    const added = addSpy.mock.calls.filter(([type]) => type === "keydown").length;
    expect(added).toBeGreaterThan(0);

    view.unmount();

    expect(removeSpy.mock.calls.filter(([type]) => type === "keydown").length).toBe(added);
  });

  it("does not raise the copied flag without a selected record", () => {
    vi.useFakeTimers();
    const view = mount();
    act(() => {
      fireEvent.click(view.getByText("copy"));
    });
    expect(view.getByTestId("copied").textContent).toBe("false");
  });
});
