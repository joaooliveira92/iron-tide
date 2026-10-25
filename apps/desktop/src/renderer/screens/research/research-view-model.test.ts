import { RESEARCH_FIELD_PRIORITY_WEIGHTS } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import type { ResearchScreenProjection } from "../../../shared/research-contract.js";
import { setDraftWeight } from "./research-field-priorities.js";
import { researchLoadSuccess } from "./research-screen-state.js";
import { fixtureProjection } from "./research-test-fixtures.js";
import { buildResearchViewModel } from "./research-view-model.js";

function loaded(overrides: Partial<ResearchScreenProjection> = {}) {
  const state = researchLoadSuccess(fixtureProjection(overrides));
  if (state.kind !== "loaded") throw new Error("expected loaded state");
  return state;
}

const field = (vm: ReturnType<typeof buildResearchViewModel>, id: string) => {
  const found = vm.fields.find((f) => f.fieldId === id);
  if (found === undefined) throw new Error(`no field ${id}`);
  return found;
};

describe("buildResearchViewModel summary", () => {
  it("derives the budget gauge against the cap and the guidance floor", () => {
    const vm = buildResearchViewModel(loaded());
    expect(vm.budget).toMatchObject({
      monthly: 60,
      cap: 120,
      floor: 40,
      utilizationPct: 50,
      floorPct: 33,
      annualAllocation: 720,
    });
  });

  it("counts the catalogue by what the player can act on", () => {
    const vm = buildResearchViewModel(loaded());
    expect(vm.totals).toMatchObject({
      catalogue: 7,
      discovered: 1,
      researching: 1,
      open: 2,
    });
  });

  it("tracks the High slots and dirtiness", () => {
    const vm = buildResearchViewModel(loaded());
    expect(vm).toMatchObject({ highCount: 1, highCap: 5, highCountValid: true, dirty: false });
  });

  it("surfaces the engine's unfunded explanation", () => {
    const vm = buildResearchViewModel(loaded({ unfundedReason: "ABOVE_CAP" }));
    expect(vm.budget.note).not.toBeNull();
  });
});

describe("buildResearchViewModel fields", () => {
  it("lists every canonical field in registry order", () => {
    const vm = buildResearchViewModel(loaded());
    expect(vm.fields[0]?.fieldId).toBe("HULL_CONSTRUCTION");
    expect(vm.fields).toHaveLength(15);
  });

  it("projects points over eligible fields only, so an idle field funds nothing", () => {
    const vm = buildResearchViewModel(loaded());
    expect(field(vm, "HULL_CONSTRUCTION")).toMatchObject({ projectedPoints: 40, sharePct: 67 });
    expect(field(vm, "MACHINERY")).toMatchObject({ projectedPoints: 20, sharePct: 33 });
    expect(field(vm, "GUNNERY")).toMatchObject({ projectedPoints: 0, sharePct: 0 });
    expect(vm.totals.projectedPoints).toBe(60);
    expect(vm.totals.fundedFields).toBe(2);
  });

  it("re-projects live as the draft changes", () => {
    const state = loaded();
    const draft = setDraftWeight(state.draft, "MACHINERY", RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH);
    const vm = buildResearchViewModel({ ...state, draft });
    expect(field(vm, "MACHINERY").projectedPoints).toBe(30);
    expect(vm.dirty).toBe(true);
    expect(vm.highCount).toBe(2);
  });

  it("explains why a field gets nothing", () => {
    const vm = buildResearchViewModel(loaded());
    expect(field(vm, "GUNNERY")).toMatchObject({ state: "waiting" });
    expect(field(vm, "GUNNERY").stateNote).toContain("Breech-Loading Rifle");
    expect(field(vm, "GUNNERY").stateNote).toContain("Mar 1881");
    expect(field(vm, "MISSILES")).toMatchObject({ state: "empty", totalTechs: 0 });
  });

  it("estimates when the active project completes at the projected rate", () => {
    const vm = buildResearchViewModel(loaded());
    const machinery = field(vm, "MACHINERY");
    expect(machinery.activeTech?.techId).toBe("mac_compound");
    expect(machinery.activeTech?.etaMonths).toBe(2);
    expect(machinery.activeTech?.progressPct).toBe(50);
  });
});

describe("buildResearchViewModel technologies", () => {
  const tech = (vm: ReturnType<typeof buildResearchViewModel>, id: string) => {
    const found = vm.technologies.get(id);
    if (found === undefined) throw new Error(`no tech ${id}`);
    return found;
  };

  it("prefers authored names and falls back to a humanised id", () => {
    const vm = buildResearchViewModel(loaded());
    expect(tech(vm, "hc_steel").label).toBe("All-Steel Hull");
    const bare = buildResearchViewModel(
      loaded({
        technologies: fixtureProjection().technologies.map((t) => ({ ...t, name: null })),
      }),
    );
    expect(tech(bare, "hc_steel").label).toBe("Hc steel");
  });

  it("explains the draw: odds, weight, and timing", () => {
    const vm = buildResearchViewModel(loaded());
    expect(tech(vm, "hc_compound")).toMatchObject({
      oddsPct: 67,
      discoveryWeight: 4000,
      drawWeight: 4000,
      timingModifierPct: 100,
    });
  });

  it("resolves prerequisites with their live status and what is still missing", () => {
    const vm = buildResearchViewModel(loaded());
    expect(tech(vm, "hc_nickel").prerequisites).toEqual([
      { techId: "hc_compound", label: "Compound Armor", status: "open" },
    ]);
    expect(tech(vm, "hc_nickel").missingPrerequisites).toEqual(["Compound Armor"]);
  });

  it("dates future technologies from the campaign month", () => {
    const vm = buildResearchViewModel(loaded());
    expect(tech(vm, "gun_breech")).toMatchObject({
      monthsUntilAvailable: 14,
      availabilityLabel: "Mar 1881",
    });
  });

  it("says what an open technology is queued behind when its field is busy", () => {
    const busy = fixtureProjection({
      technologies: fixtureProjection().technologies.map((t) =>
        t.techId === "hc_steel"
          ? { ...t, status: "researching" as const, investedPoints: 70 }
          : t.techId === "hc_compound"
            ? { ...t, drawOddsBp: null }
            : t,
      ),
      fields: fixtureProjection().fields.map((f) =>
        f.fieldId === "HULL_CONSTRUCTION" ? { ...f, activeTechId: "hc_steel" } : f,
      ),
    });
    const vm = buildResearchViewModel(researchLoadSuccess(busy) as never);
    expect(tech(vm, "hc_compound").queuedBehind).toBe("All-Steel Hull");
  });
});
