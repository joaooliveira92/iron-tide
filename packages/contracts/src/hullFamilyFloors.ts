import { UM_PER_INCH, UM_PER_KNOT } from "./units.js";

export interface Design22ClassFloors {
  readonly clMinDisplacementKg: number;
  readonly caMinDisplacementKg: number;
  readonly caBeltMinUm: number;
  readonly bMinDisplacementKg: number;
  readonly bBeltMinUm: number;
  readonly bMaxSpeedUms: number;
  readonly bbMinDisplacementKg: number;
  readonly bbBeltMinUm: number;
  readonly bbGunMinUm: number;
  readonly amcMinDisplacementKg: number;
}

export const DESIGN_22_CLASS_FLOORS: Design22ClassFloors = {
  clMinDisplacementKg: 2_000_000,
  caMinDisplacementKg: 4_000_000,
  caBeltMinUm: 2 * UM_PER_INCH,
  bMinDisplacementKg: 5_000_000,
  bBeltMinUm: 6 * UM_PER_INCH,
  bMaxSpeedUms: 20 * UM_PER_KNOT,
  bbMinDisplacementKg: 8_000_000,
  bbBeltMinUm: 6 * UM_PER_INCH,
  bbGunMinUm: 10 * UM_PER_INCH,
  amcMinDisplacementKg: 1_700_000,
};

export interface HullFamilyFloors {
  readonly canonical: string;
  readonly minDisplacementKg?: number;
  readonly minArmorUm?: number;
  readonly minCaliberUm?: number;
  readonly maxSpeedUms?: number;
}

export type HullFamilyFloorTable = Readonly<Record<string, HullFamilyFloors>>;

export const hullFamilyFloors = (r: Design22ClassFloors): HullFamilyFloorTable => {
  const battleLine = {
    canonical: "BB",
    minDisplacementKg: r.bbMinDisplacementKg,
    minArmorUm: r.bbBeltMinUm,
    minCaliberUm: r.bbGunMinUm,
  };
  const cruiser = {
    canonical: "CA",
    minDisplacementKg: r.caMinDisplacementKg,
    minArmorUm: r.caBeltMinUm,
    minCaliberUm: 6 * UM_PER_INCH,
  };
  const preDreadnought = {
    canonical: "B",
    minDisplacementKg: r.bMinDisplacementKg,
    minArmorUm: r.bBeltMinUm,
    minCaliberUm: 6 * UM_PER_INCH,
    maxSpeedUms: r.bMaxSpeedUms,
  };
  const openingBand = {
    canonical: "B",
    minDisplacementKg: 1_500_000,
    minArmorUm: 4 * UM_PER_INCH,
    minCaliberUm: 6 * UM_PER_INCH,
    maxSpeedUms: 18 * UM_PER_KNOT,
  };
  return {
    battleship: battleLine,
    dreadnought: battleLine,
    super_dreadnought: battleLine,
    battlecruiser: {
      canonical: "BC",
      minDisplacementKg: r.bbMinDisplacementKg,
      minArmorUm: r.caBeltMinUm,
      minCaliberUm: r.bbGunMinUm,
    },
    heavy_cruiser: cruiser,
    light_cruiser: {
      canonical: "CL",
      minDisplacementKg: r.clMinDisplacementKg,
      minCaliberUm: 6 * UM_PER_INCH,
    },
    destroyer: { canonical: "DD" },
    pre_dreadnought: preDreadnought,
    armoured_cruiser: cruiser,
    protected_cruiser: { canonical: "CL", minDisplacementKg: r.clMinDisplacementKg },
    corvette: { canonical: "KE" },
    armed_merchant_cruiser: { canonical: "AMC", minDisplacementKg: r.amcMinDisplacementKg },
    monitor: openingBand,
    coast_defense_ship: openingBand,
    central_battery_ship: openingBand,
    ironclad_turret_ship: openingBand,
  };
};

export const HULL_FAMILY_FLOORS: HullFamilyFloorTable = hullFamilyFloors(DESIGN_22_CLASS_FLOORS);
