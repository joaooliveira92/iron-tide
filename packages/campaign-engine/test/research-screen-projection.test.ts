import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { ResearchState } from "@bluewave/campaign";
import {
  buildResearchScreenProjection,
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "../src/research.js";
import type { CampaignSnapshot } from "@bluewave/campaign";
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

type Catalogue = NonNullable<CampaignSnapshot["world"]["technologies"]>;

const tech = (
  techId: string,
  researchFieldId: string,
  extra: { cost?: number; weight?: number; prerequisites?: string[]; availability?: number } = {},
): Catalogue[number] => ({
  techId,
  researchFieldId,
  cost: SafeInt(extra.cost ?? 100),
  discoveryWeight: SafeInt(extra.weight ?? 1000),
  prerequisites: extra.prerequisites ?? [],
  availabilityMonth: SafeInt(extra.availability ?? 0),
});

const catalogue: Catalogue = [
  tech("hc_a", "HULL_CONSTRUCTION", { cost: 50 }),
  tech("hc_b", "HULL_CONSTRUCTION", { weight: 4000, prerequisites: ["hc_a"] }),
  tech("hc_c", "HULL_CONSTRUCTION", { weight: 4000, prerequisites: ["hc_a"] }),
  tech("hc_d", "HULL_CONSTRUCTION", { prerequisites: ["hc_b"] }),
  tech("mac_a", "MACHINERY", { cost: 60 }),
  tech("gun_late", "GUNNERY", { availability: 12 }),
];

function catalogueState(turn = 0, overrides: Partial<ResearchState> = {}) {
  const snapshot = fixtureSnapshot(
    [
      fixtureNation({
        id: "uk",
        research: researchFixture({
          technologies: [
            { techId: "hc_a", investedPoints: SafeInt(50), completed: true },
            { techId: "mac_a", investedPoints: SafeInt(30), completed: false },
          ],
          discoveredTechs: ["hc_a"],
          activeCandidates: new Map([["MACHINERY", "mac_a"]]),
          currentProjectTechId: "mac_a",
          ...overrides,
        }),
      }),
    ],
    [],
    {
      turnNumber: SafeInt(turn),
      world: { areas: [], routes: [], ports: [], technologies: catalogue },
    },
  );
  return fixtureState(snapshot);
}

describe("buildResearchScreenProjection technology chart", () => {
  it("classifies every catalogue technology by its state in the research pipeline", () => {
    const projection = buildResearchScreenProjection(catalogueState(), "uk", month);
    const status = Object.fromEntries(
      (projection?.technologies ?? []).map((t) => [t.techId, t.status]),
    );
    expect(status).toEqual({
      hc_a: "discovered",
      hc_b: "open",
      hc_c: "open",
      hc_d: "locked",
      mac_a: "researching",
      gun_late: "future",
    });
  });

  it("reports progress, cost, and what blocks a locked technology", () => {
    const projection = buildResearchScreenProjection(catalogueState(), "uk", month);
    const byId = new Map((projection?.technologies ?? []).map((t) => [t.techId, t]));
    expect(byId.get("mac_a")).toMatchObject({ cost: 60, investedPoints: 30 });
    expect(byId.get("hc_d")).toMatchObject({
      prerequisiteIds: ["hc_b"],
      missingPrerequisiteIds: ["hc_b"],
    });
    expect(byId.get("gun_late")).toMatchObject({ monthsUntilAvailable: 12 });
    expect(byId.get("hc_b")?.monthsUntilAvailable).toBe(0);
  });

  it("splits a field's draw odds by discovery weight when no candidate is active", () => {
    const projection = buildResearchScreenProjection(catalogueState(), "uk", month);
    const odds = Object.fromEntries(
      (projection?.technologies ?? []).map((t) => [t.techId, t.drawOddsBp]),
    );
    expect(odds["hc_b"]).toBe(5000);
    expect(odds["hc_c"]).toBe(5000);
    expect(odds["mac_a"]).toBeNull();
    expect(odds["hc_d"]).toBeNull();
  });

  it("applies the historical timing modifier to draw weights", () => {
    const projection = buildResearchScreenProjection(catalogueState(100), "uk", month);
    const hcB = projection?.technologies.find((t) => t.techId === "hc_b");
    expect(hcB).toMatchObject({ timingModifierBp: 12_500, drawWeight: 5000 });
  });

  it("summarises each canonical field with its eligibility and active candidate", () => {
    const projection = buildResearchScreenProjection(catalogueState(), "uk", month);
    expect(projection?.fields.map((f) => f.fieldId)).toEqual([...CANONICAL_RESEARCH_FIELD_IDS]);
    const field = (id: string) => projection?.fields.find((f) => f.fieldId === id);
    expect(field("HULL_CONSTRUCTION")).toMatchObject({
      eligible: true,
      totalTechs: 4,
      discoveredTechs: 1,
      activeTechId: null,
    });
    expect(field("MACHINERY")).toMatchObject({ eligible: true, activeTechId: "mac_a" });
    expect(field("GUNNERY")).toMatchObject({ eligible: false, totalTechs: 1 });
    expect(field("MISSILES")).toMatchObject({ eligible: false, totalTechs: 0 });
  });

  it("names technologies from the supplied content names", () => {
    const names = new Map([["hc_b", "Compound Armor"]]);
    const projection = buildResearchScreenProjection(catalogueState(), "uk", month, names);
    const byId = new Map((projection?.technologies ?? []).map((t) => [t.techId, t.name]));
    expect(byId.get("hc_b")).toBe("Compound Armor");
    expect(byId.get("hc_c")).toBeNull();
  });
});
