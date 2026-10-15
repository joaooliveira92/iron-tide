import { Schema } from "effect";

/**
 * Shared vocabularies for the naval-profile schema, kept in one place so the Effect Schema enums and the domain string
 * unions in `@bluewave/ship-design`'s `nationProfile.ts` cannot drift independently (a parity test pins them).
 */

export const SOURCE_STATUSES = [
  "VERIFIED",
  "DERIVED",
  "ESTIMATE",
  "BALANCE_TARGET",
  "PLACEHOLDER",
] as const;
export const SOURCE_STATUSES_SCHEMA = Schema.Literals(SOURCE_STATUSES);
export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export const CONFIDENCE_LEVELS_SCHEMA = Schema.Literals(CONFIDENCE_LEVELS);
export const PROVENANCE_KINDS_SCHEMA = Schema.Literals([
  "historical_fact",
  "game_conversion",
  "balance_adjustment",
]);
export const COMPONENT_ACCESS_STATUSES_SCHEMA = Schema.Literals([
  "DOMESTIC",
  "LICENSE_BUILT",
  "IMPORTED",
  "CAPTURED_OR_STUDIED",
  "UNAVAILABLE",
]);
export const NAVAL_POSTURES_SCHEMA = Schema.Literals([
  "battle_fleet_concentration",
  "commerce_defence",
  "commerce_raiding",
  "colonial_presence",
  "coastal_defence",
  "regional_warfare",
  "distant_water_operations",
  "torpedo_warfare",
]);

/** DESIGN-22 canonical ship-type ids, duplicated here because content-schema cannot depend on ship-design. */
export const SHIP_TYPE_ID_VALUES = [
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
