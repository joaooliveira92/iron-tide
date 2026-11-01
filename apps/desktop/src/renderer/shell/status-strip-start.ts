import type { Screen } from "./campaign-screen-types.js";

const COLLAPSED_START_SCREENS: ReadonlySet<Screen> = new Set<Screen>(["ship-design"]);

export function startsCollapsed(screen: Screen): boolean {
  return COLLAPSED_START_SCREENS.has(screen);
}
