import { describe, it, expect } from "vite-plus/test";
import { parseFormula, evaluate, freeVariables, FormulaError } from "../src/index.js";

const run = (src: string, vars: Record<string, number> = {}, tables = {}) =>
  evaluate(parseFormula(src), { vars, tables });

describe("formula grammar", () => {
  it("respects precedence and integer floor division", () => {
    expect(run("2 + 3 * 4")).toBe(14);
    expect(run("(2 + 3) * 4")).toBe(20);
    expect(run("7 / 2")).toBe(3);
    expect(run("-7 / 2")).toBe(-4);
    expect(run("-3 + 5")).toBe(2);
    expect(run("1_000 * 2")).toBe(2000);
  });
  it("evaluates variables and functions", () => {
    expect(run("per * barrels + 5", { per: 46_000, barrels: 4 })).toBe(184_005);
    expect(run("min(3, 1, 2)")).toBe(1);
    expect(run("max(3, 9, 2)")).toBe(9);
    expect(run("clamp(15, 0, 10)")).toBe(10);
    expect(run("clamp(-5, 0, 10)")).toBe(0);
    expect(run("ceildiv(7, 2)")).toBe(4);
    expect(run("ceildiv(-7, 2)")).toBe(-3);
    expect(run("mulbp(3, 5000)")).toBe(2);
    expect(run("pow(27, 2, 3)")).toBe(9);
    expect(run("pow(705000000, 2, 3)")).toBeGreaterThan(790_000);
  });
  it("lookup interpolates, clamps and floors", () => {
    const tables = {
      sfc: {
        points: [
          [0, 100],
          [100, 200],
          [200, 150],
        ] as [number, number][],
      },
    };
    expect(run("lookup(sfc, x)", { x: -5 }, tables)).toBe(100);
    expect(run("lookup(sfc, x)", { x: 50 }, tables)).toBe(150);
    expect(run("lookup(sfc, x)", { x: 150 }, tables)).toBe(175);
    expect(run("lookup(sfc, x)", { x: 999 }, tables)).toBe(150);
    expect(run("lookup(sfc, x)", { x: 101 }, tables)).toBe(199);
    expect(freeVariables(parseFormula("lookup(sfc, x) + y"))).toEqual(new Set(["x", "y"]));
  });
  it("rejects invalid input with FormulaError", () => {
    for (const bad of [
      "1.5",
      "2 +",
      "foo(1)",
      "min()",
      "clamp(1,2)",
      "1 $ 2",
      "(1",
      "1 2",
      "pow(1,2)",
    ]) {
      expect(() => parseFormula(bad), bad).toThrow(FormulaError);
    }
    expect(() => run("1 / 0")).toThrow(FormulaError);
    expect(() => run("x")).toThrow(FormulaError);
    expect(() => run("lookup(nope, 1)")).toThrow(FormulaError);
    expect(() => run("pow(-1, 1, 2)")).toThrow(FormulaError);
    expect(() => run("9007199254740991 * 9007199254740991")).toThrow();
  });
  it("is deterministic across repeated evaluation", () => {
    const e = parseFormula("pow(x, 2, 3) * y / 7");
    const a = evaluate(e, { vars: { x: 705_000_000, y: 11 } });
    for (let i = 0; i < 20; i++) expect(evaluate(e, { vars: { x: 705_000_000, y: 11 } })).toBe(a);
  });
});
