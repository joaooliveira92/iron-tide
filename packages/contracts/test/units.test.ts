import { describe, it, expect } from "vite-plus/test";
import {
  BP_ONE,
  MM_TO_UM,
  KNOTS_TO_UMS,
  UM_PER_INCH,
  UnitError,
  bp,
  ceilDiv,
  isUnitError,
  kg,
  kw,
  litre,
  money,
  mulBp,
  toSafe,
  um,
  umPerSec,
} from "../src/index.js";

describe("canonical unit constants", () => {
  it("declares the canonical conversion constants once", () => {
    expect(BP_ONE).toBe(10_000);
    expect(MM_TO_UM).toBe(1_000);
    expect(KNOTS_TO_UMS).toBe(514_444);
    expect(UM_PER_INCH).toBe(25_400);
  });
});

describe("canonical unit constructors", () => {
  it("accepts a valid canonical value", () => {
    expect(kg(5)).toBe(5);
    expect(um(5)).toBe(5);
    expect(umPerSec(5)).toBe(5);
    expect(litre(5)).toBe(5);
    expect(kw(5)).toBe(5);
    expect(money(5)).toBe(5);
  });

  it("rejects a non-integer", () => {
    expect(() => kg(1.5)).toThrow(UnitError);
    expect(() => um(NaN)).toThrow(UnitError);
    expect(() => umPerSec(Infinity)).toThrow(UnitError);
  });

  it("rejects an unsafe integer", () => {
    expect(() => litre(Number.MAX_SAFE_INTEGER + 1)).toThrow(UnitError);
    expect(() => kw(Number.MIN_SAFE_INTEGER - 1)).toThrow(UnitError);
  });

  it("rejects a negative magnitude", () => {
    expect(() => kg(-1)).toThrow(UnitError);
  });

  it("allows signed money and ratios (treasury models deficits)", () => {
    expect(money(-1)).toBe(-1);
    expect(bp(-100)).toBe(-100);
  });

  it("throws a _tag-discriminated UnitError", () => {
    try {
      kg(1.5);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(isUnitError(error)).toBe(true);
    }
  });
});

describe("canonical checked helpers", () => {
  it("applies basis points exactly, rounding half up once", () => {
    expect(mulBp(1000, BP_ONE)).toBe(1000);
    expect(mulBp(1000, 5000)).toBe(500);
    expect(mulBp(1000, 2500)).toBe(250);
    expect(mulBp(1, 5000)).toBe(1);
    expect(mulBp(1, 4999)).toBe(0);
  });

  it("divides rounding up, rejecting a non-positive divisor", () => {
    expect(ceilDiv(10, 3)).toBe(4);
    expect(ceilDiv(9, 3)).toBe(3);
    expect(ceilDiv(1, 2)).toBe(1);
    expect(() => ceilDiv(5, 0)).toThrow(UnitError);
  });

  it("converts a bigint to a safe number, rejecting overflow", () => {
    expect(toSafe("x", 5n)).toBe(5);
    expect(() => toSafe("x", BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(UnitError);
  });
});
