import { describe, it, expect } from "vite-plus/test";
import { RandomEngine } from "@bluewave/random";
import {
  isHit,
  resolveHit,
  gunneryHitStreamId,
  GUNNERY_ACCURACY_FINAL_MIN_BP,
  GUNNERY_ACCURACY_FINAL_MAX_BP,
} from "../../src/gunnery/index.js";

const HIT_DRAW_MAX = GUNNERY_ACCURACY_FINAL_MAX_BP - 1; // 9_999

describe("AC-4 hit-check draw semantics (DESIGN-39 §3, INC-2)", () => {
  it("succeeds exactly when draw < finalAccuracyBp", () => {
    // boundary: draw == finalAccuracyBp is a MISS.
    expect(isHit(5_000, 5_000)).toBe(false);
    // draw == finalAccuracyBp - 1 is a HIT.
    expect(isHit(5_000, 4_999)).toBe(true);
    // below and above
    expect(isHit(5_000, 0)).toBe(true);
    expect(isHit(5_000, 9_999)).toBe(false);
  });

  it("draw 0 vs 0 accuracy is a MISS (0 < 0 is false)", () => {
    expect(isHit(0, 0)).toBe(false);
    expect(isHit(0, 1)).toBe(false);
  });

  it("a perfect accuracy (10_000) hits on every legal draw", () => {
    for (const d of [0, 1, 9_998, 9_999]) {
      expect(isHit(10_000, d)).toBe(true);
    }
  });

  it("an accuracy of exactly 9_999 misses on draw 9_999 and hits on draw 9_998", () => {
    expect(isHit(9_999, 9_999)).toBe(false);
    expect(isHit(9_999, 9_998)).toBe(true);
  });
});

describe("AC-4 keyed hit draw (domain-separated @bluewave/random stream)", () => {
  const identity = { battleId: "battle-1", batteryId: "BAT-7", minute: 12, substep: 3 };

  it("builds a stable domain-separated stream id", () => {
    expect(gunneryHitStreamId(identity)).toBe("gunnery/accuracy/hit:battle-1:BAT-7:12:3");
    expect(gunneryHitStreamId(identity)).toBe(
      gunneryHitStreamId({ ...identity, minute: 12, substep: 3 }),
    );
  });

  it("draws one integer in 0..9_999", () => {
    const engine = new RandomEngine("seed-for-hit");
    const hit = resolveHit(engine, identity, 5_000);
    expect(Number.isInteger(hit.draw)).toBe(true);
    expect(hit.draw).toBeGreaterThanOrEqual(GUNNERY_ACCURACY_FINAL_MIN_BP);
    expect(hit.draw).toBeLessThanOrEqual(HIT_DRAW_MAX);
  });

  it("is deterministic for identical key + seed", () => {
    const a = resolveHit(new RandomEngine("master-seed"), identity, 6_000);
    const b = resolveHit(new RandomEngine("master-seed"), identity, 6_000);
    expect(a.draw).toBe(b.draw);
    expect(a.isHit).toBe(b.isHit);
    expect(a.inputHash).toBe(b.inputHash);
  });

  it("isHit matches draw < finalAccuracyBp on the keyed draw", () => {
    const engine = new RandomEngine("seed-for-consistency");
    for (const accuracy of [0, 1, 4_999, 5_000, 9_999, 10_000]) {
      const hit = resolveHit(engine, { ...identity, minute: accuracy % 60 }, accuracy);
      expect(hit.finalAccuracyBp).toBe(accuracy);
      expect(hit.isHit).toBe(isHit(accuracy, hit.draw));
    }
  });

  it("records the draw as a random decision in the returned record (for INC-4)", () => {
    const engine = new RandomEngine("seed-for-record");
    const hit = resolveHit(engine, identity, 5_000);
    expect(hit.streamId).toContain("gunnery/accuracy/hit");
    expect(hit.entityKey).toBe(`${identity.battleId}:${identity.batteryId}`);
    expect(hit.phase).toBe("resolve_gunnery_accuracy");
    expect(hit.rulesetVersion).toBe("gunnery_ruleset_v1");
    expect(hit.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hit.draw).toBeGreaterThanOrEqual(0);
    expect(hit.draw).toBeLessThanOrEqual(9_999);
    expect(typeof hit.isHit).toBe("boolean");
  });
});
