/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CardDeck, type CardDeckAutoplayProps, type CardDeckRootProps } from "./CardDeck.js";

const LABELS = ["Alpha", "Bravo", "Charlie"] as const;

function cards(labels: readonly string[] = LABELS) {
  return labels.map((label) => (
    <div key={label} data-testid={`card-${label}`}>
      {label}
    </div>
  ));
}

type DeckProps = Omit<CardDeckRootProps, "count" | "children"> & {
  cards?: ReactNode[];
  autoplay?: CardDeckAutoplayProps;
};

function deck({ cards: items = cards(), autoplay, ...props }: DeckProps = {}) {
  return (
    <CardDeck.Root count={items.length} layout="deck" topIndex={0} {...props}>
      <CardDeck.Stack>
        {items.map((item, index) => (
          <CardDeck.Card key={index} index={index}>
            {item}
          </CardDeck.Card>
        ))}
      </CardDeck.Stack>
      {autoplay ? <CardDeck.Autoplay {...autoplay} /> : null}
    </CardDeck.Root>
  );
}

function topLabel(container: HTMLElement): string | null {
  return container.querySelector("[data-top]")?.textContent ?? null;
}

function cardRoot(label: string): HTMLElement {
  const root = screen.getByTestId(`card-${label}`).closest(".card-deck-card");
  if (!(root instanceof HTMLElement)) throw new Error(`no deck card for ${label}`);
  return root;
}

function withFakeTimers(body: () => void): void {
  vi.useFakeTimers();
  try {
    body();
  } finally {
    vi.clearAllTimers();
    vi.useRealTimers();
  }
}

describe("CardDeck", () => {
  afterEach(cleanup);

  it("starts with the controlled topIndex card on top", () => {
    const { container } = render(deck({ topIndex: 2 }));
    expect(topLabel(container)).toBe("Charlie");
  });

  it("brings the card named by a changed topIndex to the front without reporting a change", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(deck({ topIndex: 0, onChange }));
    expect(topLabel(container)).toBe("Alpha");

    rerender(deck({ topIndex: 1, onChange }));

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
          {deck({
            topIndex: index,
            onChange: (i) => {
              reported.push(i);
              if (reported.length <= 3) setIndex(i);
            },
          })}
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
    render(deck({ onCardActivate }));

    fireEvent.pointerDown(cardRoot("Bravo"), { button: 0, pointerId: 1 });

    expect(onCardActivate).toHaveBeenCalledTimes(1);
    expect(onCardActivate).toHaveBeenCalledWith(1);
  });

  it("activates the top card on a tap that is released without dragging", () => {
    const onCardActivate = vi.fn();
    render(deck({ onCardActivate }));

    fireEvent.pointerDown(cardRoot("Alpha"), { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
    expect(onCardActivate).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { button: 0, pointerId: 1, clientX: 5, clientY: 5 });

    expect(onCardActivate).toHaveBeenCalledWith(0);
  });

  it("reports the new top card through onChange when a drag flings the top card away", () => {
    withFakeTimers(() => {
      const onChange = vi.fn();
      const onCardActivate = vi.fn();
      render(deck({ onChange, onCardActivate }));

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
    });
  });

  it("keeps the top card when a drag ends short of the threshold", () => {
    withFakeTimers(() => {
      const onChange = vi.fn();
      const { container } = render(deck({ onChange }));

      fireEvent.pointerDown(cardRoot("Alpha"), {
        button: 0,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 10, clientY: 0 });
      act(() => {
        fireEvent.pointerUp(window, { button: 0, pointerId: 1, clientX: 10, clientY: 0 });
      });

      expect(onChange).not.toHaveBeenCalled();
      expect(topLabel(container)).toBe("Alpha");
    });
  });

  it("neither activates nor moves a card when the gesture is cancelled before it moves", () => {
    const onCardActivate = vi.fn();
    const onChange = vi.fn();
    const { container } = render(deck({ onCardActivate, onChange }));

    fireEvent.pointerDown(cardRoot("Alpha"), { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerCancel(window, { pointerId: 1, clientX: 5, clientY: 5 });

    expect(onCardActivate).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(topLabel(container)).toBe("Alpha");
  });

  it("ignores pointer events from another pointer while a gesture is open", () => {
    const onCardActivate = vi.fn();
    render(deck({ onCardActivate }));

    fireEvent.pointerDown(cardRoot("Alpha"), { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(window, { button: 0, pointerId: 2, clientX: 5, clientY: 5 });
    expect(onCardActivate).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { button: 0, pointerId: 1, clientX: 5, clientY: 5 });

    expect(onCardActivate).toHaveBeenCalledTimes(1);
  });

  it("sends the top card to the back on a tap when the tap action is sendToBack", () => {
    withFakeTimers(() => {
      const onChange = vi.fn();
      const onCardActivate = vi.fn();
      const { container } = render(deck({ tap: "sendToBack", onChange, onCardActivate }));

      fireEvent.pointerDown(cardRoot("Alpha"), { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
      act(() => {
        fireEvent.pointerUp(window, { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(1);
      expect(onCardActivate).not.toHaveBeenCalled();
      expect(topLabel(container)).toBe("Bravo");
    });
  });

  it("advances to the next card after the autoplay delay", () => {
    withFakeTimers(() => {
      const onChange = vi.fn();
      const { container } = render(deck({ autoplay: { delay: 1000 }, onChange }));

      act(() => {
        vi.advanceTimersByTime(999);
      });
      expect(onChange).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(onChange).toHaveBeenCalledWith(1);
      expect(topLabel(container)).toBe("Bravo");
    });
  });

  it("never autoplays a single card", () => {
    withFakeTimers(() => {
      const onChange = vi.fn();
      render(deck({ cards: cards(["Alpha"]), autoplay: { delay: 300 }, onChange }));

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it("holds autoplay while hovered when pauseOnHover is set and resumes on leave", () => {
    withFakeTimers(() => {
      const onChange = vi.fn();
      const { container } = render(deck({ autoplay: { delay: 1000, pause: "hover" }, onChange }));
      const root = container.querySelector(".card-deck") as HTMLElement;

      fireEvent.mouseEnter(root);
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onChange).not.toHaveBeenCalled();

      fireEvent.mouseLeave(root);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onChange).toHaveBeenCalledWith(1);
    });
  });

  it("keeps a valid top card when it rerenders with fewer cards", () => {
    const { container, rerender } = render(deck({ topIndex: 2 }));
    expect(topLabel(container)).toBe("Charlie");

    rerender(deck({ cards: cards(["Alpha", "Bravo"]), topIndex: undefined }));

    expect(container.querySelectorAll(".card-deck-card")).toHaveLength(2);
    expect(container.querySelectorAll("[data-top]")).toHaveLength(1);
    expect(topLabel(container)).toBe("Alpha");
  });

  it("never claims keyboard focus or a listbox role for itself", () => {
    const { container } = render(deck());
    expect(container.querySelector("[role]")).toBeNull();
    expect(container.querySelector("[tabindex]")).toBeNull();
  });
});
