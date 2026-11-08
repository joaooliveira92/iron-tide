import { describe, expect, it } from "vite-plus/test";
import {
  CLASSIFIED_SHIP_TYPES,
  classRuleFailures,
  DESIGN_22_EARLY,
  type ClassFacts,
  type ClassificationRules,
} from "../src/classificationRules.js";
import { checkShipTypeRequirements, shipTypeRequirements } from "../src/shipTypeRequirements.js";
import { SHIP_TYPE_IDS } from "../src/shipTypes.js";
import { UM_PER_INCH, UM_PER_KNOT } from "../src/units.js";

const R = DESIGN_22_EARLY;
const STRUCTURAL = new Set([0, 1]);
const ruleValues = (r: ClassificationRules): Set<number> =>
  new Set(Object.values(r).filter((v): v is number => typeof v === "number"));

const baseFacts: ClassFacts = {
  displacementKg: 6_000_000,
  speedUms: 18 * UM_PER_KNOT,
  beltUm: 8 * UM_PER_INCH,
  anyQualifyingArmourUm: 0,
  maxMainGunUm: 12 * UM_PER_INCH,
  mainTurretCount: 2,
  torpedoTubes: 2,
  aircraftCapacity: 0,
  deckUm: 0,
  maxHeavyMountBarrels: 2,
  maxGunUm: 12 * UM_PER_INCH,
  merchantHull: false,
};

const lcg = (seed: number) => {
  let s = seed;
  return (n: number): number => {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648;
    return s % n;
  };
};

const randomFacts = (next: (n: number) => number): ClassFacts => {
  const gun = next(14) * UM_PER_INCH;
  return {
    displacementKg: (1 + next(30)) * 1_000_000,
    speedUms: next(30) * UM_PER_KNOT,
    beltUm: next(14) * UM_PER_INCH,
    anyQualifyingArmourUm: next(5) * UM_PER_INCH,
    maxMainGunUm: gun,
    mainTurretCount: next(5),
    torpedoTubes: next(3),
    aircraftCapacity: next(7),
    deckUm: 0,
    maxHeavyMountBarrels: 2,
    maxGunUm: gun,
    merchantHull: next(2) === 1,
  };
};

describe("shipTypeRequirements", () => {
  it("lists rows for every classified type, each limit taken from the rules", () => {
    for (const id of CLASSIFIED_SHIP_TYPES) {
      const view = shipTypeRequirements(id, R);
      if (view.status !== "CLASSIFIED") throw new Error(`${id} should be classified`);
      expect(view.rows.length).toBeGreaterThan(0);
      for (const row of view.rows)
        expect(ruleValues(R).has(row.limit) || STRUCTURAL.has(row.limit)).toBe(true);
    }
  });

  it("converts limits to display units", () => {
    const view = shipTypeRequirements("B", R);
    if (view.status !== "CLASSIFIED") throw new Error("B is classified");
    expect(view.rows).toContainEqual(
      expect.objectContaining({ field: "belt", bound: "atLeast", value: 6, unit: "in" }),
    );
    expect(view.rows).toContainEqual(
      expect.objectContaining({ field: "speed", bound: "below", value: 20, unit: "kn" }),
    );
    expect(view.rows).toContainEqual(
      expect.objectContaining({ field: "displacement", bound: "atLeast", value: 5000, unit: "t" }),
    );
  });

  it("follows the rules it is given", () => {
    const r = { ...R, bBeltMinUm: 7 * UM_PER_INCH, bMaxSpeedUms: 18 * UM_PER_KNOT };
    const view = shipTypeRequirements("B", r);
    if (view.status !== "CLASSIFIED") throw new Error("B is classified");
    expect(view.rows).toContainEqual(
      expect.objectContaining({ field: "belt", bound: "atLeast", value: 7 }),
    );
    expect(view.rows).toContainEqual(
      expect.objectContaining({ field: "speed", bound: "below", value: 18 }),
    );
  });

  it("says plainly that the types without a classifier have none", () => {
    for (const id of SHIP_TYPE_IDS) {
      if ((CLASSIFIED_SHIP_TYPES as readonly string[]).includes(id)) continue;
      expect(shipTypeRequirements(id, R)).toEqual({ status: "UNCLASSIFIED" });
    }
  });

  it("reports the same unmet fields as the classifier over many facts", () => {
    const next = lcg(567);
    for (let i = 0; i < 400; i++) {
      const facts = randomFacts(next);
      for (const id of CLASSIFIED_SHIP_TYPES) {
        const failing = new Set(classRuleFailures[id](facts, R).map((f) => f.field));
        const unmet = new Set(
          checkShipTypeRequirements(id, R, facts)
            .filter((c) => !c.met)
            .map((c) => c.field),
        );
        expect([...unmet].sort()).toEqual([...failing].sort());
      }
    }
  });

  it("reads the current value in display units", () => {
    const checks = checkShipTypeRequirements("B", R, baseFacts);
    expect(checks).toContainEqual(
      expect.objectContaining({ field: "belt", current: 8, met: true }),
    );
    expect(checks).toContainEqual(
      expect.objectContaining({ field: "speed", current: 18, met: true }),
    );
    expect(checks).toContainEqual(
      expect.objectContaining({ field: "displacement", current: 6000, met: true }),
    );
  });

  it("treats a protected cruiser as meeting the light cruiser gun limit", () => {
    const protectedCruiser: ClassFacts = {
      ...baseFacts,
      beltUm: 0,
      deckUm: 2 * UM_PER_INCH,
      maxMainGunUm: R.clProtectedMaxGunUm,
      maxHeavyMountBarrels: 1,
      displacementKg: 4_000_000,
    };
    const gun = checkShipTypeRequirements("CL", R, protectedCruiser).find(
      (c) => c.field === "mainGun",
    );
    expect(gun?.met).toBe(true);
    expect(classRuleFailures.CL(protectedCruiser, R).map((f) => f.field)).not.toContain("mainGun");
  });

  it("returns no checks for a type without a classifier", () => {
    expect(checkShipTypeRequirements("CV", R, baseFacts)).toEqual([]);
  });
});
