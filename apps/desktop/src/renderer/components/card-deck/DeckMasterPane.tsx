import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef } from "react";
import { CardDeck } from "./CardDeck.js";
import { createWheelStepper, normalizeIndex } from "./deckNavigation.js";

export interface DeckMasterPaneProps {
  readonly listboxId: string;
  readonly heading: string;
  readonly eyebrow?: string;
  readonly instructions: string;
  readonly ariaLabel: string;
  readonly hint: string;
  readonly emptyMessage: string;
  readonly cards: readonly ReactNode[];
  readonly optionIds: readonly string[];
  readonly focusedIndex: number;
  readonly onFocusIndex: (index: number) => void;
  readonly onActivateIndex: (index: number) => void;
  readonly onConfirmIndex?: (index: number) => void;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
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
