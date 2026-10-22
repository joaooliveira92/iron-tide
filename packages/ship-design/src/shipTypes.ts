import type { EngineBehaviourClass } from "@bluewave/content-schema";
import { SHIP_TYPES } from "./shipTypeData.js";

export const SHIP_TYPE_IDS = [
  "CV",
  "CVL",
  "AV",
  "SS",
  "MTB",
  "TR",
  "BB",
  "BC",
  "B",
  "CA",
  "CL",
  "DD",
  "KE",
  "AMC",
] as const;
export type ShipTypeId = (typeof SHIP_TYPE_IDS)[number];

export const isShipTypeId = (s: unknown): s is ShipTypeId =>
  typeof s === "string" && (SHIP_TYPE_IDS as readonly string[]).includes(s);

export const ERA_BANDS = ["EARLY", "PRE_WAR", "INTERWAR", "MID_CENTURY", "LATE"] as const;
export type EraBand = (typeof ERA_BANDS)[number];

const ERA_START_YEAR: Readonly<Record<EraBand, number>> = {
  EARLY: 1880,
  PRE_WAR: 1900,
  INTERWAR: 1920,
  MID_CENTURY: 1940,
  LATE: 1960,
};

export function eraBandOf(month: string): EraBand | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  let found: EraBand | null = null;
  for (const band of ERA_BANDS) if (year >= ERA_START_YEAR[band]) found = band;
  return found;
}

export const eraBandReached = (month: string, from: EraBand): boolean => {
  const band = eraBandOf(month);
  return band !== null && ERA_BANDS.indexOf(band) >= ERA_BANDS.indexOf(from);
};

export const SHIP_TYPE_CATEGORIES = [
  "CAPITAL_SHIP",
  "CRUISER",
  "LIGHT_COMBATANT",
  "COLONIAL_VESSEL",
  "AUXILIARY",
  "AVIATION",
  "SUBMARINE",
] as const;
export type ShipTypeCategory = (typeof SHIP_TYPE_CATEGORIES)[number];

export const SHIP_ROLES = [
  "BATTLE_LINE",
  "FLEET_SCOUTING",
  "COMMERCE_PROTECTION",
  "COMMERCE_RAIDING",
  "COLONIAL_PRESENCE",
  "CRUISER_HUNTING",
  "PATROL",
  "FOREIGN_STATION",
  "SCREENING",
  "TORPEDO_ATTACK",
  "COASTAL_DEFENCE",
  "MINELAYING",
  "LOCAL_DEFENCE",
  "AVIATION",
  "UNDERSEA",
  "TRANSPORT",
] as const;
export type ShipRole = (typeof SHIP_ROLES)[number];

export const UNSIMULATED_ROLES: readonly ShipRole[] = [
  "COMMERCE_RAIDING",
  "COMMERCE_PROTECTION",
  "MINELAYING",
];

export type TorpedoPolicy = "REQUIRED" | "PROHIBITED" | "OPTIONAL";

export type CapabilityId = string;

export interface ShipTypeAvailabilityRequirement {
  readonly fromEra: EraBand;
  readonly requiresTech: string | null;
  readonly requiresCapability: CapabilityId | null;
  readonly mechanicsImplemented: boolean;
}

export interface ShipTypeDefinition {
  readonly id: ShipTypeId;
  readonly name: string;
  readonly engineClass: EngineBehaviourClass;
  readonly era: EraBand;
  readonly category: ShipTypeCategory;
  readonly roles: readonly ShipRole[];
  readonly description: string;
  readonly recommendedUse: string;
  readonly weaknesses: string;
  readonly armourProfile: string;
  readonly armamentProfile: string;
  readonly relativeCost: 1 | 2 | 3 | 4 | 5;
  readonly relativeBuildTime: 1 | 2 | 3 | 4 | 5;
  readonly torpedoes: TorpedoPolicy;
  readonly auxiliary: boolean;
  readonly requiredHullTrait: string | null;
  readonly availability: ShipTypeAvailabilityRequirement;
  readonly order: number;
}

export const HULL_TYPE_FOR_SHIP_TYPE = {
  B: "pre_dreadnought",
  CA: "armoured_cruiser",
  CL: "protected_cruiser",
  DD: "destroyer",
  KE: "corvette",
  AMC: "armed_merchant_cruiser",
  BB: "dreadnought",
} as const satisfies Partial<Record<ShipTypeId, string>>;

export { SHIP_TYPES };

export const SHIP_TYPE_LIST: readonly ShipTypeDefinition[] = SHIP_TYPE_IDS.map(
  (id) => SHIP_TYPES[id],
).sort((a, b) => a.order - b.order);

export const OPENING_SHIP_TYPES: readonly ShipTypeId[] = SHIP_TYPE_LIST.filter(
  (t) =>
    t.availability.fromEra === "EARLY" &&
    t.availability.requiresTech === null &&
    t.availability.mechanicsImplemented,
).map((t) => t.id);
