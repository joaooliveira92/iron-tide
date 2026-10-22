import { useState, type KeyboardEvent } from "react";
import { Pin } from "lucide-react";

import { cn } from "../lib/utils.js";

export const PIN_TRIGGER_ATTR = "data-pin-trigger";
export const PINNED_CARD_ATTR = "data-pinned-card";

interface ChangeDetails {
  readonly reason: string;
  readonly event: Event;
}

function insideMarked(event: Event, attr: string): boolean {
  return event.target instanceof Element && event.target.closest(`[${attr}]`) !== null;
}

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
        if (details.reason === "escape-key") setPinned(false);
        else if (details.reason === "outside-press") {
          if (insideMarked(details.event, PINNED_CARD_ATTR)) return;
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
