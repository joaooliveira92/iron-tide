/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DeckMasterPane } from "./DeckMasterPane.js";
import { WHEEL_COOLDOWN_MS } from "./deckNavigation.js";

const NAMES = ["Alpha", "Bravo", "Charlie"] as const;
const LISTBOX_ID = "deck-test";

function optionId(name: string): string {
  return `${LISTBOX_ID}-option-${name}`;
}

interface SetupOptions {
  readonly focusedIndex?: number;
  readonly names?: readonly string[];
  readonly onConfirmIndex?: ((index: number) => void) | undefined;
  readonly onKeyDown?: ((event: KeyboardEvent<HTMLDivElement>) => void) | undefined;
}

function setup({ focusedIndex = 0, names = NAMES, onConfirmIndex, onKeyDown }: SetupOptions = {}) {
  const onFocusIndex = vi.fn();
  const onActivateIndex = vi.fn();
  const utils = render(
    <DeckMasterPane
      listboxId={LISTBOX_ID}
      heading="Test Deck"
      instructions="Use the arrow keys."
      ariaLabel="Test options"
      hint="Drag · Scroll"
      emptyMessage="Nothing here"
      optionIds={names.map(optionId)}
      cards={names.map((name, index) => (
        <div
          key={name}
          id={optionId(name)}
          role="option"
          aria-label={name}
          aria-selected={index === focusedIndex}
        >
          {name}
        </div>
      ))}
      focusedIndex={focusedIndex}
      onFocusIndex={onFocusIndex}
      onActivateIndex={onActivateIndex}
      {...(onConfirmIndex === undefined ? {} : { onConfirmIndex })}
      {...(onKeyDown === undefined ? {} : { onKeyDown })}
    />,
  );
  return { ...utils, onFocusIndex, onActivateIndex };
}

describe("DeckMasterPane", () => {
  afterEach(cleanup);

  it("exposes the cards as a named listbox whose active descendant is the focused option", () => {
    setup({ focusedIndex: 1 });
    const listbox = screen.getByRole("listbox", { name: "Test options" });
    expect(
      screen.getAllByRole("option").map((option) => option.getAttribute("aria-label")),
    ).toEqual([...NAMES]);
    expect(listbox.getAttribute("aria-activedescendant")).toBe(optionId("Bravo"));
    expect(listbox.getAttribute("aria-describedby")).toBe(`${LISTBOX_ID}-instructions`);
    expect(screen.getByRole("heading", { name: "Test Deck" })).toBeTruthy();
  });

  it("wraps the active descendant for an out-of-range focused index", () => {
    setup({ focusedIndex: 4 });
    expect(
      screen.getByRole("listbox", { name: "Test options" }).getAttribute("aria-activedescendant"),
    ).toBe(optionId("Bravo"));
  });

  it("takes keyboard focus when it mounts", () => {
    setup();
    expect(document.activeElement).toBe(screen.getByRole("listbox", { name: "Test options" }));
  });

  it.each([
    ["ArrowRight", 2, 0],
    ["ArrowDown", 2, 0],
    ["ArrowLeft", 0, 2],
    ["ArrowUp", 0, 2],
    ["ArrowRight", 0, 1],
    ["ArrowLeft", 2, 1],
  ])("%s from index %i moves focus to index %i, wrapping at the ends", (key, from, to) => {
    const { onFocusIndex, onActivateIndex } = setup({ focusedIndex: from });
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Test options" }), { key });
    expect(onFocusIndex).toHaveBeenCalledWith(to);
    expect(onActivateIndex).not.toHaveBeenCalled();
  });

  it("confirms the focused index on Enter", () => {
    const onConfirmIndex = vi.fn();
    const { onFocusIndex } = setup({ focusedIndex: 1, onConfirmIndex });
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Test options" }), { key: "Enter" });
    expect(onConfirmIndex).toHaveBeenCalledWith(1);
    expect(onFocusIndex).not.toHaveBeenCalled();
  });

  it("lets the parent handle a key first and skips its own handling when prevented", () => {
    const onKeyDown = vi.fn((event: KeyboardEvent<HTMLDivElement>) => event.preventDefault());
    const { onFocusIndex } = setup({ onKeyDown });
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Test options" }), { key: "ArrowRight" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onFocusIndex).not.toHaveBeenCalled();
  });

  it("activates a card when its (non-top) option is tapped", () => {
    const { onActivateIndex } = setup({ focusedIndex: 0 });
    fireEvent.pointerDown(screen.getByRole("option", { name: "Charlie" }), { button: 0 });
    expect(onActivateIndex).toHaveBeenCalledWith(2);
  });

  describe("wheel", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("steps focus once per flick and honours the cooldown", () => {
      const { onFocusIndex } = setup({ focusedIndex: 0 });
      const listbox = screen.getByRole("listbox", { name: "Test options" });

      fireEvent.wheel(listbox, { deltaY: 10 });
      expect(onFocusIndex).not.toHaveBeenCalled();

      fireEvent.wheel(listbox, { deltaY: 40 });
      expect(onFocusIndex).toHaveBeenCalledTimes(1);
      expect(onFocusIndex).toHaveBeenLastCalledWith(1);

      fireEvent.wheel(listbox, { deltaY: 40 });
      expect(onFocusIndex).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(WHEEL_COOLDOWN_MS);
      });
      fireEvent.wheel(listbox, { deltaY: -40 });
      expect(onFocusIndex).toHaveBeenCalledTimes(2);
      expect(onFocusIndex).toHaveBeenLastCalledWith(2);
    });

    it("ignores a mostly-horizontal wheel gesture", () => {
      const { onFocusIndex } = setup();
      fireEvent.wheel(screen.getByRole("listbox", { name: "Test options" }), {
        deltaX: 80,
        deltaY: 40,
      });
      expect(onFocusIndex).not.toHaveBeenCalled();
    });
  });

  it("renders the empty message and no listbox when there are no cards", () => {
    setup({ names: [] });
    expect(screen.getByText("Nothing here")).toBeTruthy();
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
