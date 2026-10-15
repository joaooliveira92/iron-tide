/**
 * Canonical research-field registry (DESIGN-20 §1) and priority weights
 * (DESIGN-20 §5). Placed in the leaf schema package so both @bluewave/commands
 * (priority-command validation) and @bluewave/phase-engine (research
 * resolution) share a single authoritative source instead of duplicating it.
 */

export const CANONICAL_RESEARCH_FIELD_IDS = [
  "HULL_CONSTRUCTION",
  "MACHINERY",
  "SHIP_DESIGN",
  "GUNNERY",
  "FIRE_CONTROL",
  "TORPEDOES",
  "SUBMARINES",
  "MINES_AND_ASW",
  "AVIATION",
  "CARRIER_OPERATIONS",
  "RADAR_AND_ELECTRONICS",
  "MISSILES",
  "AMPHIBIOUS_OPERATIONS",
  "INFRASTRUCTURE",
  "DAMAGE_CONTROL",
] as const;

export type ResearchFieldId = (typeof CANONICAL_RESEARCH_FIELD_IDS)[number];

export const RESEARCH_FIELD_PRIORITY_WEIGHTS = {
  HIGH: 4,
  MEDIUM: 2,
  LOW: 1,
} as const;

export const MAX_HIGH_PRIORITY_FIELDS = 5;
