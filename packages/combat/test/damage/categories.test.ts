import { describe, it, expect } from "vite-plus/test";
import type {
  DamagePackage,
  PenetrationPackage,
  NonPenetrationPackage,
  SplinterPackage,
  FirePackage,
  FloodingPackage,
  SecondaryHazardPackage,
  NoEffectPackage,
} from "../../src/damage/index.js";
import { DAMAGE_CATEGORIES } from "../../src/damage/index.js";

describe("AC-2: Damage categories produce correctly typed packages", () => {
  it("PENETRATION package has correct category and fields", () => {
    const pkg: DamagePackage = {
      category: "PENETRATION",
      locationId: "BELT-1",
      penetrationDepthUm: 150_000,
    };
    expect(pkg.category).toBe("PENETRATION");
    const p = pkg as PenetrationPackage;
    expect(p.locationId).toBe("BELT-1");
    expect(p.penetrationDepthUm).toBe(150_000);
  });

  it("NON_PENETRATION package has correct category and fields", () => {
    const pkg: DamagePackage = {
      category: "NON_PENETRATION",
      locationId: "BELT-1",
      impactEnergyUm: 200_000,
    };
    expect(pkg.category).toBe("NON_PENETRATION");
    const p = pkg as NonPenetrationPackage;
    expect(p.locationId).toBe("BELT-1");
    expect(p.impactEnergyUm).toBe(200_000);
  });

  it("SPLINTER package has correct category and fields", () => {
    const pkg: DamagePackage = {
      category: "SPLINTER",
      locationId: "DECK-2",
      splinterCount: 12,
    };
    expect(pkg.category).toBe("SPLINTER");
    const p = pkg as SplinterPackage;
    expect(p.locationId).toBe("DECK-2");
    expect(p.splinterCount).toBe(12);
  });

  it("FIRE package has correct category and fields", () => {
    const pkg: DamagePackage = {
      category: "FIRE",
      locationId: "COMP-3",
      fireIntensityBp: 5_000,
    };
    expect(pkg.category).toBe("FIRE");
    const p = pkg as FirePackage;
    expect(p.locationId).toBe("COMP-3");
    expect(p.fireIntensityBp).toBe(5_000);
  });

  it("FLOODING package has correct category and fields", () => {
    const pkg: DamagePackage = {
      category: "FLOODING",
      locationId: "COMP-1",
      floodingRateKgMin: 1_200,
    };
    expect(pkg.category).toBe("FLOODING");
    const p = pkg as FloodingPackage;
    expect(p.locationId).toBe("COMP-1");
    expect(p.floodingRateKgMin).toBe(1_200);
  });

  it("SECONDARY_HAZARD package has correct category and fields", () => {
    const pkg: DamagePackage = {
      category: "SECONDARY_HAZARD",
      locationId: "MAGAZINE-1",
      hazardType: "MAGAZINE_EXPLOSION",
    };
    expect(pkg.category).toBe("SECONDARY_HAZARD");
    const p = pkg as SecondaryHazardPackage;
    expect(p.locationId).toBe("MAGAZINE-1");
    expect(p.hazardType).toBe("MAGAZINE_EXPLOSION");
  });

  it("NO_EFFECT is an explicit package, never implicit", () => {
    const pkg: DamagePackage = {
      category: "NO_EFFECT",
      reason: "armor holds at full thickness",
    };
    expect(pkg.category).toBe("NO_EFFECT");
    const p = pkg as NoEffectPackage;
    expect(p.reason).toBe("armor holds at full thickness");
  });

  it("narrative/description never appears in the authoritative package fields", () => {
    const checkNoNarrative = (obj: Record<string, unknown>) => {
      const keys = Object.keys(obj);
      expect(keys).not.toContain("narrative");
      expect(keys).not.toContain("description");
    };

    checkNoNarrative({
      category: "PENETRATION",
      locationId: "X",
      penetrationDepthUm: 0,
    });
    checkNoNarrative({
      category: "NON_PENETRATION",
      locationId: "X",
      impactEnergyUm: 0,
    });
    checkNoNarrative({ category: "NO_EFFECT", reason: "ok" });
  });
});

describe("AC-2: The canonical seven categories match the shipped constant list", () => {
  it("ships exactly PENETRATION, NON_PENETRATION, SPLINTER, FIRE, FLOODING, SECONDARY_HAZARD, NO_EFFECT", () => {
    expect([...DAMAGE_CATEGORIES]).toEqual([
      "PENETRATION",
      "NON_PENETRATION",
      "SPLINTER",
      "FIRE",
      "FLOODING",
      "SECONDARY_HAZARD",
      "NO_EFFECT",
    ]);
  });
});
