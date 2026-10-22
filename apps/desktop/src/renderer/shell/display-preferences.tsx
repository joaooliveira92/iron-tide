import { type ReactNode, useEffect } from "react";

import type { ReducedMotionPreference } from "../../shared/preferences-contract.js";
import { usePreferences } from "../lib/preferences-context.js";

export function resolveReducedMotion(
  preference: ReducedMotionPreference,
  mediaMatches: boolean,
): boolean {
  if (preference === "reduce") return true;
  if (preference === "noPreference") return false;
  return mediaMatches;
}

export function applyTextScale(
  textScale: number,
  root: HTMLElement = document.documentElement,
): void {
  root.style.fontSize = `${textScale}%`;
}

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

export function useEffectiveReducedMotion(): boolean {
  const { preferences } = usePreferences();
  if (typeof window === "undefined") return preferences.reducedMotion === "reduce";
  return resolveReducedMotion(
    preferences.reducedMotion,
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
}
