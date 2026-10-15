import { describe, expect, it } from "vite-plus/test";
import { createCompiledDesignVersion } from "@bluewave/campaign-engine";
import { constructionWizardView } from "./wizard-view.js";

const design = createCompiledDesignVersion("design_majestic", {
  className: "Majestic",
  shipType: "battleship",
  nationId: "nation_uk",
  year: 1894,
  mass: 16000,
  speed: 16,
  machineryType: "coal_vte",
  requiredTechnologyIds: [],
  projectedCost: 160,
  projectedCapacityUnits: 16,
  costBasis: "displacement_formula",
});

describe("constructionWizardView", () => {
  it("surfaces the engine's projected cost and capacity unchanged", () => {
    const view = constructionWizardView(design, null, null);
    expect(view.projectedCost).toBe(160);
    expect(view.projectedCapacityUnits).toBe(16);
  });

  it("adds the order's projections to the workspace's reservations", () => {
    const view = constructionWizardView(
      design,
      { treasury: 50000, shipyardCapacity: 50 },
      { treasuryReserved: 100, capacityReserved: 2 },
    );
    expect(view.afterTreasury).toBe(260);
    expect(view.afterCapacity).toBe(18);
    expect(view.treasuryOver).toBe(false);
    expect(view.capacityOver).toBe(false);
  });

  it("flags treasury and capacity when the order over-commits", () => {
    const view = constructionWizardView(
      design,
      { treasury: 10, shipyardCapacity: 1 },
      { treasuryReserved: 0, capacityReserved: 0 },
    );
    expect(view.treasuryOver).toBe(true);
    expect(view.capacityOver).toBe(true);
  });

  it("treats a missing economy and workspace as zero, not as free capacity", () => {
    const view = constructionWizardView(design, null, null);
    expect(view.treasury).toBe(0);
    expect(view.capacity).toBe(0);
    expect(view.reservedTreasury).toBe(0);
    expect(view.reservedCapacity).toBe(0);
    expect(view.afterTreasury).toBe(160);
    expect(view.treasuryOver).toBe(true);
    expect(view.capacityOver).toBe(true);
  });
});
