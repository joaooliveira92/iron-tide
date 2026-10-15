import { describe, it, expect } from "vite-plus/test";
import { lintCatalogue, type ComponentDef } from "../src/index.js";

const base: ComponentDef = {
  id: "gun_bl_12in",
  displayName: "12-inch BL",
  category: "MAIN_GUN",
  introduction: { fromMonth: "1881-03", obsoleteMonth: null },
  requires: ["tech_heavy_bl"],
  parameters: { barrels: { min: 1, max: 4, step: 1 } },
  constants: { per_barrel: 46_000 },
  weightKg: "per_barrel * barrels",
  volumeLitre: "1000 * barrels",
  costMicro: "5000000 * barrels",
  crew: "12 * barrels",
  powerKw: "0",
  upgradePath: [],
  tags: [],
};
const techs = new Set(["tech_heavy_bl"]);
const codes = (defs: ComponentDef[]) => lintCatalogue(defs, techs).map((i) => i.code);

describe("lintCatalogue", () => {
  it("accepts a valid component", () => {
    expect(lintCatalogue([base], techs)).toEqual([]);
  });
  it("flags structural problems", () => {
    expect(codes([base, base])).toContain("DUPLICATE_ID");
    expect(codes([{ ...base, id: "Bad-Id" }])).toContain("BAD_ID");
    expect(codes([{ ...base, requires: ["nope"] }])).toContain("UNKNOWN_TECH");
    expect(
      codes([{ ...base, introduction: { fromMonth: "1881-13", obsoleteMonth: null } }]),
    ).toContain("BAD_MONTH");
    expect(codes([{ ...base, upgradePath: ["ghost"] }])).toContain("UNKNOWN_UPGRADE");
    expect(codes([{ ...base, parameters: { barrels: { min: 4, max: 1, step: 1 } } }])).toContain(
      "BAD_PARAMETER",
    );
  });
  it("flags formula problems, negative weight over the parameter range and eval errors", () => {
    expect(codes([{ ...base, weightKg: "per_barrel *" }])).toContain("BAD_FORMULA");
    expect(codes([{ ...base, weightKg: "mystery * 2" }])).toContain("UNKNOWN_VARIABLE");
    expect(codes([{ ...base, weightKg: "1000 - 600 * barrels" }])).toContain("NEGATIVE_VALUE");
    expect(codes([{ ...base, weightKg: "100 / (barrels - 1)" }])).toContain("FORMULA_EVAL");
  });
  it("detects upgrade cycles", () => {
    const a = { ...base, id: "a", upgradePath: ["b"] };
    const b = { ...base, id: "b", upgradePath: ["a"] };
    expect(codes([a, b])).toContain("UPGRADE_CYCLE");
  });
  it("is independent of input order", () => {
    const a = { ...base, id: "a", weightKg: "per_barrel - 99999" };
    const b = { ...base, id: "b", requires: ["x"] };
    expect(lintCatalogue([a, b], techs)).toEqual(lintCatalogue([b, a], techs));
  });
});
