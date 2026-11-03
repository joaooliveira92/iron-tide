import type { Screen } from "./campaign-screen-types.js";

const HIDDEN_STRIP_SCREENS: ReadonlySet<Screen> = new Set<Screen>(["ship-design"]);

export function hidesStrip(screen: Screen): boolean {
  return HIDDEN_STRIP_SCREENS.has(screen);
}
