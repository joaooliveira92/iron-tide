import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import { salvoBatchAccuracyBp, SALVO_BATCH_VERSION } from "@bluewave/combat/gunnery";
import { INVALID_GUNNERY_STATE } from "@bluewave/combat/gunnery";

describe("gunnery_salvo_batch_v1 (P-1 ticket 06) — salvo count sensitivity", () => {
  it("identity: N = 1 returns the per-round probability; N = 0 returns 0", () => {
    for (const q of [0, 1, 60, 875, 5_000, 9_999, 10_000]) {
      expect(salvoBatchAccuracyBp(q, 1)).toBe(q);
    }
    expect(salvoBatchAccuracyBp(875, 0)).toBe(0);
    expect(salvoBatchAccuracyBp(10_000, 0)).toBe(0);
  });

  it("boundary q: 0 stays 0 for any N; 10_000 stays 10_000 for any N >= 1 (N = 0 is always 0)", () => {
    for (const n of [0, 1, 2, 8, 16]) {
      expect(salvoBatchAccuracyBp(0, n)).toBe(0);
    }
    expect(salvoBatchAccuracyBp(10_000, 0)).toBe(0);
    for (const n of [1, 2, 8, 16]) {
      expect(salvoBatchAccuracyBp(10_000, n)).toBe(10_000);
    }
  });

  it("exact integer values (half-up ceil semantics, authoritative over floats)", () => {
    expect(salvoBatchAccuracyBp(875, 4)).toBe(3_066);
    expect(salvoBatchAccuracyBp(1_500, 8)).toBe(7_275);
    expect(salvoBatchAccuracyBp(5_000, 2)).toBe(7_500);
    expect(salvoBatchAccuracyBp(3_000, 6)).toBe(8_823);
  });

  it("monotone: more guns never lower the salvo chance; higher q never lowers it", () => {
    const q = [60, 201, 341, 524, 875, 1_500];
    for (let i = 1; i < q.length; i++) {
      expect(salvoBatchAccuracyBp(q[i]!, 4)).toBeGreaterThan(salvoBatchAccuracyBp(q[i - 1]!, 4));
    }
    for (const n of [1, 2, 4, 8, 16]) {
      expect(salvoBatchAccuracyBp(875, n)).toBeGreaterThanOrEqual(salvoBatchAccuracyBp(875, 1));
    }
    expect(salvoBatchAccuracyBp(875, 8)).toBeGreaterThan(salvoBatchAccuracyBp(875, 4));
    expect(salvoBatchAccuracyBp(875, 16)).toBeLessThan(10_000);
    expect(salvoBatchAccuracyBp(1_500, 64)).toBeLessThan(10_000);
  });

  it("invalid inputs fail closed", () => {
    for (const [q, n] of [
      [-1, 1],
      [10_001, 1],
      [1.5, 1],
      [Number.NaN, 1],
      [875, -1],
      [875, 1.5],
      [875, 1_000_001],
    ] as const) {
      let caught: unknown;
      try {
        salvoBatchAccuracyBp(q as number, n as number);
      } catch (e) {
        caught = e;
      }
      expect(isBluewaveError(caught), `q=${q} N=${n}`).toBe(true);
      expect((caught as BluewaveError).message).toBe(INVALID_GUNNERY_STATE);
    }
  });

  it("versioned identity", () => {
    expect(SALVO_BATCH_VERSION).toBe("gunnery_salvo_batch_v1");
  });
});
