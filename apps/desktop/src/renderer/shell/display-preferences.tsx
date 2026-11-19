import type { ReactNode } from "react";

import type { ReducedMotionPreference } from "../../shared/preferences-contract.js";
import { usePreferences } from "../lib/preferences-context.js";
import { useExternalSync } from "./useExternalSync.js";
import { useMediaQuery } from "./useMediaQuery.js";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

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

  const systemReduces = useMediaQuery(REDUCED_MOTION_QUERY);

  useExternalSync(() => {
    applyTextScale(textScale);
  }, [textScale]);

  useExternalSync(() => {
    applyReducedMotion(resolveReducedMotion(reducedMotion, systemReduces));
  }, [reducedMotion, systemReduces]);

  return <>{children}</>;
}

export function useEffectiveReducedMotion(): boolean {
  const { preferences } = usePreferences();
  if (typeof window === "undefined") return preferences.reducedMotion === "reduce";
  return resolveReducedMotion(
    preferences.reducedMotion,
    window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );
}
