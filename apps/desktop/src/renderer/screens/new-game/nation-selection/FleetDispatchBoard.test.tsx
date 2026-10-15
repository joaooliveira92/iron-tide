/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";
import { FleetDispatchBoard } from "./FleetDispatchBoard.js";

const SLOTS: readonly PlayableSlotCountryId[] = ["gb", "de", "us"];

function setup(focusedIndex = 0) {
  const onSelect = vi.fn();
  const onKeyDown = vi.fn();
  const utils = render(
    <FleetDispatchBoard
      slots={SLOTS}
      focusedIndex={focusedIndex}
      listboxId="test-listbox"
      onSelect={onSelect}
      onKeyDown={onKeyDown}
    />,
  );
  return { ...utils, onSelect, onKeyDown };
}

describe("FleetDispatchBoard", () => {
  afterEach(cleanup);

  it("exposes every nation as a listbox option named by its presentation", () => {
    setup();
    expect(screen.getByRole("listbox", { name: "Playable nations" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "United Kingdom" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "German Empire" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "United States" })).toBeTruthy();
  });

  it("selects a nation when its (non-active) card is tapped", () => {
    const { onSelect } = setup(0);
    fireEvent.pointerDown(screen.getByRole("option", { name: "German Empire" }), { button: 0 });
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("selects the nation when the active card is tapped", () => {
    const { onSelect } = setup(0);
    fireEvent.pointerDown(screen.getByRole("option", { name: "United Kingdom" }), {
      button: 0,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, { button: 0, pointerId: 1 });
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it("forwards keyboard input from the listbox to the parent", () => {
    const { onKeyDown } = setup(0);
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Playable nations" }), { key: "Enter" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});
