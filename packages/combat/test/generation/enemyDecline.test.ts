import { describe, expect, it } from "vite-plus/test";
import { enemyDeclineDrawDeclines, enemyDeclinePredicateHolds } from "../../src/index.js";

describe("enemyDeclinePredicateHolds (T-1 07)", () => {
  it("compares enemy/player in basis points exactly, with the stated strictness", () => {
    // 320 / 800 = exactly 4000 bp.
    expect(enemyDeclinePredicateHolds("LESS_THAN", 4_000, 320, 800)).toBe(false);
    expect(enemyDeclinePredicateHolds("LESS_OR_EQUAL", 4_000, 320, 800)).toBe(true);
    expect(enemyDeclinePredicateHolds("LESS_THAN", 4_000, 319, 800)).toBe(true);
    expect(enemyDeclinePredicateHolds("LESS_OR_EQUAL", 4_000, 321, 800)).toBe(false);
  });

  it("never holds against an empty player force and survives unsafe-product magnitudes", () => {
    expect(enemyDeclinePredicateHolds("LESS_OR_EQUAL", 10_000, 0, 0)).toBe(false);
    const big = Number.MAX_SAFE_INTEGER;
    expect(enemyDeclinePredicateHolds("LESS_THAN", 10_000, big - 1, big)).toBe(true);
    expect(enemyDeclinePredicateHolds("LESS_THAN", 10_000, big, big)).toBe(false);
  });
});

describe("enemyDeclineDrawDeclines", () => {
  it("declines on a draw strictly under the probability", () => {
    expect(enemyDeclineDrawDeclines(5_999, 6_000)).toBe(true);
    expect(enemyDeclineDrawDeclines(6_000, 6_000)).toBe(false);
    expect(enemyDeclineDrawDeclines(0, 0)).toBe(false);
    expect(enemyDeclineDrawDeclines(9_999, 10_000)).toBe(true);
  });
});
