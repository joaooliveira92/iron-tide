import type { AreaData } from "./state.js";

export function isSeaArea(area: Pick<AreaData, "type">): boolean {
  return area.type !== "land";
}
