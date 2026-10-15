import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef } from "react";
import { CardDeck } from "./CardDeck.js";
import { createWheelStepper, normalizeIndex } from "./deckNavigation.js";

export interface DeckMasterPaneProps {
  /** Stable id for the listbox; the heading and instructions ids derive from it. */
  readonly listboxId: string;
  readonly heading: string;
  /** Small overline above the heading (hidden on the narrowest screens). */
  readonly eyebrow?: string;
  /** Spoken as the listbox description and shown under the heading. */
  readonly instructions: string;
  /** The listbox's accessible name. */
  readonly ariaLabel: string;
  /** Short gesture legend pinned to the bottom of the deck. */
  readonly hint: string;
  readonly emptyMessage: string;
  /** One element per card, each carrying its own `role="option"` and id. */
  readonly cards: readonly ReactNode[];
  /** DOM id of each card's option element, parallel to `cards`. */
  readonly optionIds: readonly string[];
  /** The focused card; any integer, wrapped into range. */
  readonly focusedIndex: number;
  /** Focus moved (arrows, wheel, drag-to-fling). Previews; commits nothing. */
  readonly onFocusIndex: (index: number) => void;
  /** A card was tapped. */
  readonly onActivateIndex: (index: number) => void;
  /** Enter pressed on the focused card. Without it Enter is left to `onKeyDown`. */
  readonly onConfirmIndex?: (index: number) => void;
  /**
   * Parent-owned key handling, run before the built-in arrow/Enter handling. A
   * handler that calls `preventDefault()` claims the key and skips the built-in.
   */
  readonly onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  /**
   * Optional content rendered below the deck, inside the aside. When set, the
   * deck area gets a bounded height and the footer fills the remaining
   * flex-column space — used to host the nation dossier below the card stack
   * instead of overlaying the globe.
   */
  readonly footerChildren?: ReactNode;
}

const DECK_SETTINGS = {
  layout: "deck",
  visible: 4,
  spread: 0.9,
  depth: 0.55,
  radius: 18,
  tilt: 26,
  speed: 1.1,
} as const;

/**
 * The master pane shared by every deck-browsing surface (Fleet Dispatch, the
 * Rules-of-the-Naval-Age preset deck): a headed aside holding one listbox of
 * controlled cards. It owns listbox semantics (`aria-activedescendant`), arrow
 * wrapping, the wheel stepper, focus-on-mount and tap routing, so the surfaces
 * differ only by the cards they render and the callbacks they wire.
 *
 * It is presentation-only: it holds no selection state and reads nothing
 * authoritative.
 */
export function DeckMasterPane({
  listboxId,
  heading,
  eyebrow,
  instructions,
  ariaLabel,
  hint,
  emptyMessage,
  cards,
  optionIds,
  focusedIndex,
  onFocusIndex,
  onActivateIndex,
  onConfirmIndex,
  onKeyDown,
  footerChildren,
}: DeckMasterPaneProps): React.JSX.Element {
  const count = cards.length;
  const normalizedFocusedIndex = normalizeIndex(focusedIndex, count);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const step = useCallback(
    (delta: number) => {
      if (count <= 1) return;
      onFocusIndex(normalizeIndex(normalizedFocusedIndex + delta, count));
    },
    [count, normalizedFocusedIndex, onFocusIndex],
  );

  // The wheel listener is registered once per mount of the listbox and reaches
  // the latest `step` through a ref, so a re-render mid-gesture never resets the
  // stepper's accumulation or cooldown.
  const stepRef = useRef(step);
  stepRef.current = step;
  const countRef = useRef(count);
  countRef.current = count;
  const hasListbox = count > 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const stepper = createWheelStepper((direction) => stepRef.current(direction));
    const handleWheel = (event: WheelEvent): void => {
      // A single card is nothing to step through, and a sideways gesture is not
      // ours: both fall through to the page.
      if (countRef.current <= 1 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      stepper.push(event.deltaY, event.deltaMode);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
      stepper.dispose();
    };
  }, [hasListbox]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        step(1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        step(-1);
        break;
      case "Enter":
        if (onConfirmIndex) {
          event.preventDefault();
          onConfirmIndex(normalizedFocusedIndex);
        }
        break;
    }
  };

  if (count < 1) {
    return (
      <aside className="relative z-10 flex min-h-112 w-full flex-col border-b border-admiralty-border bg-admiralty-surface-raised/94 lg:h-full lg:w-[min(38vw,34rem)] lg:border-b-0 lg:border-r">
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-sm uppercase tracking-widest text-admiralty-ink-muted">
            {emptyMessage}
          </p>
        </div>
      </aside>
    );
  }

  const hasFooter = footerChildren !== undefined;

  return (
    <aside
      aria-labelledby={`${listboxId}-heading`}
      className={`
        relative z-10
        flex min-h-152 w-full
        flex-none flex-col
        overflow-hidden
        border-b border-admiralty-border
        bg-admiralty-surface-raised/60
        ${hasFooter ? "pt-4 sm:pt-5" : "py-4 sm:py-5"}

        sm:min-h-172

        lg:h-full
        lg:min-h-0
        lg:w-[min(39vw,36rem)]
        lg:border-b-0
        lg:border-r

        xl:w-[min(36vw,39rem)]
      `}
    >
      <header className="relative z-30 flex flex-none items-start justify-between gap-4 px-4 sm:px-6">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="hidden sm:block font-display text-[0.65rem] uppercase tracking-[0.32em] text-admiralty-ink-muted">
              {eyebrow}
            </p>
          ) : null}

          <h2
            id={`${listboxId}-heading`}
            className="mt-1 font-display text-lg font-bold uppercase tracking-[0.16em] text-admiralty-ink sm:text-lg"
          >
            {heading}
          </h2>
          <p
            id={`${listboxId}-instructions`}
            className="mt-1  text-sm leading-relaxed text-admiralty-ink-muted"
          >
            {instructions}
          </p>
        </div>
      </header>

      <div
        className={`relative min-h-0 ${hasFooter ? "flex-[0_1_26rem]" : "flex-1"} overflow-hidden`}
      >
        <div
          ref={containerRef}
          id={listboxId}
          role="listbox"
          tabIndex={0}
          aria-label={ariaLabel}
          aria-describedby={`${listboxId}-instructions`}
          aria-activedescendant={optionIds[normalizedFocusedIndex]}
          onKeyDown={handleKeyDown}
          className="absolute inset-0 touch-none overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-admiralty-accent focus-visible:ring-offset-2 focus-visible:ring-offset-admiralty-surface overscroll-contain perspective-distant"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[12%] bottom-[7%] top-[12%] rounded-[50%] bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--color-admiralty-signal)_10%,transparent),transparent_68%)] blur-xl"
          />

          <div className="absolute inset-x-0 top-1/2 mx-auto h-[min(19.5rem,80%)] w-[min(94%,29rem)] -translate-y-1/2 sm:h-[min(21.5rem,80%)]">
            <CardDeck
              cards={[...cards]}
              {...DECK_SETTINGS}
              topIndex={normalizedFocusedIndex}
              onCardActivate={onActivateIndex}
              onChange={onFocusIndex}
            />
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[12%] bottom-[4%] z-100 rounded-[50%] bg-admiralty-surface/55 blur-xl"
          />

          <div className="pointer-events-none absolute bottom-3 left-1/2 z-110 -translate-x-1/2 whitespace-nowrap rounded-full border border-admiralty-border bg-admiralty-surface-raised/90 px-3 py-1.5 font-display text-[0.58rem] uppercase tracking-[0.18em] text-admiralty-ink-muted backdrop-blur-sm">
            {hint}
          </div>
        </div>
      </div>

      {hasFooter && <div className="relative flex-1 overflow-hidden">{footerChildren}</div>}
    </aside>
  );
}
