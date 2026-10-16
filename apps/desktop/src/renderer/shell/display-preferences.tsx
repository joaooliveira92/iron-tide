import { type ReactNode, useEffect } from "react";

import type { ReducedMotionPreference } from "../../shared/preferences-contract.js";
import { usePreferences } from "../lib/preferences-context.js";

/**
 * Applying the accessibility/display preferences that are not already wired by a
 * dedicated provider (U-4 map D4): text scale is applied once at the shell root so
 * the whole interface scales, and the stored reduced-motion preference overrides
 * the OS media query so the toggle actually stops motion (`system` defers to the
 * OS). Presentation-only: no authoritative value is read or written.
 */

/** Resolve the effective reduced-motion state (pure; testable without a DOM). */
export function resolveReducedMotion(
  preference: ReducedMotionPreference,
  mediaMatches: boolean,
): boolean {
  if (preference === "reduce") return true;
  if (preference === "noPreference") return false;
  return mediaMatches;
}

/** Apply the text scale as a root font size (a percent, e.g. 110 → 110%). */
export function applyTextScale(
  textScale: number,
  root: HTMLElement = document.documentElement,
): void {
  root.style.fontSize = `${textScale}%`;
}

/** Apply reduced motion as a root data attribute the stylesheet reacts to. */
export function applyReducedMotion(
  reduce: boolean,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset["reducedMotion"] = reduce ? "reduce" : "no-preference";
}

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const { textScale, reducedMotion } = preferences;

  useEffect(() => {
    applyTextScale(textScale);
  }, [textScale]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => applyReducedMotion(resolveReducedMotion(reducedMotion, media.matches));
    apply();
    if (reducedMotion !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [reducedMotion]);

  return <>{children}</>;
}

/** Read the effective reduced-motion state in a component. */
export function useEffectiveReducedMotion(): boolean {
  const { preferences } = usePreferences();
  if (typeof window === "undefined") return preferences.reducedMotion === "reduce";
  return resolveReducedMotion(
    preferences.reducedMotion,
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
}
