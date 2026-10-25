import { describe, it, expect } from "vite-plus/test";
import { compileDesign, type DesignDraft } from "../src/index.js";
import { earlyContext, readReferenceDesignEntries } from "./helpers/earlyContext.js";
import { renderExplanation } from "./helpers/explanation.js";

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

describe("the 1945 United States destroyer (E-1 1940-1949)", () => {
  const draft = byId("starter_dd_usa_1945").draft;

  it("is a destroyer under the 1940 classification rules and a light cruiser under the base rules", () => {
    expect(compileDesign(draft, earlyContext("1945-01")).naturalClass).toBe("DD");
    const base = compileDesign(draft, {
      ...earlyContext("1945-01"),
      balance: {
        ...earlyContext("1945-01").balance,
        classificationFromMonth: undefined,
        classification: earlyContext("1939-12").balance.classification,
      },
    });
    expect(base.naturalClass).toBe("CL");
  });

  it("is not available before its 5-inch twin mount", () => {
    const r = compileDesign(draft, earlyContext("1944-12"));
    expect(r.valid).toBe(false);
    expect(r.findings.map((f) => f.id)).toContain("TECH_UNAVAILABLE");
  });
});

describe("the 1948 United States cruisers (E-1 1940-1949)", () => {
  const light = byId("starter_cl_usa_1948").draft;
  const heavy = byId("starter_ca_usa_1948").draft;

  it("classes the Worcester as a light cruiser and the Des Moines as a heavy cruiser", () => {
    expect(compileDesign(light, earlyContext("1948-01")).naturalClass).toBe("CL");
    expect(compileDesign(heavy, earlyContext("1948-01")).naturalClass).toBe("CA");
  });

  it("closes on the sourced full-load displacement and 33 knots", () => {
    const worcester = compileDesign(light, earlyContext("1948-01"));
    const desMoines = compileDesign(heavy, earlyContext("1948-01"));
    expect(Math.abs(worcester.totalKg - 17_997_000)).toBeLessThan(50_000);
    expect(Math.abs(desMoines.totalKg - 20_934_000)).toBeLessThan(50_000);
    expect(worcester.machinery?.maxSpeedMilliKnots).toBeGreaterThanOrEqual(32_900);
    expect(desMoines.machinery?.maxSpeedMilliKnots).toBeGreaterThanOrEqual(32_900);
  });

  it("is not available before the 1948 turrets", () => {
    for (const draft of [light, heavy]) {
      const r = compileDesign(draft, earlyContext("1947-12"));
      expect(r.valid).toBe(false);
      expect(r.findings.map((f) => f.id)).toContain("TECH_UNAVAILABLE");
    }
  });
});
