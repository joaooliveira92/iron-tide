import type { ZoneId } from "@bluewave/ship-design";
import { PLAN_W, stationX } from "./geometry.js";

/**
 * The eight longitudinal sections under the plan, bow to stern (the MISSION overlay zone has no strip), and their
 * fixed names and copy. Presentation metadata only: what each section *shows* is derived in `section-facts.ts`.
 */
export const SECTION_IDS = [
  "forecastle",
  "forward-magazine",
  "forward-service",
  "central-machinery",
  "superstructure",
  "aft-service",
  "aft-magazine",
  "quarterdeck",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface SectionMeta {
  /** The hull-form zone this section draws. */
  readonly zoneId: Exclude<ZoneId, "MISSION">;
  /** Full readable name: the trigger's accessible name and the card heading. */
  readonly name: string;
  /** Visible label when the strip is narrow. */
  readonly shortLabel: string;
  /** One line on what the section is for. General naval usage, not design data. */
  readonly purpose: string;
}

/** Single source of every section's names and copy; exhaustive over `SectionId`. */
export const SECTIONS: { readonly [K in SectionId]: SectionMeta } = {
  forecastle: {
    zoneId: "FORECASTLE",
    name: "Forecastle",
    shortLabel: "Forecastle",
    purpose: "The bow and forward deck: the stem, ground tackle and the foremost gun positions.",
  },
  "forward-magazine": {
    zoneId: "FWD_MAGAZINE",
    name: "Forward magazine",
    shortLabel: "Fwd magazine",
    purpose: "Ammunition stowage for the forward guns, low in the hull and below the waterline.",
  },
  "forward-service": {
    zoneId: "FWD_SERVICE",
    name: "Forward service",
    shortLabel: "Fwd service",
    purpose:
      "Service spaces between the forward magazine and the machinery: stores, crew and auxiliaries.",
  },
  "central-machinery": {
    zoneId: "CENTRAL_MACHINERY",
    name: "Central machinery",
    shortLabel: "Machinery",
    purpose: "Boiler and engine rooms amidships, with their bunkers, uptakes and funnels.",
  },
  superstructure: {
    zoneId: "SUPERSTRUCTURE",
    name: "Superstructure",
    shortLabel: "Superstructure",
    purpose: "The deck houses above the main deck: bridge, conning position and boats.",
  },
  "aft-service": {
    zoneId: "AFT_SERVICE",
    name: "Aft service",
    shortLabel: "Aft service",
    purpose: "Service spaces abaft the machinery: stores, accommodation and auxiliaries.",
  },
  "aft-magazine": {
    zoneId: "AFT_MAGAZINE",
    name: "Aft magazine",
    shortLabel: "Aft magazine",
    purpose: "Ammunition stowage for the after guns, low in the hull and below the waterline.",
  },
  quarterdeck: {
    zoneId: "QUARTERDECK",
    name: "Quarterdeck",
    shortLabel: "Quarterdeck",
    purpose: "The stern and after deck: steering gear and the aftermost gun positions.",
  },
};

export interface ZoneRange {
  readonly id: string;
  readonly startPermille: number;
  readonly endPermille: number;
  readonly volumeBp?: number;
  readonly deckAreaBp?: number;
}

/** Horizontal placement of a section in the plan, as percentages of the drawing width (so it scales with it). */
export function sectionSpan(zone: ZoneRange): { leftPct: number; widthPct: number } {
  const left = stationX(zone.startPermille);
  return {
    leftPct: (left / PLAN_W) * 100,
    widthPct: ((stationX(zone.endPermille) - left) / PLAN_W) * 100,
  };
}
