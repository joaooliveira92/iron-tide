import { createContext, type ReactNode, use, useState } from "react";

export type BackgroundStyle =
  | "water"
  | "stars"
  | "mesh-citrus"
  | "mesh-lagoon"
  | "auralis"
  | "nebulore"
  | "pattern-waves"
  | "none";

export const BACKGROUND_STORAGE_KEY = "bluewave-background";

interface BackgroundContextValue {
  background: BackgroundStyle;
  setBackground: (background: BackgroundStyle) => void;
}

const BackgroundContext = createContext<BackgroundContextValue | null>(null);

export function readStoredBackground(): BackgroundStyle {
  const stored = localStorage.getItem(BACKGROUND_STORAGE_KEY);
  return stored === "water" ||
    stored === "stars" ||
    stored === "mesh-citrus" ||
    stored === "mesh-lagoon" ||
    stored === "auralis" ||
    stored === "nebulore" ||
    stored === "pattern-waves" ||
    stored === "none"
    ? stored
    : "water";
}

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [background, setBackgroundState] = useState<BackgroundStyle>(readStoredBackground);

  const setBackground = (next: BackgroundStyle) => {
    localStorage.setItem(BACKGROUND_STORAGE_KEY, next);
    setBackgroundState(next);
  };

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
