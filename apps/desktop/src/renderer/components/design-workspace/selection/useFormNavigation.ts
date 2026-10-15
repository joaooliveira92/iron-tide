import { type RefObject, useCallback } from "react";
import { flushSync } from "react-dom";
import { findTarget, type BoardTab, type Destination } from "./navigation.js";

/** Focus goes to the first field of the group, by kind: a value to type, then a choice, then any button. */
const FOCUS_ORDER = [
  "input:not([disabled])",
  '[role="combobox"]:not([data-disabled])',
  "button:not([disabled])",
] as const;
/** How long the destination stays outlined after a jump (ms). */
export const NAV_FLASH_MS = 1600;

/** Briefly outlines `el` (static outline: nothing moves, so it needs no reduced-motion variant). */
function flash(el: HTMLElement): void {
  const previous = { outline: el.style.outline, offset: el.style.outlineOffset };
  el.dataset["navFlash"] = "true";
  el.style.outline = "2px solid var(--color-ring)";
  el.style.outlineOffset = "2px";
  window.setTimeout(() => {
    delete el.dataset["navFlash"];
    el.style.outline = previous.outline;
    el.style.outlineOffset = previous.offset;
  }, NAV_FLASH_MS);
}

/**
 * Jumps from the drawing to a form: opens the destination's tab (synchronously, so the target is visible), scrolls
 * it into view, moves focus to its first control (or the group itself), and outlines it briefly. Returns whether
 * the destination was found.
 */
export function useFormNavigation(
  setTab: (tab: BoardTab) => void,
  root: RefObject<HTMLElement | null>,
): (d: Destination) => boolean {
  return useCallback(
    (d) => {
      flushSync(() => setTab(d.tab));
      const el = root.current ? findTarget(root.current, d.target) : null;
      if (!el) return false;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      el.scrollIntoView?.({ block: "start", behavior: reduce ? "auto" : "smooth" });
      const control = FOCUS_ORDER.map((sel) => el.querySelector<HTMLElement>(sel)).find(
        (c) => c !== null,
      );
      if (control) control.focus({ preventScroll: true });
      else {
        el.tabIndex = -1;
        el.focus({ preventScroll: true });
      }
      flash(el);
      return true;
    },
    [setTab, root],
  );
}
