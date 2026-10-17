import { createContext, type ReactNode, use, useEffect, useState } from "react";

import type { ThemePreference } from "../../shared/preferences-contract.js";
import { usePreferences } from "../lib/preferences-context.js";

export type Theme = ThemePreference;

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  // High contrast is a dark-based theme; the `.high-contrast` class strengthens
  // the dark tokens (map D3).
  if (theme === "highContrast") return "dark";
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { preferences, setApp } = usePreferences();
  const theme = preferences.theme;
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => resolveTheme(theme));

  useEffect(() => {
    setResolvedTheme(resolveTheme(theme));
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(resolveTheme(theme));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.classList.toggle("high-contrast", theme === "highContrast");
  }, [resolvedTheme, theme]);

  const setTheme = (next: Theme) => setApp({ theme: next });

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = use(ThemeContext);
  if (ctx === null) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
