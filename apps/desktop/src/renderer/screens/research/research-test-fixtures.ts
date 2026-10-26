import { RESEARCH_FIELD_PRIORITY_WEIGHTS } from "@bluewave/campaign-engine";
import type { ResearchTechnologyProjection } from "@bluewave/campaign-engine";
import type { ResearchScreenProjection } from "../../../shared/research-contract.js";

export function fixtureTech(
  techId: string,
  researchFieldId: string,
  overrides: Partial<ResearchTechnologyProjection> = {},
): ResearchTechnologyProjection {
  return {
    techId,
    name: null,
    researchFieldId,
    status: "open",
    cost: 100,
    investedPoints: 0,
    prerequisiteIds: [],
    missingPrerequisiteIds: [],
    availabilityMonth: 0,
    monthsUntilAvailable: 0,
    discoveryWeight: 1000,
    timingModifierBp: 10_000,
    drawWeight: 1000,
    drawOddsBp: null,
    ...overrides,
  };
}

export const FIXTURE_TECHNOLOGIES: readonly ResearchTechnologyProjection[] = [
  fixtureTech("hc_wrought", "HULL_CONSTRUCTION", {
    name: "Wrought Iron Hull",
    status: "discovered",
    cost: 50,
    investedPoints: 50,
  }),
  fixtureTech("hc_compound", "HULL_CONSTRUCTION", {
    name: "Compound Armor",
    cost: 120,
    prerequisiteIds: ["hc_wrought"],
    discoveryWeight: 4000,
    drawWeight: 4000,
    drawOddsBp: 6667,
  }),
  fixtureTech("hc_steel", "HULL_CONSTRUCTION", {
    name: "All-Steel Hull",
    cost: 140,
    prerequisiteIds: ["hc_wrought"],
    discoveryWeight: 2000,
    drawWeight: 2000,
    drawOddsBp: 3333,
  }),
  fixtureTech("hc_nickel", "HULL_CONSTRUCTION", {
    name: "Nickel-Steel Armor",
    status: "locked",
    cost: 150,
    prerequisiteIds: ["hc_compound"],
    missingPrerequisiteIds: ["hc_compound"],
  }),
  fixtureTech("mac_compound", "MACHINERY", {
    name: "Compound Engine",
    status: "researching",
    cost: 60,
    investedPoints: 30,
  }),
  fixtureTech("mac_triple", "MACHINERY", {
    name: "Triple-Expansion Engine",
    status: "locked",
    cost: 130,
    prerequisiteIds: ["mac_compound"],
    missingPrerequisiteIds: ["mac_compound"],
  }),
  fixtureTech("gun_breech", "GUNNERY", {
    name: "Breech-Loading Rifle",
    status: "future",
    cost: 200,
    availabilityMonth: 14,
    monthsUntilAvailable: 14,
  }),
];

export function fixtureProjection(
  overrides: Partial<ResearchScreenProjection> = {},
): ResearchScreenProjection {
  return {
    nationId: "uk",
    turnNumber: 0,
    lowSpending: false,
    minimumResearchSpend: 40,
    researchSpend: 40,
    technologies: FIXTURE_TECHNOLOGIES,
    fields: [
      {
        fieldId: "HULL_CONSTRUCTION",
        eligible: true,
        totalTechs: 4,
        discoveredTechs: 1,
        activeTechId: null,
      },
      {
        fieldId: "MACHINERY",
        eligible: true,
        totalTechs: 2,
        discoveredTechs: 0,
        activeTechId: "mac_compound",
      },
      {
        fieldId: "GUNNERY",
        eligible: false,
        totalTechs: 1,
        discoveredTechs: 0,
        activeTechId: null,
      },
    ],
    researchBudget: 60,
    annualAllocation: 720,
    researchCap: 120,
    unfundedReason: null,
    fieldPriorities: {
      HULL_CONSTRUCTION: RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
      MACHINERY: RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM,
      GUNNERY: RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW,
    },
    discoveredTechIds: ["hc_wrought"],
    inProgressTechnologies: [
      { techId: "hc_wrought", investedPoints: 50, completed: true },
      { techId: "mac_compound", investedPoints: 30, completed: false },
    ],
    currentProjectTechId: "mac_compound",
    revision: 0,
    month: { month: 1, year: 1880 },
    ...overrides,
  };
}
