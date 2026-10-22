import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { ResearchState } from "@bluewave/campaign";
import {
  buildResearchScreenProjection,
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "../src/research.js";
import { fixtureNation, fixtureSnapshot, fixtureState } from "./fixtures.js";

function researchFixture(overrides: Partial<ResearchState> = {}): ResearchState {
  return {
    nationId: "uk",
    technologies: [
      { techId: "hc_wrought_iron_hull", investedPoints: SafeInt(50), completed: true },
      { techId: "mac_triple_expansion", investedPoints: SafeInt(30), completed: false },
    ],
    currentProjectTechId: "mac_triple_expansion",
    fieldPriorities: { MACHINERY: SafeInt(4), GUNNERY: SafeInt(2) },
    researchBudget: SafeInt(60),
    activeCandidates: new Map([["MACHINERY", "mac_triple_expansion"]]),
    discoveredTechs: ["gun_breech_rifled", "hc_wrought_iron_hull"],
    ...overrides,
  };
}

const month = { month: 1, year: 1880 };

describe("buildResearchScreenProjection", () => {
  it("derives every projection field one-to-one from the compiled ResearchState", () => {
    const snapshot = fixtureSnapshot([fixtureNation({ id: "uk", research: researchFixture() })]);
    const projection = buildResearchScreenProjection(fixtureState(snapshot), "uk", month);
    expect(projection).toBeDefined();
    if (!projection) return;

    expect(projection.nationId).toBe("uk");
    expect(projection.researchBudget).toBe(60);
    expect(projection.fieldPriorities).toEqual({ MACHINERY: 4, GUNNERY: 2 });
    expect(projection.currentProjectTechId).toBe("mac_triple_expansion");
  });

  it("sorts discovered tech ids for deterministic rendering", () => {
    const snapshot = fixtureSnapshot([
      fixtureNation({
        id: "uk",
        research: researchFixture({ discoveredTechs: ["zeta", "alpha", "mid"] }),
      }),
    ]);
    const projection = buildResearchScreenProjection(fixtureState(snapshot), "uk", month);
    expect(projection?.discoveredTechIds).toEqual(["alpha", "mid", "zeta"]);
  });

  it("projects the technologies array with SafeInt converted to UI numbers", () => {
    const snapshot = fixtureSnapshot([fixtureNation({ id: "uk", research: researchFixture() })]);
    const projection = buildResearchScreenProjection(fixtureState(snapshot), "uk", month);
    expect(projection?.inProgressTechnologies).toEqual([
      { techId: "hc_wrought_iron_hull", investedPoints: 50, completed: true },
      { techId: "mac_triple_expansion", investedPoints: 30, completed: false },
    ]);
  });

  it("carries null currentProjectTechId when the state has none", () => {
    const snapshot = fixtureSnapshot([
      fixtureNation({ id: "uk", research: researchFixture({ currentProjectTechId: undefined }) }),
    ]);
    const projection = buildResearchScreenProjection(fixtureState(snapshot), "uk", month);
    expect(projection?.currentProjectTechId).toBeNull();
  });

  it("returns undefined for an unknown player slot", () => {
    const snapshot = fixtureSnapshot([fixtureNation({ id: "uk", research: researchFixture() })]);
    expect(buildResearchScreenProjection(fixtureState(snapshot), "germany", month)).toBeUndefined();
  });

  it("exposes the canonical DESIGN-20 research-field registry for the desktop slice", () => {
    expect(CANONICAL_RESEARCH_FIELD_IDS).toContain("HULL_CONSTRUCTION");
    expect(CANONICAL_RESEARCH_FIELD_IDS.length).toBeGreaterThan(10);
    expect(RESEARCH_FIELD_PRIORITY_WEIGHTS).toEqual({ HIGH: 4, MEDIUM: 2, LOW: 1 });
    expect(MAX_HIGH_PRIORITY_FIELDS).toBe(5);
  });
});
