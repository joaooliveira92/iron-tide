import { createContext, type ReactNode, use, useLayoutEffect, useState } from "react";

/**
 * User-selectable application body font (ADR-0079).
 *
 * The single source of truth for the supported values, their labels and the
 * persistence key. `font-sans` resolves to whichever value is active via the
 * `[data-font]` mapping in styles/globals.css; components never name a family.
 *
 * Preferences are renderer-local (like theme/density/background) — no IPC, so
 * the Electron security boundary is untouched.
 */
export type SansFontPreference = "inter" | "jakarta";

export const SANS_FONT_STORAGE_KEY = "bluewave-font";

/** Deterministic default when nothing valid is stored. */
export const DEFAULT_SANS_FONT: SansFontPreference = "inter";

export const SANS_FONT_OPTIONS: readonly {
  readonly value: SansFontPreference;
  readonly label: string;
  readonly description: string;
}[] = [
  { value: "inter", label: "Inter", description: "Neutral, highly legible interface face." },
  {
    value: "jakarta",
    label: "Plus Jakarta Sans",
    description: "Rounded, geometric; a warmer feel.",
  },
];

/** Narrowing guard — the single validator for the persisted value. */
export function isSansFontPreference(value: unknown): value is SansFontPreference {
  return value === "inter" || value === "jakarta";
}

/** The stored choice, or Inter for anything missing, malformed or unrecognised. */
export function readStoredSansFont(): SansFontPreference {
  try {
    const stored = localStorage.getItem(SANS_FONT_STORAGE_KEY);
    return isSansFontPreference(stored) ? stored : DEFAULT_SANS_FONT;
  } catch {
    return DEFAULT_SANS_FONT;
  }
}

interface FontContextValue {
  readonly font: SansFontPreference;
  readonly setFont: (font: SansFontPreference) => void;
}

const FontContext = createContext<FontContextValue | null>(null);

export function FontProvider({ children }: { children: ReactNode }) {
  const [font, setFontState] = useState<SansFontPreference>(readStoredSansFont);

  // Layout effect: set the attribute before first paint so the app never flashes
  // the wrong face on startup (same approach as DensityProvider).
  useLayoutEffect(() => {
    document.documentElement.dataset["font"] = font;
  }, [font]);

  const setFont = (next: SansFontPreference) => {
    try {
      localStorage.setItem(SANS_FONT_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice still applies for this session.
    }
    setFontState(next);
  };

  return <FontContext.Provider value={{ font, setFont }}>{children}</FontContext.Provider>;
}

export function useFont(): FontContextValue {
  const ctx = use(FontContext);
  if (ctx === null) throw new Error("useFont must be used within FontProvider");
  return ctx;
}
