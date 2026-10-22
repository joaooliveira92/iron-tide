import {
  CANONICAL_RESEARCH_FIELD_IDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import type { ResearchScreenProjection } from "../../../shared/research-contract.js";
import { setDraftWeight } from "./research-field-priorities.js";
import { researchLoadSuccess } from "./research-screen-state.js";
import { buildResearchViewModel } from "./research-view-model.js";

function fixtureProjection(
  overrides: Partial<ResearchScreenProjection> = {},
): ResearchScreenProjection {
  return {
    nationId: "uk",
    researchBudget: 60,
    annualAllocation: 720,
    researchCap: 120,
    unfundedReason: null,
    fieldPriorities: {
      GUNNERY: RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
      MACHINERY: RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM,
    },
    discoveredTechIds: ["basic_steam", "gunnery_rifled"],
    inProgressTechnologies: [{ techId: "gunnery_rifled", investedPoints: 24, completed: false }],
    currentProjectTechId: "gunnery_rifled",
    revision: 0,
    month: { month: 1, year: 1880 },
    ...overrides,
  };
}

function loaded(overrides: Partial<ResearchScreenProjection> = {}) {
  const state = researchLoadSuccess(fixtureProjection(overrides));
  if (state.kind !== "loaded") throw new Error("expected loaded state");
  return state;
}

describe("buildResearchViewModel", () => {
  it("humanizes the projection into render-ready rows and scalars", () => {
    const vm = buildResearchViewModel(loaded());

    expect(vm.researchBudget).toBe(60);
    expect(vm.currentProjectLabel).toBe("Gunnery rifled");
    expect(vm.discoveredTechs).toEqual([
      { techId: "basic_steam", label: "Basic steam" },
      { techId: "gunnery_rifled", label: "Gunnery rifled" },
    ]);
    expect(vm.inProgressTechnologies).toEqual([
      {
        techId: "gunnery_rifled",
        label: "Gunnery rifled",
        investedPoints: 24,
        completed: false,
        isCurrentProject: true,
      },
    ]);
    expect(vm.dirty).toBe(false);
    expect(vm.highCount).toBe(1);
    expect(vm.highCap).toBe(5);
    expect(vm.highCountValid).toBe(true);
  });

  it("emits one row per canonical field, carrying its weight and projected points", () => {
    const vm = buildResearchViewModel(loaded());

    expect(vm.fields).toHaveLength(CANONICAL_RESEARCH_FIELD_IDS.length);
    const gunnery = vm.fields.find((field) => field.fieldId === "GUNNERY");
    expect(gunnery).toMatchObject({ label: "Gunnery", weight: 4, isHigh: true });
    expect(gunnery?.projectedPoints).toBeGreaterThan(0);
  });

  it("reflects a dirty, over-cap draft in the derived flags", () => {
    const state = loaded();
    const draft = setDraftWeight(state.draft, "MACHINERY", RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH);
    const vm = buildResearchViewModel({ ...state, draft });

    expect(vm.dirty).toBe(true);
    expect(vm.highCount).toBe(2);
    expect(vm.highCountValid).toBe(true);
  });

  it("renders honest empty labels for an empty projection", () => {
    const vm = buildResearchViewModel(
      loaded({
        researchBudget: 0,
        discoveredTechIds: [],
        inProgressTechnologies: [],
        currentProjectTechId: null,
        fieldPriorities: {},
      }),
    );

    expect(vm.currentProjectLabel).toBeNull();
    expect(vm.discoveredTechs).toEqual([]);
    expect(vm.inProgressTechnologies).toEqual([]);
    expect(vm.fields.every((field) => field.weight === RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW)).toBe(
      true,
    );
  });

  it("carries the annual allocation, the cap and an honest note about an unpaid or impossible budget", () => {
    const ok = buildResearchViewModel(loaded());
    expect(ok.annualAllocation).toBe(720);
    expect(ok.researchCap).toBe(120);
    expect(ok.budgetNote).toBeNull();

    const noField = buildResearchViewModel(
      loaded({ unfundedReason: "NO_ELIGIBLE_RESEARCH_FIELD" }),
    );
    expect(noField.budgetNote).toMatch(/no field can take it/);

    const tiny = buildResearchViewModel(loaded({ researchBudget: 0, researchCap: 0 }));
    expect(tiny.budgetNote).toMatch(/too small to fund research/);
  });
});
