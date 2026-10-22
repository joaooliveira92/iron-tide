import { describe, it, expect } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  effectiveResistanceUm,
  shellPenetrationUm,
  synthesizeImpact,
} from "../../src/battleResolution/damage.js";
import {
  SHELL_MUZZLE_VELOCITY_MS,
  autoZonesForBelt,
} from "../../src/battleResolution/constants.js";
import {
  determinePenetrationOutcome,
  type PenetrationOutcome,
} from "../../src/damage/armorModel.js";
import { makeGunneryHitRecord } from "./damage-hit.js";

const V = SHELL_MUZZLE_VELOCITY_MS;

const OUTCOME_RANK: Record<PenetrationOutcome, number> = {
  NO_EFFECT: 0,
  DUD: 0,
  SPLINTER_EFFECT: 1,
  PARTIAL_PENETRATION: 2,
  FULL_PENETRATION: 3,
  PASS_THROUGH: 4,
  CRITICAL_PENETRATION: 3,
};

describe("ADR-0094: penetration matrix properties", () => {
  it("never improves the penetration outcome as armor thickens (all else equal)", () => {
    const caliberUm = 343_000;
    const capability = shellPenetrationUm(caliberUm, V);
    let previous = Number.POSITIVE_INFINITY;
    for (const thicknessUm of [76_000, 152_400, 203_200, 304_800, 406_400, 508_000]) {
      const resistance = effectiveResistanceUm({ thicknessUm });
      const rank = OUTCOME_RANK[determinePenetrationOutcome(capability, resistance, 0, false)];
      expect(rank).toBeLessThanOrEqual(previous);
      previous = rank;
    }
  });

  it("never reduces base penetration as caliber grows (all else equal)", () => {
    let previous = -1;
    for (const caliberUm of [25_000, 76_000, 120_000, 152_000, 254_000, 305_000, 343_000]) {
      const pen = shellPenetrationUm(caliberUm, V);
      expect(pen).toBeGreaterThanOrEqual(previous);
      previous = pen;
    }
  });

  it("is exact integer arithmetic and deterministic across repeats", () => {
    for (const caliberUm of [152_000, 263_000, 305_000, 343_000]) {
      const a = shellPenetrationUm(caliberUm, V);
      const b = shellPenetrationUm(caliberUm, V);
      expect(Number.isSafeInteger(a)).toBe(true);
      expect(a).toBe(b);
      expect(a).toBe(Math.floor((caliberUm * V) / 1_000));
    }
  });

  it("does not mutate the inputs it reads", () => {
    const zone = { thicknessUm: 305_000 };
    const before = JSON.stringify(zone);
    effectiveResistanceUm(zone);
    expect(JSON.stringify(zone)).toBe(before);
  });

  it("contains no nation-id conditional in the shared penetration path", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      join(here, "..", "..", "src", "battleResolution", "damage.ts"),
      "utf8",
    );
    expect(/nationId\s*===|nationId\s*!==/.test(src)).toBe(false);
  });

  it("scale-checks the armor zone builder too (no inflated pseudo-armor)", () => {
    for (const beltUm of [76_000, 152_400, 305_000, 508_000]) {
      const belt = autoZonesForBelt(beltUm)[0]!;
      expect(belt.thicknessUm).toBe(beltUm);
      for (const z of autoZonesForBelt(beltUm)) {
        expect(z.thicknessUm).toBeLessThanOrEqual(beltUm);
        expect(Number.isInteger(z.thicknessUm)).toBe(true);
      }
    }
  });
});

describe("ADR-0094: penetrating vs non-penetrating consequences", () => {
  const salvo = makeGunneryHitRecord({ batteryId: "a1:MAIN", targetContactId: "b1:d1" });

  const impactFor = (caliberUm: number, beltUm: number) => {
    const zone = autoZonesForBelt(beltUm)[0]!;
    return synthesizeImpact({
      salvo,
      targetShipId: "d1",
      zone,
      beltArmorUm: beltUm,
      mainGunsCaliberUm: caliberUm,
      shipType: "BB",
    });
  };

  it("a heavy gun against a thin belt fully penetrates, breaches and floods", () => {
    const impact = impactFor(343_000, 152_400);
    expect(["FULL_PENETRATION", "PASS_THROUGH", "CRITICAL_PENETRATION"]).toContain(
      impact.penetrationOutcome,
    );
    expect(impact.structuralDamage).toBeGreaterThan(0);
    expect(impact.hullBreach).toBe(true);
    expect(impact.flotationDamage).toBeGreaterThan(0);
  });

  it("the same gun against a thick belt is a partial, non-breaching hit", () => {
    const impact = impactFor(343_000, 508_000);
    expect(impact.penetrationOutcome).toBe("PARTIAL_PENETRATION");
    expect(impact.structuralDamage).toBeGreaterThan(0);
    expect(impact.hullBreach).toBe(false);
    expect(impact.flotationDamage).toBe(0);
  });

  it("is deterministic: the same impact synthesizes byte-identically", () => {
    expect(impactFor(343_000, 305_000)).toEqual(impactFor(343_000, 305_000));
  });
});
