import { describe, it, expect } from "vite-plus/test";
import * as contracts from "@bluewave/contracts";
import * as shipDesignUnits from "../src/units.js";

describe("canonical unit consolidation (map D2)", () => {
  it("re-exports the canonical constructors and helpers from contracts (one definition)", () => {
    expect(shipDesignUnits.kg).toBe(contracts.kg);
    expect(shipDesignUnits.um).toBe(contracts.um);
    expect(shipDesignUnits.umPerSec).toBe(contracts.umPerSec);
    expect(shipDesignUnits.litre).toBe(contracts.litre);
    expect(shipDesignUnits.kw).toBe(contracts.kw);
    expect(shipDesignUnits.bp).toBe(contracts.bp);
    expect(shipDesignUnits.mulBp).toBe(contracts.mulBp);
    expect(shipDesignUnits.ceilDiv).toBe(contracts.ceilDiv);
    expect(shipDesignUnits.toSafe).toBe(contracts.toSafe);
    expect(shipDesignUnits.knotsToUmPerSec).toBe(contracts.knotsToUmPerSec);
    expect(shipDesignUnits.UnitError).toBe(contracts.UnitError);
  });

  it("re-exports the canonical constants from contracts (one definition)", () => {
    expect(shipDesignUnits.BP_ONE).toBe(contracts.BP_ONE);
    expect(shipDesignUnits.UM_PER_INCH).toBe(contracts.UM_PER_INCH);
    expect(shipDesignUnits.UM_PER_KNOT).toBe(contracts.UM_PER_KNOT);
  });

  it("keeps the authoring (mm) and sub-unit money brands local", () => {
    expect(shipDesignUnits.mm(5)).toBe(5);
    expect(shipDesignUnits.budgetMicro(5)).toBe(5);
    expect(shipDesignUnits.workMicro(5)).toBe(5);
  });
});
