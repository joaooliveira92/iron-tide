import {
  createContext,
  type ReactNode,
  useCallback,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";

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

export function resolveTheme(theme: Theme, systemIsDark: boolean): "light" | "dark" {
  if (theme === "system") return systemIsDark ? "dark" : "light";
  if (theme === "highContrast") return "dark";
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { preferences, setApp } = usePreferences();
  const theme = preferences.theme;
  const [systemIsDark, setSystemIsDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemIsDark(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const resolvedTheme = resolveTheme(theme, systemIsDark);

  useEffect(() => {
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
