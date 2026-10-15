import { describe, it, expect } from "vite-plus/test";
import { integerRoot, powRational } from "../src/index.js";

describe("integerRoot", () => {
  it("is exact on perfect powers and floors otherwise", () => {
    expect(integerRoot(0n, 3)).toBe(0n);
    expect(integerRoot(1n, 5)).toBe(1n);
    expect(integerRoot(27n, 3)).toBe(3n);
    expect(integerRoot(26n, 3)).toBe(2n);
    expect(integerRoot(1_000_000n ** 3n, 3)).toBe(1_000_000n);
    expect(integerRoot(1_000_000n ** 3n - 1n, 3)).toBe(999_999n);
  });
  it("satisfies r^n <= x < (r+1)^n over a sweep", () => {
    for (let n = 1; n <= 6; n++) {
      for (let x = 0n; x < 2000n; x += 7n) {
        const r = integerRoot(x, n);
        expect(r ** BigInt(n) <= x).toBe(true);
        expect((r + 1n) ** BigInt(n) > x).toBe(true);
      }
    }
  });
  it("rejects invalid input", () => {
    expect(() => integerRoot(-1n, 2)).toThrow(RangeError);
    expect(() => integerRoot(4n, 0)).toThrow(RangeError);
  });
});

describe("powRational", () => {
  it("computes displacement^(2/3) in fixed point", () => {
    // 705 t scaled by 1e6 each side: (705e6)^(2/3) = 705^(2/3) * 1e4 ≈ 79.2 * 1e4
    const v = powRational(705_000_000n, 2, 3);
    expect(Number(v) / 1e4).toBeGreaterThan(79.0);
    expect(Number(v) / 1e4).toBeLessThan(79.5);
  });
  it("handles p = 0 and monotonicity", () => {
    expect(powRational(123n, 0, 3)).toBe(1n);
    let prev = 0n;
    for (let x = 0n; x < 5000n; x += 11n) {
      const v = powRational(x, 2, 3);
      expect(v >= prev).toBe(true);
      prev = v;
    }
  });
});
