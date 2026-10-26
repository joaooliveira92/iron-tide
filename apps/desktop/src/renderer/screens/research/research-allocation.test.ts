import { describe, expect, it } from "vite-plus/test";
import { deriveProjectedResearchAllocations } from "./research-allocation.js";

describe("deriveProjectedResearchAllocations", () => {
  const draft = { GUNNERY: 4, MACHINERY: 2, HULL_CONSTRUCTION: 1 };

  it("splits the budget by weight over eligible fields only, as the engine does", () => {
    const eligible = new Set(["GUNNERY", "MACHINERY"]);
    const result = deriveProjectedResearchAllocations(60, draft, eligible);
    expect(result["GUNNERY"]).toBe(40);
    expect(result["MACHINERY"]).toBe(20);
    expect(result["HULL_CONSTRUCTION"]).toBe(0);
  });

  it("hands leftover points to the largest remainders so the total is exact", () => {
    const eligible = new Set(["GUNNERY", "MACHINERY", "HULL_CONSTRUCTION"]);
    const result = deriveProjectedResearchAllocations(10, draft, eligible);
    expect(Object.values(result).reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("allocates nothing when no field is eligible or the budget is empty", () => {
    expect(
      Object.values(deriveProjectedResearchAllocations(60, draft, new Set())).every((p) => p === 0),
    ).toBe(true);
    expect(
      Object.values(deriveProjectedResearchAllocations(0, draft, new Set(["GUNNERY"]))).every(
        (p) => p === 0,
      ),
    ).toBe(true);
  });
});
