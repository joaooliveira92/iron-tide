/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CardDeck } from "./CardDeck.js";

const LABELS = ["Alpha", "Bravo", "Charlie", "Delta"] as const;

function cardRoot(label: string): HTMLElement {
  const root = screen.getByTestId(`card-${label}`).closest(".card-deck-card");
  if (!(root instanceof HTMLElement)) throw new Error(`no deck card for ${label}`);
  return root;
}

describe("CardDeck flight layout reads", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("reads each resting card's box at most once while a card is in flight", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const reads = new Map<Element, number>();
    const overlapping = (): DOMRect =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
      }) as DOMRect;
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        reads.set(this, (reads.get(this) ?? 0) + 1);
        return overlapping();
      });

    try {
      render(
        <CardDeck.Root count={LABELS.length} layout="deck" topIndex={0} tap="sendToBack">
          <CardDeck.Stack>
            {LABELS.map((label, index) => (
              <CardDeck.Card key={label} index={index}>
                <div data-testid={`card-${label}`}>{label}</div>
              </CardDeck.Card>
            ))}
          </CardDeck.Stack>
        </CardDeck.Root>,
      );
      reads.clear();

      fireEvent.pointerDown(cardRoot("Alpha"), { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
      act(() => {
        fireEvent.pointerUp(window, { button: 0, pointerId: 1, clientX: 5, clientY: 5 });
      });
      for (let frame = 0; frame < 30 && frames.length > 0; frame += 1) {
        const pending = frames.splice(0);
        act(() => {
          for (const callback of pending) callback(frame * 16);
        });
      }

      const flying = cardRoot("Alpha");
      const restingReads = [...reads].filter(([element]) => element !== flying);
      expect(restingReads.length).toBeGreaterThan(0);
      for (const [, count] of restingReads) {
        expect(count).toBeLessThanOrEqual(1);
      }
    } finally {
      spy.mockRestore();
    }
  });
});
