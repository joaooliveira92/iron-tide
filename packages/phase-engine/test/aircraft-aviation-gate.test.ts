import type { AircraftDevelopmentProject } from "@bluewave/combat/aircraft";
import type { NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import { describe, expect, it } from "vite-plus/test";

import { AVIATION_TECHNOLOGY, resolveAircraftDevelopment } from "../src/index.js";

function project(): AircraftDevelopmentProject {
  return {
    developmentProjectId: "project-1",
    requestedRole: "FIGHTER",
    emphasizedTraits: ["SPEED", "AGILITY"],
    basingClass: "LAND",
    startMonth: "1912-01",
    requiredDevelopmentMonths: SafeInt(2),
    completedPaidMonths: SafeInt(0),
    monthlyCost: SafeInt(1),
    technologyInputHash: "tech",
    nationalTraitInputHash: "trait",
    designStreamKey: "stream",
    status: "DEVELOPING",
    finalProposalId: null,
    rulesetVersion: "aircraft_ruleset_v1",
    formulaVersion: "aircraft_formula_v1",
    projectHash: "project-hash",
  };
}

function nation(discoveredTechs: readonly string[]): NationState {
  return {
    id: "GBR",
    name: "Great Britain",
    tag: "GBR",
    treasury: SafeInt(100),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    prestige: SafeInt(20),
    fleets: [],
    divisions: [],
    research: {
      nationId: "GBR",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [...discoveredTechs],
    },
    constructionProjects: [],
    aircraft: {
      models: {},
      inventory: {},
      developmentProjects: [project()],
      proposals: [],
      privateProposals: [],
      squadrons: [],
      basingAllocations: [],
      rulesetVersion: "aircraft_ruleset_v1",
      stateHash: "",
    },
    isPlayable: true,
    isAI: false,
  };
}

function advance(discoveredTechs: readonly string[]): AircraftDevelopmentProject | undefined {
  const nations = new Map([["GBR", nation(discoveredTechs)]]);
  const result = resolveAircraftDevelopment({
    nations,
    campaignMonth: "1913-01",
    rngStream: new RandomEngine("aviation-gate").stream("aircraft/development"),
  });
  const aircraft = result.nations.get("GBR")?.aircraft as
    | { developmentProjects: AircraftDevelopmentProject[] }
    | undefined;
  return aircraft?.developmentProjects[0];
}

describe("aircraft development aviation gate (#294)", () => {
  it("does not advance a project before the authored aviation technology", () => {
    expect(advance([])?.completedPaidMonths).toBe(0);
  });

  it("advances the project once the authored aviation technology is discovered", () => {
    expect(advance([AVIATION_TECHNOLOGY])?.completedPaidMonths).toBe(1);
  });
});
