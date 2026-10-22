import { createContext, type ReactNode, use, useLayoutEffect } from "react";

import type { FontPreference } from "../../shared/preferences-contract.js";
import { usePreferences } from "../lib/preferences-context.js";

export type SansFontPreference = FontPreference;

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

interface FontContextValue {
  readonly font: SansFontPreference;
  readonly setFont: (font: SansFontPreference) => void;
}

const FontContext = createContext<FontContextValue | null>(null);

export function FontProvider({ children }: { children: ReactNode }) {
  const { preferences, setApp } = usePreferences();
  const font = preferences.font;

  useLayoutEffect(() => {
    document.documentElement.dataset["font"] = font;
  }, [font]);

  const setFont = (next: SansFontPreference) => setApp({ font: next });

  return <FontContext.Provider value={{ font, setFont }}>{children}</FontContext.Provider>;
}

export function useFont(): FontContextValue {
  const ctx = use(FontContext);
  if (ctx === null) throw new Error("useFont must be used within FontProvider");
  return ctx;
}
