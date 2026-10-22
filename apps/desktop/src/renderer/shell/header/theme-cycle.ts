import type { Theme } from "../ThemeContext.js";

export const THEME_SEQUENCE: readonly Theme[] = ["light", "dark", "system"];

export function nextTheme(theme: Theme): Theme {
  const index = THEME_SEQUENCE.indexOf(theme);
  return THEME_SEQUENCE[(index + 1) % THEME_SEQUENCE.length] ?? theme;
}
