import { describe, it, expect } from "vite-plus/test";
import { KNOTS_TO_UMS, MM_TO_UM } from "@bluewave/contracts";
import * as designUnits from "../src/designUnits.js";

describe("canonical design-unit consolidation (map D2)", () => {
  it("re-exports the canonical constants from contracts (one definition)", () => {
    expect(designUnits.MM_TO_UM).toBe(MM_TO_UM);
    expect(designUnits.KNOTS_TO_UMS).toBe(KNOTS_TO_UMS);
  });

  it("keeps the authoring and display conversions", () => {
    expect(designUnits.mmToUm(3)).toBe(3 * MM_TO_UM);
    expect(designUnits.knotsToUms(2)).toBe(2 * KNOTS_TO_UMS);
    expect(designUnits.umToMm(MM_TO_UM)).toBe(1);
  });
});
