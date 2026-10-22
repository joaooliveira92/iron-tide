import { describe, it, expect } from "vite-plus/test";
import { kg, bp, mulBp, ceilDiv, knotsToUmPerSec, UnitError } from "../src/index.js";

describe("units", () => {
  it("rejects non-integers, unsafe integers and negatives", () => {
    expect(() => kg(1.5)).toThrow(UnitError);
    expect(() => kg(-1)).toThrow(UnitError);
    expect(() => kg(Number.MAX_SAFE_INTEGER + 1)).toThrow(UnitError);
    expect(() => kg(Number.NaN)).toThrow(UnitError);
    expect(kg(0)).toBe(0);
  });
  it("allows negative basis points", () => {
    expect(bp(-500)).toBe(-500);
  });
  it("mulBp rounds half up and survives large products", () => {
    expect(mulBp(10, 5000)).toBe(5);
    expect(mulBp(3, 5000)).toBe(2);
    expect(mulBp(1, 4999)).toBe(0);
    expect(mulBp(-3, 5000)).toBe(-1);
    expect(mulBp(2_000_000_000_000, 12_500)).toBe(2_500_000_000_000);
  });
  it("ceilDiv", () => {
    expect(ceilDiv(7, 2)).toBe(4);
    expect(ceilDiv(8, 2)).toBe(4);
    expect(ceilDiv(0, 5)).toBe(0);
    expect(() => ceilDiv(1, 0)).toThrow(UnitError);
  });
  it("converts knots exactly per ADR-0037", () => {
    expect(knotsToUmPerSec(20)).toBe(10_288_880);
  });
});
