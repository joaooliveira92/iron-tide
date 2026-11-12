import { describe, expect, it } from "vite-plus/test";
import {
  DESIGN_22_CLASS_FLOORS,
  HULL_FAMILY_FLOORS,
  UM_PER_INCH,
  UM_PER_KNOT,
  hullFamilyFloors,
} from "../src/index.js";

describe("hull family floors", () => {
  it("default table is derived from the DESIGN-22 class floors", () => {
    expect(HULL_FAMILY_FLOORS).toEqual(hullFamilyFloors(DESIGN_22_CLASS_FLOORS));
  });

  it("shares every DESIGN-22 floor with the class floors", () => {
    const base = DESIGN_22_CLASS_FLOORS;
    const doubled = {
      bbMinDisplacementKg: base.bbMinDisplacementKg * 2,
      bbBeltMinUm: base.bbBeltMinUm * 2,
      bbGunMinUm: base.bbGunMinUm * 2,
      caMinDisplacementKg: base.caMinDisplacementKg * 2,
      caBeltMinUm: base.caBeltMinUm * 2,
      clMinDisplacementKg: base.clMinDisplacementKg * 2,
      bMinDisplacementKg: base.bMinDisplacementKg * 2,
      bBeltMinUm: base.bBeltMinUm * 2,
      bMaxSpeedUms: base.bMaxSpeedUms * 2,
      amcMinDisplacementKg: base.amcMinDisplacementKg * 2,
    };
    const f = hullFamilyFloors(doubled);
    expect(f["battleship"]).toMatchObject({
      minDisplacementKg: doubled.bbMinDisplacementKg,
      minArmorUm: doubled.bbBeltMinUm,
      minCaliberUm: doubled.bbGunMinUm,
    });
    expect(f["heavy_cruiser"]).toMatchObject({
      minDisplacementKg: doubled.caMinDisplacementKg,
      minArmorUm: doubled.caBeltMinUm,
    });
    expect(f["armoured_cruiser"]).toMatchObject({ minDisplacementKg: doubled.caMinDisplacementKg });
    expect(f["light_cruiser"]).toMatchObject({ minDisplacementKg: doubled.clMinDisplacementKg });
    expect(f["protected_cruiser"]).toMatchObject({
      minDisplacementKg: doubled.clMinDisplacementKg,
    });
    expect(f["pre_dreadnought"]).toMatchObject({
      minDisplacementKg: doubled.bMinDisplacementKg,
      minArmorUm: doubled.bBeltMinUm,
      maxSpeedUms: doubled.bMaxSpeedUms,
    });
    expect(f["armed_merchant_cruiser"]).toMatchObject({
      minDisplacementKg: doubled.amcMinDisplacementKg,
    });
  });

  it("keeps the ship_type_classifier_v2 floors for the default rules", () => {
    const knot = UM_PER_KNOT;
    expect(HULL_FAMILY_FLOORS["battleship"]).toEqual({
      canonical: "BB",
      minDisplacementKg: 8_000_000,
      minArmorUm: 6 * UM_PER_INCH,
      minCaliberUm: 10 * UM_PER_INCH,
    });
    expect(HULL_FAMILY_FLOORS["battlecruiser"]).toEqual({
      canonical: "BC",
      minDisplacementKg: 8_000_000,
      minArmorUm: 2 * UM_PER_INCH,
      minCaliberUm: 10 * UM_PER_INCH,
    });
    expect(HULL_FAMILY_FLOORS["monitor"]).toEqual({
      canonical: "B",
      minDisplacementKg: 1_500_000,
      minArmorUm: 4 * UM_PER_INCH,
      minCaliberUm: 6 * UM_PER_INCH,
      maxSpeedUms: 18 * knot,
    });
    expect(HULL_FAMILY_FLOORS["pre_dreadnought"]).toEqual({
      canonical: "B",
      minDisplacementKg: 5_000_000,
      minArmorUm: 6 * UM_PER_INCH,
      minCaliberUm: 6 * UM_PER_INCH,
      maxSpeedUms: 20 * knot,
    });
    expect(HULL_FAMILY_FLOORS["destroyer"]).toEqual({ canonical: "DD" });
    expect(HULL_FAMILY_FLOORS["corvette"]).toEqual({ canonical: "KE" });
    expect(HULL_FAMILY_FLOORS["light_cruiser"]).toEqual({
      canonical: "CL",
      minDisplacementKg: 2_000_000,
      minCaliberUm: 6 * UM_PER_INCH,
    });
  });
});
