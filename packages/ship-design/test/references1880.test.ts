import { describe, it, expect } from "vite-plus/test";
import { compileDesign, type DesignDraft } from "../src/index.js";
import { earlyContext, readReferenceDesignEntries } from "./helpers/earlyContext.js";
import { renderExplanation } from "./helpers/explanation.js";

/**
 * The historical reference designs (starting points in the Drawing Board). Every design must be a valid,
 * buildable ship at its own month, using only technology that exists then — this is what makes it a legal
 * starting point for the campaign. Source: docs/research/ship-building-1880-ships-by-nation.md.
 */
const designs = readReferenceDesignEntries() as {
  id: string;
  name: string;
  month: string;
  draft: DesignDraft;
}[];

const byId = (id: string) => designs.find((d) => d.id === id)!;

describe("reference designs compile clean at their own month", () => {
  for (const d of designs) {
    it(`${d.id} (${d.name}) is valid at ${d.month}`, () => {
      const r = compileDesign(d.draft, earlyContext(d.month));
      const blocking = r.findings.filter(
        (f) => f.severity === "BLOCKING" || f.severity === "CRITICAL",
      );
      expect(blocking.map((f) => `${f.id}: ${renderExplanation(f.what)}`)).toEqual([]);
      expect(r.valid).toBe(true);
      expect(r.naturalClass).not.toBeNull();
    });
  }
});

describe("the January-1880 historical reference set", () => {
  const inService = [
    "devastator_1873",
    "dreadnought_1875",
    "alexandra_1877",
    "iris_1879",
    "redoutable_1878",
    "kaiser_1875",
    "sachsen_1878",
    "principe_amedeo_1874",
    "petr_velikiy_1876",
    "mesudiye_1875",
  ];

  it("includes ships for several nations, all dated January 1880", () => {
    const nations = new Set(inService.map((id) => byId(id).draft.nationId));
    expect(nations.size).toBeGreaterThanOrEqual(6);
    for (const id of inService) expect(byId(id).month).toBe("1880-01");
  });

  it("classifies the turret and central-battery ironclads as B", () => {
    for (const id of inService.filter((i) => i !== "iris_1879")) {
      const r = compileDesign(byId(id).draft, earlyContext("1880-01"));
      expect(r.naturalClass, id).toBe("B");
    }
  });

  it("the dispatch vessel Iris is a CL", () => {
    const r = compileDesign(byId("iris_1879").draft, earlyContext("1880-01"));
    expect(r.naturalClass).toBe("CL");
  });

  it("the pre-1880 guns do not exist before 1880", () => {
    const r = compileDesign(byId("devastator_1873").draft, earlyContext("1879-12"));
    expect(r.valid).toBe(false);
    expect(r.findings.map((f) => f.id)).toContain("TECH_UNAVAILABLE");
  });
});
