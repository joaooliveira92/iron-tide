/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CardDeck } from "./CardDeck.js";

const LABELS = ["Alpha", "Bravo", "Charlie"] as const;

function cards() {
  return LABELS.map((label) => (
    <div key={label} data-testid={`card-${label}`}>
      {label}
    </div>
  ));
}

function topLabel(container: HTMLElement): string | null {
  return container.querySelector("[data-top]")?.textContent ?? null;
}

function cardRoot(label: string): HTMLElement {
  const root = screen.getByTestId(`card-${label}`).closest(".card-deck-card");
  if (!(root instanceof HTMLElement)) throw new Error(`no deck card for ${label}`);
  return root;
}

describe("CardDeck", () => {
  afterEach(cleanup);

  it("starts with the controlled topIndex card on top", () => {
    const { container } = render(<CardDeck cards={cards()} layout="deck" topIndex={2} />);
    expect(topLabel(container)).toBe("Charlie");
  });

  it("brings the card named by a changed topIndex to the front without reporting a change", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <CardDeck cards={cards()} layout="deck" topIndex={0} onChange={onChange} />,
    );
    expect(topLabel(container)).toBe("Alpha");

    rerender(<CardDeck cards={cards()} layout="deck" topIndex={1} onChange={onChange} />);

    expect(topLabel(container)).toBe("Bravo");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("never reports a parent-driven change back, even when the parent steps again in the same commit", () => {
    const reported: number[] = [];
    function Parent() {
      const [index, setIndex] = useState(0);
      const steppedOn = useRef(false);
      useEffect(() => {
        if (index !== 1 || steppedOn.current) return;
        steppedOn.current = true;
        setIndex(2);
      }, [index]);
      return (
        <>
          <button type="button" onClick={() => setIndex(1)}>
            step
          </button>
          <CardDeck
            cards={cards()}
            layout="deck"
            topIndex={index}
            onChange={(i) => {
              reported.push(i);
              if (reported.length <= 3) setIndex(i);
            }}
          />
        </>
      );
    }
    const { container } = render(<Parent />);

    fireEvent.click(screen.getByText("step"));

    expect(reported).toEqual([]);
    expect(topLabel(container)).toBe("Charlie");
  });

  it("activates a non-top card as soon as it is tapped", () => {
    const onCardActivate = vi.fn();
    render(<CardDeck cards={cards()} layout="deck" topIndex={0} onCardActivate={onCardActivate} />);

    fireEvent.pointerDown(cardRoot("Bravo"), { button: 0, pointerId: 1 });

    expect(onCardActivate).toHaveBeenCalledTimes(1);
    expect(onCardActivate).toHaveBeenCalledWith(1);
  });

  it("activates the top card on a tap that is released without dragging", () => {
    const onCardActivate = vi.fn();
    render(<CardDeck cards={cards()} layout="deck" topIndex={0} onCardActivate={onCardActivate} />);

    fireEvent.pointerDown(cardRoot("Alpha"), { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
    expect(onCardActivate).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { button: 0, pointerId: 1, clientX: 5, clientY: 5 });

    expect(onCardActivate).toHaveBeenCalledWith(0);
  });

  it("reports the new top card through onChange when a drag flings the top card away", () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      const onCardActivate = vi.fn();
      render(
        <CardDeck
          cards={cards()}
          layout="deck"
          topIndex={0}
          onChange={onChange}
          onCardActivate={onCardActivate}
        />,
      );

      fireEvent.pointerDown(cardRoot("Alpha"), {
        button: 0,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 40, clientY: 0 });
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 200, clientY: 0 });
      act(() => {
        fireEvent.pointerUp(window, { button: 0, pointerId: 1, clientX: 200, clientY: 0 });
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(1);
      expect(onCardActivate).not.toHaveBeenCalled();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("never claims keyboard focus or a listbox role for itself", () => {
    const { container } = render(<CardDeck cards={cards()} layout="deck" topIndex={0} />);
    expect(container.querySelector("[role]")).toBeNull();
    expect(container.querySelector("[tabindex]")).toBeNull();
  });
});
