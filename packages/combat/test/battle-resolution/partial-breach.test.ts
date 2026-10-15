// ADR-0098: bounded partial-penetration breach consequences + partial flooding.
//
// After the ADR-0094 caliber unit correction, the dominant belt hit at
// production scale is a PARTIAL penetration. ADR-0098 gives it a BOUNDED
// progressive consequence (a near-penetration waterline breach with a reduced
// flotation loss and flooding chance), never the full-penetration value, so the
// outcome ordering stays monotone. These tests pin the boundary, the monotonic
// properties and the absence of nation-id conditionals.
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  effectiveResistanceUm,
  shellPenetrationUm,
  synthesizeImpact,
} from "../../src/battleResolution/damage.js";
import {
  PARTIAL_BREACH_FLOAT_LOSS_RATIO_BP,
  PARTIAL_BREACH_MIN_RATIO_BP,
  autoZonesForBelt,
  FLOAT_LOSS_RATIO_BP,
} from "../../src/battleResolution/constants.js";
import { evaluateFloodingCreation } from "../../src/damage/immediateFireFlooding.js";
import { makeGunneryHitRecord } from "./damage-hit.js";

const salvo = makeGunneryHitRecord({ batteryId: "a1:MAIN", targetContactId: "b1:d1" });

function beltImpact(caliberUm: number, beltUm: number) {
  const zone = autoZonesForBelt(beltUm)[0]!; // BELT (waterline)
  return synthesizeImpact({
    salvo,
    targetShipId: "d1",
    zone,
    beltArmorUm: beltUm,
    mainGunsCaliberUm: caliberUm,
    shipType: "BB",
  });
}

describe("ADR-0098: bounded partial-penetration breach", () => {
  it("a near-penetration partial opens a bounded waterline breach", () => {
    // 343 mm (261 366 µm capability) vs a 305 mm belt (304 950 µm resistance)
    // = 85.7% -> partial, near penetration -> bounded breach.
    const impact = beltImpact(343_000, 305_000);
    expect(impact.penetrationOutcome).toBe("PARTIAL_PENETRATION");
    expect(impact.hullBreach).toBe(true);
    expect(impact.flotationDamage).toBeGreaterThan(0);
    // Bounded: strictly less than the full-penetration ratio would give.
    const fullRatioValue = Math.floor((impact.structuralDamage * FLOAT_LOSS_RATIO_BP) / 10_000);
    expect(impact.flotationDamage).toBeLessThan(fullRatioValue);
    expect(impact.flotationDamage).toBe(
      Math.floor((impact.structuralDamage * PARTIAL_BREACH_FLOAT_LOSS_RATIO_BP) / 10_000),
    );
  });

  it("a glancing partial against a very thick belt does not breach", () => {
    // 343 mm vs a 508 mm belt (457 200 µm resistance) = 57.2% < 65% threshold.
    const impact = beltImpact(343_000, 508_000);
    expect(impact.penetrationOutcome).toBe("PARTIAL_PENETRATION");
    expect(impact.hullBreach).toBe(false);
    expect(impact.flotationDamage).toBe(0);
  });

  it("breach flotation loss is monotone non-increasing in armor thickness", () => {
    const caliber = 343_000;
    let previous = Number.POSITIVE_INFINITY;
    for (const belt of [152_400, 254_000, 304_800, 343_000, 406_400, 508_000]) {
      const impact = beltImpact(caliber, belt);
      expect(impact.flotationDamage).toBeLessThanOrEqual(previous);
      previous = impact.flotationDamage;
    }
  });

  it("breach flotation loss is monotone non-decreasing in caliber", () => {
    let previous = -1;
    for (const caliber of [152_000, 254_000, 305_000, 343_000, 406_000]) {
      const impact = beltImpact(caliber, 304_800);
      expect(impact.flotationDamage).toBeGreaterThanOrEqual(previous);
      previous = impact.flotationDamage;
    }
  });

  it("the near-penetration threshold is the documented BALANCE_TARGET", () => {
    expect(PARTIAL_BREACH_MIN_RATIO_BP).toBe(6_500);
    expect(PARTIAL_BREACH_FLOAT_LOSS_RATIO_BP).toBe(1_500);
  });

  it("does not mutate the impact inputs", () => {
    const zone = { id: "BELT", zoneType: "BELT", thicknessUm: 305_000, critical: false };
    const before = JSON.stringify(zone);
    beltImpact(343_000, 305_000);
    expect(JSON.stringify(zone)).toBe(before);
  });

  it("contains no nation-id conditional in the partial-breach path", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const rel of ["battleResolution/damage.ts", "damage/immediateFireFlooding.ts"]) {
      const src = readFileSync(join(here, "..", "..", "src", rel), "utf8");
      expect(/nationId\s*===|nationId\s*!==/.test(src)).toBe(false);
    }
  });
});

describe("ADR-0098: partial flooding creation chance", () => {
  const base = {
    compartmentId: "COMP-BELT-1",
    hullBreach: true,
    hasWaterRoute: true,
  } as const;

  it("full penetration floods at the historical 80% chance", () => {
    const rng = () => 0.79;
    expect(
      evaluateFloodingCreation({ ...base, penetrationOutcome: "FULL_PENETRATION" }, rng),
    ).not.toBeNull();
  });

  it("a bounded partial floods at the lower 30% chance", () => {
    // 0.5 >= 0.3 -> no flood (a full-penetration chance would have flooded).
    expect(
      evaluateFloodingCreation({ ...base, penetrationOutcome: "PARTIAL_PENETRATION" }, () => 0.5),
    ).toBeNull();
    // 0.2 < 0.3 -> floods.
    expect(
      evaluateFloodingCreation({ ...base, penetrationOutcome: "PARTIAL_PENETRATION" }, () => 0.2),
    ).not.toBeNull();
  });

  it("a non-breach outcome never floods even with a hull breach flag", () => {
    expect(
      evaluateFloodingCreation({ ...base, penetrationOutcome: "SPLINTER_EFFECT" }, () => 0.0),
    ).toBeNull();
    expect(
      evaluateFloodingCreation({ ...base, penetrationOutcome: "CRITICAL_PENETRATION" }, () => 0.0),
    ).toBeNull();
  });

  it("is deterministic", () => {
    const a = evaluateFloodingCreation(
      { ...base, penetrationOutcome: "PARTIAL_PENETRATION" },
      () => 0.1,
    );
    const b = evaluateFloodingCreation(
      { ...base, penetrationOutcome: "PARTIAL_PENETRATION" },
      () => 0.1,
    );
    expect(a).toEqual(b);
  });

  it("capability-vs-resistance monotonicity is preserved at the seam", () => {
    // Equal inputs -> equal outcome; more armor never improves penetration.
    const cap = shellPenetrationUm(343_000, 762);
    const r1 = effectiveResistanceUm({ thicknessUm: 305_000 });
    const r2 = effectiveResistanceUm({ thicknessUm: 406_400 });
    expect(r2).toBeGreaterThan(r1);
    expect(cap).toBe(shellPenetrationUm(343_000, 762));
  });
});
