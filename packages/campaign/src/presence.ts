// S-5 (spec #73, R3/R13): a nation's presence areas are the distinct areas of the possessions it currently owns.
// Pure and ordered by area id; ownership lives in `WorldState.possessions`, so a possession that changes hands
// changes the answer on the next evaluation.
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
