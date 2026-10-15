import { describe, it, expect } from "vite-plus/test";
import { SafeInt, checkedAdd, checkedSub, checkedMul, roundToInt } from "../src/index.js";

describe("SafeInt", () => {
  it("creates from valid integers", () => {
    expect(SafeInt(0)).toBe(0);
    expect(SafeInt(42)).toBe(42);
    expect(SafeInt(-1)).toBe(-1);
  });

  it("rejects non-integers", () => {
    expect(() => SafeInt(1.5)).toThrow();
    expect(() => SafeInt(NaN)).toThrow();
    expect(() => SafeInt(Infinity)).toThrow();
  });

  it("rejects unsafe integers", () => {
    expect(() => SafeInt(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => SafeInt(Number.MIN_SAFE_INTEGER - 1)).toThrow();
  });

  it("adds safely", () => {
    expect(SafeInt.add(SafeInt(1), SafeInt(2))).toBe(3);
    expect(SafeInt.add(SafeInt(-5), SafeInt(10))).toBe(5);
  });

  it("subtracts safely", () => {
    expect(SafeInt.sub(SafeInt(10), SafeInt(3))).toBe(7);
    expect(SafeInt.sub(SafeInt(3), SafeInt(10))).toBe(-7);
  });

  it("multiplies safely", () => {
    expect(SafeInt.mul(SafeInt(5), SafeInt(3))).toBe(15);
  });

  it("divides with trunc rounding", () => {
    expect(SafeInt.div(SafeInt(10), SafeInt(3), "trunc")).toBe(3);
    expect(SafeInt.div(SafeInt(-10), SafeInt(3), "trunc")).toBe(-3);
  });

  it("divides with floor rounding", () => {
    expect(SafeInt.div(SafeInt(10), SafeInt(3), "floor")).toBe(3);
    expect(SafeInt.div(SafeInt(-10), SafeInt(3), "floor")).toBe(-4);
  });

  it("divides with ceil rounding", () => {
    expect(SafeInt.div(SafeInt(10), SafeInt(3), "ceil")).toBe(4);
    expect(SafeInt.div(SafeInt(-10), SafeInt(3), "ceil")).toBe(-3);
  });

  it("divides with halfUp rounding", () => {
    expect(SafeInt.div(SafeInt(10), SafeInt(4), "halfUp")).toBe(3);
    expect(SafeInt.div(SafeInt(9), SafeInt(4), "halfUp")).toBe(2);
  });

  it("rejects division by zero", () => {
    expect(() => SafeInt.div(SafeInt(5), SafeInt(0))).toThrow();
  });
});

describe("checkedAdd", () => {
  it("adds two numbers", () => {
    expect(checkedAdd(5, 3)).toBe(8);
  });
});

describe("checkedSub", () => {
  it("subtracts two numbers", () => {
    expect(checkedSub(10, 4)).toBe(6);
  });
});

describe("checkedMul", () => {
  it("multiplies two numbers", () => {
    expect(checkedMul(6, 7)).toBe(42);
  });
});

describe("roundToInt", () => {
  it("rounds halfUp", () => {
    expect(roundToInt(2.5, "halfUp")).toBe(3);
    expect(roundToInt(-2.5, "halfUp")).toBe(-3);
  });

  it("rounds halfDown", () => {
    expect(roundToInt(2.5, "halfDown")).toBe(2);
    expect(roundToInt(-2.5, "halfDown")).toBe(-2);
  });

  it("rounds halfEven (banker's rounding)", () => {
    expect(roundToInt(2.5, "halfEven")).toBe(2);
    expect(roundToInt(3.5, "halfEven")).toBe(4);
  });

  it("rounds trunc", () => {
    expect(roundToInt(2.7, "trunc")).toBe(2);
    expect(roundToInt(-2.7, "trunc")).toBe(-2);
  });

  it("rounds floor", () => {
    expect(roundToInt(2.7, "floor")).toBe(2);
    expect(roundToInt(-2.7, "floor")).toBe(-3);
  });

  it("rounds ceil", () => {
    expect(roundToInt(2.1, "ceil")).toBe(3);
    expect(roundToInt(-2.1, "ceil")).toBe(-2);
  });
});
