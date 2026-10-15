import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "../../components/ui/button.js";
import type { Theme } from "../ThemeContext.js";
import { useTheme } from "../ThemeContext.js";
import { nextTheme } from "./theme-cycle.js";

const THEME_ICONS: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/** The header's theme control: shows the current theme and advances it on click. */
export function HeaderChrome() {
  const { theme, setTheme } = useTheme();
  const Icon = THEME_ICONS[theme];

  return (
    <Button
      className="h-8 w-8 shrink-0"
      variant="ghost"
      size="icon"
      aria-label={`Theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
      onClick={() => setTheme(nextTheme(theme))}
    >
      <Icon />
    </Button>
  );
}
