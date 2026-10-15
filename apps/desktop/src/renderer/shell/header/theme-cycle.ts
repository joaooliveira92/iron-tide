import type { Theme } from "../ThemeContext.js";

/** The fixed order the header's theme control cycles through. */
export const THEME_SEQUENCE: readonly Theme[] = ["light", "dark", "system"];

/**
 * The next theme in the cycle. Every `Theme` is a member of the sequence, so the lookup always
 * succeeds; the fallback only satisfies indexed-access strictness without changing behaviour.
 */
export function nextTheme(theme: Theme): Theme {
  const index = THEME_SEQUENCE.indexOf(theme);
  return THEME_SEQUENCE[(index + 1) % THEME_SEQUENCE.length] ?? theme;
}
