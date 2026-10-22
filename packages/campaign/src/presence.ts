import type { PossessionData } from "./state.js";

export function presenceAreaIds(
  possessions: readonly PossessionData[],
  nationId: string,
): string[] {
  const areas = new Set<string>();
  for (const possession of possessions) {
    if (possession.nationId === nationId) areas.add(possession.areaId);
  }
  return [...areas].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
