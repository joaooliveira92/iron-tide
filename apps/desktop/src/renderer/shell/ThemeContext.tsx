import { createContext, type ReactNode, useCallback, use, useMemo } from "react";

import type { ThemePreference } from "../../shared/preferences-contract.js";
import { usePreferences } from "../lib/preferences-context.js";
import { useExternalSync } from "./useExternalSync.js";
import { useMediaQuery } from "./useMediaQuery.js";

export type Theme = ThemePreference;

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

export function resolveTheme(theme: Theme, systemIsDark: boolean): "light" | "dark" {
  if (theme === "system") return systemIsDark ? "dark" : "light";
  if (theme === "highContrast") return "dark";
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { preferences, setApp } = usePreferences();
  const theme = preferences.theme;
  const systemIsDark = useMediaQuery(SYSTEM_DARK_QUERY);

  const resolvedTheme = resolveTheme(theme, systemIsDark);

  useExternalSync(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.classList.toggle("high-contrast", theme === "highContrast");
  }, [resolvedTheme, theme]);

  const setTheme = useCallback((next: Theme) => setApp({ theme: next }), [setApp]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = use(ThemeContext);
  if (ctx === null) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
