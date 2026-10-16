import { createContext, type ReactNode, use } from "react";

import type { BackgroundPreference } from "../../shared/preferences-contract.js";
import { usePreferences } from "../lib/preferences-context.js";

export type BackgroundStyle = BackgroundPreference;

interface BackgroundContextValue {
  background: BackgroundStyle;
  setBackground: (background: BackgroundStyle) => void;
}

const BackgroundContext = createContext<BackgroundContextValue | null>(null);

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const { preferences, setApp } = usePreferences();
  const background = preferences.background;
  const setBackground = (next: BackgroundStyle) => setApp({ background: next });

  return (
    <BackgroundContext.Provider value={{ background, setBackground }}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackground(): BackgroundContextValue {
  const ctx = use(BackgroundContext);
  if (ctx === null) {
    throw new Error("useBackground must be used within BackgroundProvider");
  }
  return ctx;
}
