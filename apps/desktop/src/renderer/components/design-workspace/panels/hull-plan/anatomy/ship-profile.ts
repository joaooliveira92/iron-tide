import type { MountClass } from "@bluewave/ship-visual";

export const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  MAIN_GUN: "Main gun",
  SECONDARY_GUN: "Secondary gun",
  TERTIARY_GUN: "Tertiary gun",
  DUAL_PURPOSE_GUN: "Dual-purpose gun",
  AA_WEAPON: "Anti-aircraft gun",
  TORPEDO_TUBE: "Torpedo tube",
  DIRECTOR: "Fire-control director",
  RANGEFINDER: "Rangefinder",
  RADAR: "Radar",
  SONAR: "Sonar",
  COMMS: "Communications",
  AIRCRAFT_FACILITY: "Aircraft facility",
  MINE_GEAR: "Mine gear",
  GENERATOR: "Generator",
  BOILER: "Boiler",
  ENGINE: "Engine",
  SHAFT_PROPELLER: "Shaft and propeller",
  FUEL_BUNKER: "Fuel bunker",
  MAGAZINE: "Magazine",
  AMMUNITION: "Ammunition",
  DAMAGE_CONTROL: "Damage control",
  ACCOMMODATION: "Accommodation",
  SPECIAL_EQUIPMENT: "Special equipment",
  MOUNT: "Mount",
};

export const MOUNT_LABEL: Readonly<Record<MountClass, string>> = {
  TURRET: "turret",
  BARBETTE: "barbette",
  SHIELDED: "shielded mount",
  OPEN: "open mount",
  CASEMATE: "casemate",
};

export interface ShipProfile {
  readonly name: string;
  readonly masts: 1 | 2;
  readonly boats: 0 | 1 | 2 | 4;
  readonly mastRise: number;
}

const SHIP_PROFILES: Readonly<Record<string, ShipProfile>> = {
  torpedo_boat_form: { name: "Torpedo boat", masts: 1, boats: 0, mastRise: 0.7 },
  protected_cruiser_form: { name: "Protected cruiser", masts: 2, boats: 2, mastRise: 1 },
  coast_defence_form: { name: "Coast-defence ship", masts: 1, boats: 2, mastRise: 0.8 },
  pre_dreadnought_form: { name: "Battleship", masts: 2, boats: 2, mastRise: 1 },
  merchant_liner_form: { name: "Liner", masts: 2, boats: 4, mastRise: 1.15 },
};

export const profileOf = (hullFormId: string, lengthM: number): ShipProfile =>
  SHIP_PROFILES[hullFormId] ?? {
    name: "Warship",
    masts: lengthM < 70 ? 1 : 2,
    boats: lengthM < 70 ? 1 : 2,
    mastRise: 1,
  };
