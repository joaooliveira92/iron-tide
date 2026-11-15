import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  vi.stubGlobal("innerHeight", 700);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(320);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 480,
    bottom: 520,
    left: 40,
    right: 240,
    width: 200,
    height: 40,
    x: 40,
    y: 480,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function placementOf(minBelow?: number): string | null {
  render(
    <Select value="a">
      <SelectTrigger>
        <SelectValue placeholder="Select" />
      </SelectTrigger>
      <SelectContent {...(minBelow === undefined ? {} : { minBelow })}>
        <SelectItem value="a">Alpha</SelectItem>
        <SelectItem value="b">Bravo</SelectItem>
      </SelectContent>
    </Select>,
  );
  fireEvent.click(screen.getByRole("combobox"));
  return document.querySelector("[role=listbox]")!.getAttribute("data-placement");
}

describe("Select placement in a short viewport", () => {
  it("opens upward when the list does not fit below and more room is above", () => {
    expect(placementOf()).toBe("top");
  });

  it("stays below, scrolling, when a minimum below is given and fits", () => {
    expect(placementOf(150)).toBe("bottom");
  });

  it("still flips up when even the minimum does not fit below", () => {
    expect(placementOf(200)).toBe("top");
  });
});
