// The ship-type registry (DESIGN-22 section 1): one definition per canonical type, owned by the domain. Numeric
// boundaries are NOT repeated here; they live in `ClassificationRules` (classification.ts) and the envelope shown to
// players is derived from them (`shipTypeEnvelope`), so a ruleset change is one edit.
import type { EngineBehaviourClass } from "@bluewave/content-schema";
import { SHIP_TYPES } from "./shipTypeData.js";

/** The fourteen canonical types in DESIGN-22 precedence order. Anything else is `SHIP_TYPE_UNREGISTERED`. */
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

/** DESIGN-22 section 6 era bands. */
export const ERA_BANDS = ["EARLY", "PRE_WAR", "INTERWAR", "MID_CENTURY", "LATE"] as const;
export type EraBand = (typeof ERA_BANDS)[number];

const ERA_START_YEAR: Readonly<Record<EraBand, number>> = {
  EARLY: 1880,
  PRE_WAR: 1900,
  INTERWAR: 1920,
  MID_CENTURY: 1940,
  LATE: 1960,
};

/** The band a campaign month (YYYY-MM) falls in; null before 1880 or for a malformed month (never a silent default). */
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

/**
 * Roles the strategic simulation does not model yet (DESIGN-33 trade, raiding and mine warfare have no campaign
 * implementation): a type listing one in `roles` is meant for it by design, but nothing in the campaign rewards it.
 * The UI says so rather than promise the mechanic (ADR-0088).
 */
export const UNSIMULATED_ROLES: readonly ShipRole[] = [
  "COMMERCE_RAIDING",
  "COMMERCE_PROTECTION",
  "MINELAYING",
];

export type TorpedoPolicy = "REQUIRED" | "PROHIBITED" | "OPTIONAL";

/** Capability ids a nation or scenario can grant; a type's `requiresCapability` is checked against these. */
export type CapabilityId = string;

export interface ShipTypeAvailabilityRequirement {
  /** First era band the type exists in. */
  readonly fromEra: EraBand;
  /** Technology id (from the scenario technology list) that must be unlocked, or null when era alone suffices. */
  readonly requiresTech: string | null;
  /** Nation capability that must be granted, or null. */
  readonly requiresCapability: CapabilityId | null;
  /** False while the mechanics the type needs (aircraft, pressure hulls, cargo) are not in the game: always locked. */
  readonly mechanicsImplemented: boolean;
}

export interface ShipTypeDefinition {
  readonly id: ShipTypeId;
  readonly name: string;
  /**
   * The closed engine behaviour class this type resolves to (ADR-0156 §2, invariant I-16). It is
   * authored on the ship-type record and mirrored here for the code registry; no content string can
   * select executable behaviour, only name one of the closed classes.
   */
  readonly engineClass: EngineBehaviourClass;
  readonly era: EraBand;
  readonly category: ShipTypeCategory;
  readonly roles: readonly ShipRole[];
  readonly description: string;
  /** One-line guidance for the selection screen. */
  readonly recommendedUse: string;
  readonly weaknesses: string;
  readonly armourProfile: string;
  readonly armamentProfile: string;
  /** Ordinal 1 (cheap) to 5 (most expensive) among the types of the same era; a comparison aid, not a price. */
  readonly relativeCost: 1 | 2 | 3 | 4 | 5;
  /** Ordinal 1 (fastest to build) to 5 (slowest). */
  readonly relativeBuildTime: 1 | 2 | 3 | 4 | 5;
  readonly torpedoes: TorpedoPolicy;
  /** An auxiliary or special project: not a regular frontline warship; fleet-limited and valued accordingly. */
  readonly auxiliary: boolean;
  /** Hull-form trait the design must use (e.g. `merchant_derived`), or null. */
  readonly requiredHullTrait: string | null;
  readonly availability: ShipTypeAvailabilityRequirement;
  /** Position within the roster (ascending). */
  readonly order: number;
}

/**
 * The engine `hullType` a design of each type is stored under. The engine and the construction screen take the
 * hull type as an authored string, so the type-to-hull-type mapping is domain data: the main process derives it
 * here and the engine rejects a SubmitDesign whose hull type disagrees with its category.
 */
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

/** Registry entries in roster order. */
export const SHIP_TYPE_LIST: readonly ShipTypeDefinition[] = SHIP_TYPE_IDS.map(
  (id) => SHIP_TYPES[id],
).sort((a, b) => a.order - b.order);

/** The six types the opening campaign offers (era EARLY, no technology gate, mechanics present). */
export const OPENING_SHIP_TYPES: readonly ShipTypeId[] = SHIP_TYPE_LIST.filter(
  (t) =>
    t.availability.fromEra === "EARLY" &&
    t.availability.requiresTech === null &&
    t.availability.mechanicsImplemented,
).map((t) => t.id);
