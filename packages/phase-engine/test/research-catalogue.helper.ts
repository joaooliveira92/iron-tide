import type { TechnologyDefinitionData } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";

function tech(
  techId: string,
  researchFieldId: string,
  cost: number,
  discoveryWeight: number,
  prerequisites: string[] = [],
): TechnologyDefinitionData {
  return {
    techId,
    researchFieldId,
    cost: SafeInt(cost),
    discoveryWeight: SafeInt(discoveryWeight),
    prerequisites,
    availabilityMonth: SafeInt(0),
  };
}

export const TEST_RESEARCH_CATALOGUE: TechnologyDefinitionData[] = [
  tech("advanced_gunnery", "GUNNERY", 200, 8, ["basic_gunnery"]),
  tech("advanced_hull", "HULL_CONSTRUCTION", 200, 8, ["basic_hull"]),
  tech("advanced_steam", "MACHINERY", 200, 8, ["basic_steam"]),
  tech("basic_gunnery", "GUNNERY", 100, 10),
  tech("basic_hull", "HULL_CONSTRUCTION", 100, 10),
  tech("basic_steam", "MACHINERY", 100, 10),
];
