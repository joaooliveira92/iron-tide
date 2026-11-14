import type { InspectMapResult } from "../../shared/campaign-contract.js";

export function inspectMapFixture(overrides: Partial<InspectMapResult> = {}): InspectMapResult {
  return {
    revision: 0,
    month: { month: 1, year: 1880 },
    playerNationId: "uk",
    strategic: {
      world: { nations: [], areas: [], ports: [], fleets: [], routes: [] },
      playerFleets: [],
      blockades: [],
    },
    ...overrides,
  };
}
