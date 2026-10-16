import { describe, expect, it } from "vite-plus/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createCompiledDesignVersion } from "@bluewave/campaign-engine";
import { DesignPicker } from "./DesignPicker.js";

const design = createCompiledDesignVersion("des_pw_uk_dreadnought", {
  className: "Dreadnought",
  shipType: "battleship",
  nationId: "uk",
  year: 1906,
  available: false,
  mass: 18_000,
  speed: 21,
  machineryType: "steam_turbine",
  requiredTechnologyIds: [],
  projectedCost: 180,
  projectedCapacityUnits: 18,
  costBasis: "displacement_formula",
});

const render = (available: boolean) =>
  renderToString(
    createElement(DesignPicker, {
      designs: [{ ...design, available }],
      selectedDesignId: null,
      onSelectDesign: () => {},
      onSubmit: () => {},
      onRefresh: () => {},
      busy: false,
      hasPendingRequest: false,
      onRetry: undefined,
      notice: null,
    }),
  );

describe("DesignPicker era availability", () => {
  it("marks a design its era has not reached as not yet available", () => {
    expect(render(false)).toContain("Not yet available");
  });

  it("does not mark an era-available design", () => {
    expect(render(true)).not.toContain("Not yet available");
  });
});
