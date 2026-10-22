import { type RefObject, useCallback } from "react";
import { flushSync } from "react-dom";
import { findTarget, type BoardTab, type Destination } from "./navigation.js";

const FOCUS_ORDER = [
  "input:not([disabled])",
  '[role="combobox"]:not([data-disabled])',
  "button:not([disabled])",
] as const;
export const NAV_FLASH_MS = 1600;

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
