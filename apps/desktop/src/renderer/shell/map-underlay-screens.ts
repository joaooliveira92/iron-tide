import type { Screen } from "./campaign-screen-types.js";

const MAP_UNDERLAY_SCREENS: ReadonlySet<Screen> = new Set<Screen>(["overview", "fleet", "strategic-map"]);

export function isMapUnderlayScreen(screen: Screen): boolean {
  return MAP_UNDERLAY_SCREENS.has(screen);
}
