import { useState, type KeyboardEvent } from "react";
import { Pin } from "lucide-react";

import { cn } from "../lib/utils.js";

/** Marks anything that toggles a pinned card, so pressing it is not mistaken for an outside press. */
export const PIN_TRIGGER_ATTR = "data-pin-trigger";
/** Marks a pinned card's popup, so pressing inside one pinned card never unpins another. */
export const PINNED_CARD_ATTR = "data-pinned-card";

interface ChangeDetails {
  readonly reason: string;
  readonly event: Event;
}

function insideMarked(event: Event, attr: string): boolean {
  return event.target instanceof Element && event.target.closest(`[${attr}]`) !== null;
}

/**
 * Hover-or-pin state for one status strip card. The card still opens on hover and focus; a click
 * (or Enter/Space on a label) pins it so it stays open while the pointer moves to another readout.
 * Escape, or a press outside every pinned card, unpins. Several cards may be pinned at once, which
 * is the point: two readouts can be read side by side.
 *
 * `onActive` mirrors the open state to the caller (the budget bar highlights the line being shown).
 */
export function usePinnableCard(onActive?: (open: boolean) => void) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  const show = (next: boolean) => {
    setOpen(next);
    onActive?.(next);
  };

  const rootProps = {
    open,
    onOpenChange(next: boolean, details: ChangeDetails) {
      if (pinned && !next) {
        // Hover-out and blur never close a pinned card; only an explicit dismissal does.
        if (details.reason === "escape-key") setPinned(false);
        else if (details.reason === "outside-press") {
          if (insideMarked(details.event, PINNED_CARD_ATTR)) return;
          // The trigger's own click toggles; treating it as outside would unpin then re-pin.
          if (insideMarked(details.event, PIN_TRIGGER_ATTR)) return;
          setPinned(false);
        } else return;
      }
      show(next);
    },
  };

  const toggle = () => {
    setPinned(!pinned);
    show(!pinned);
  };

  const triggerProps = {
    [PIN_TRIGGER_ATTR]: "",
    "data-pinned": pinned,
    onClick: toggle,
  };

  /** For a trigger that is not already a button: Enter and Space pin, like a button. */
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  };

  const contentProps = {
    [PINNED_CARD_ATTR]: pinned ? "" : undefined,
    className: pinned ? "ring-primary/50" : undefined,
  };

  return { rootProps, triggerProps, contentProps, onKeyDown, pinned, toggle };
}

/** The line under a pinned card that says how to let go of it. */
export function PinnedHint({ pinned }: { readonly pinned: boolean }) {
  return (
    <p
      aria-hidden={!pinned}
      className={cn(
        "flex items-center gap-1.5 border-t border-primary/30 bg-primary/5 px-3 py-1 text-xs text-muted-foreground",
        !pinned && "hidden",
      )}
    >
      <Pin className="size-3 text-primary" aria-hidden="true" />
      Pinned. Press Esc or click away to close.
    </p>
  );
}
