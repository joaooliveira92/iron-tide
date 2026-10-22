import { describe, expect, it } from "vite-plus/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createCompiledDesignVersion } from "@bluewave/campaign-engine";
import { ConstructionWizard } from "./ConstructionWizard.js";

const design = createCompiledDesignVersion("design_majestic", {
  className: "Majestic",
  shipType: "battleship",
  nationId: "nation_uk",
  year: 1894,
  available: true,
  mass: 16000,
  speed: 16,
  machineryType: "coal_vte",
  requiredTechnologyIds: [],
  projectedCost: 160,
  projectedCapacityUnits: 16,
  costBasis: "displacement_formula",
});

describe("ConstructionWizard", () => {
  it("shows empty state when no design selected", () => {
    const html = renderToString(
      createElement(ConstructionWizard, {
        design: null,
        economy: null,
        workspace: null,
        busy: false,
        notice: null,
        onConfirm: () => {},
      }),
    );
    expect(html).toContain("Select a design");
  });

  it("renders select-design → review → confirm fields per spec §12", () => {
    const html = renderToString(
      createElement(ConstructionWizard, {
        design,
        economy: { treasury: 50000, shipyardCapacity: 50 },
        workspace: { treasuryReserved: 0, capacityReserved: 0 },
        busy: false,
        notice: null,
        onConfirm: () => {},
      }),
    );
    // design summary: className, shipType, year, mass, speed, machineryType
    expect(html).toContain("Majestic");
    expect(html).toContain("battleship");
    expect(html).toContain("1894");
    expect(html).toContain("16,000");
    expect(html).toContain("kt");
    expect(html).toContain("coal_vte");
    // dock requirement
    expect(html).toContain("capacity units required");
    expect(html).toContain("16");
    // total projected cost: construction_order_v1, 16000/100 = 160
    expect(html).toContain("160");
    expect(html).toContain("construction_order_v1");
    // reservation impact
    expect(html).toContain("Treasury reserved");
    expect(html).toContain("Capacity reserved");
    // no ship naming, no completion time
    expect(html.toLowerCase()).not.toContain("ship-name");
    expect(html.toLowerCase()).not.toContain("completion time");
    expect(html.toLowerCase()).not.toContain("months to complete");
    // confirm button
    expect(html).toContain("Confirm order");
  });

  it("shows the engine's price for a designed ship, and says where it comes from", () => {
    const designed = createCompiledDesignVersion("des_probe", {
      className: "Probe",
      shipType: "cruiser",
      nationId: "nation_uk",
      year: 1880,
      available: true,
      mass: 2037,
      speed: 17,
      machineryType: "compound_cylindrical",
      requiredTechnologyIds: [],
      projectedCost: 11,
      projectedCapacityUnits: 2,
      costBasis: "design_cost_model",
    });
    const html = renderToString(
      createElement(ConstructionWizard, {
        design: designed,
        economy: { treasury: 1000, shipyardCapacity: 50 },
        workspace: { treasuryReserved: 0, capacityReserved: 0 },
        busy: false,
        notice: null,
        onConfirm: () => {},
      }),
    );
    expect(html).toMatch(/>11 NC(<!-- -->)? treasury units/);
    expect(html).toContain("priced by the ship-design cost model");
    expect(html).not.toContain("construction_order_v1");
    // not the displacement formula (2,037 t / 100 = 20)
    expect(html).not.toMatch(/>20 NC(<!-- -->)? treasury units/);
  });

  it("surfaces verbatim rejection when notice carries INSUFFICIENT_FUNDS", () => {
    const html = renderToString(
      createElement(ConstructionWizard, {
        design,
        economy: { treasury: 10, shipyardCapacity: 50 },
        workspace: { treasuryReserved: 0, capacityReserved: 0 },
        busy: false,
        notice: "INSUFFICIENT_FUNDS: treasury cannot cover projected cost",
        onConfirm: () => {},
      }),
    );
    expect(html).toContain("INSUFFICIENT_FUNDS");
  });

  it("shows INSUFFICIENT_CAPACITY when dock requirement exceeds capacity", () => {
    const html = renderToString(
      createElement(ConstructionWizard, {
        design,
        economy: { treasury: 50000, shipyardCapacity: 1 },
        workspace: { treasuryReserved: 0, capacityReserved: 0 },
        busy: false,
        notice: null,
        onConfirm: () => {},
      }),
    );
    expect(html).toContain("INSUFFICIENT_CAPACITY");
  });

  it("honest reservation impact never fabricates monthly figure", () => {
    const html = renderToString(
      createElement(ConstructionWizard, {
        design,
        economy: { treasury: 50000, shipyardCapacity: 50 },
        workspace: { treasuryReserved: 100, capacityReserved: 2 },
        busy: false,
        notice: null,
        onConfirm: () => {},
      }),
    );
    expect(html.toLowerCase()).not.toContain("monthly");
    expect(html).toContain("reserves the full projected cost immediately");
  });
});
