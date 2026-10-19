/**
 * Named armour schemes (ADR-0232 section 3): a scheme is data (id, display name, citation, availability gate) plus a
 * deterministic transformation over the region list. It is a starting layout, not a parallel armour model: applying one
 * yields an ordinary region list the per-region editor ("Custom") then edits freely.
 */
import {
  ARMOUR_REGIONS,
  allOrNothingRegions,
  newArmourRegion,
  type ArmourRegion,
  type ArmourRegionId,
  type RegionSizing,
} from "./armour.js";

export const ARMOUR_SCHEME_IDS = [
  "FLAT_DECK_ON_BELT",
  "PROTECTED_CRUISER",
  "BELT_AND_SLOPING_DECK",
  "ALL_OR_NOTHING",
] as const;
export type ArmourSchemeId = (typeof ARMOUR_SCHEME_IDS)[number];

export interface ArmourSchemeDef {
  readonly id: ArmourSchemeId;
  readonly displayName: string;
  /** Where the manual names the scheme. The layout itself is a BALANCE TARGET convention (ADR-0213). */
  readonly citation: string;
  /**
   * First calendar year the scheme is offered (the global designer unlock year, ADR-0229); null = in-era. The years of
   * the gated schemes are BALANCE TARGETs, not sourced.
   */
  readonly unlockYear: number | null;
  /** The belt-and-deck regions this scheme fits; any other belt or deck region is removed. */
  readonly layout: readonly ArmourRegionId[];
  /** Cut the layout to the citadel (all or nothing). */
  readonly citadelOnly: boolean;
}

export const ARMOUR_SCHEMES: readonly ArmourSchemeDef[] = [
  {
    id: "FLAT_DECK_ON_BELT",
    displayName: "Flat deck on top of belt",
    citation: "RTW3 manual p.38",
    unlockYear: null,
    layout: ["BELT_MAIN", "BELT_ENDS", "DECK_MAIN"],
    citadelOnly: false,
  },
  {
    id: "PROTECTED_CRUISER",
    displayName: "Protected cruiser",
    citation: "RTW3 manual p.38",
    unlockYear: null,
    layout: ["DECK_MAIN", "DECK_SLOPE", "DECK_EXTENDED"],
    citadelOnly: false,
  },
  {
    id: "BELT_AND_SLOPING_DECK",
    displayName: "Belt and sloping deck",
    citation: "RTW3 manual p.39",
    unlockYear: 1905,
    layout: ["BELT_MAIN", "BELT_UPPER", "BELT_ENDS", "DECK_MAIN", "DECK_SLOPE"],
    citadelOnly: false,
  },
  {
    id: "ALL_OR_NOTHING",
    displayName: "All or nothing",
    citation: "RTW3 manual p.39",
    unlockYear: 1912,
    layout: ["BELT_MAIN", "DECK_MAIN", "DECK_SLOPE"],
    citadelOnly: true,
  },
];

/** The belt-and-deck regions a scheme owns; every other region is the player's and survives a scheme change. */
const SCHEME_FAMILY: ReadonlySet<ArmourRegionId> = new Set([
  "BELT_MAIN",
  "BELT_UPPER",
  "BELT_ENDS",
  "DECK_MAIN",
  "DECK_SLOPE",
  "DECK_EXTENDED",
]);

export const armourSchemeAvailable = (scheme: ArmourSchemeDef, calendarYear: number): boolean =>
  scheme.unlockYear === null || calendarYear >= scheme.unlockYear;

/**
 * Applies a scheme to a region list. Family regions the scheme fits keep the player's plate; ones it fits and the list
 * lacks start at the `newArmourRegion` convention; the rest of the family is removed; non-family regions are untouched.
 * Existing order is kept and additions follow in canonical order, so applying a scheme twice changes nothing. Pure.
 */
export function applyArmourScheme(
  schemeId: ArmourSchemeId,
  regions: readonly ArmourRegion[],
  size: RegionSizing,
  materialId: string,
): ArmourRegion[] {
  const scheme = ARMOUR_SCHEMES.find((s) => s.id === schemeId);
  if (scheme === undefined) throw new Error(`unknown armour scheme '${schemeId}'`);
  const fitted: ReadonlySet<ArmourRegionId> = new Set(scheme.layout);
  const kept = regions.filter((r) => !SCHEME_FAMILY.has(r.region) || fitted.has(r.region));
  const have = new Set(kept.map((r) => r.region));
  const added = ARMOUR_REGIONS.filter((r) => fitted.has(r) && !have.has(r)).map((r) =>
    newArmourRegion(r, size, materialId),
  );
  const out = [...kept, ...added];
  // An unset citadel (0) falls back to 60% of the waterline, as `newArmourRegion` does; never cut plates to zero length.
  const citadel =
    size.citadelLengthMm > 0 ? size.citadelLengthMm : Math.floor((size.lengthWlMm * 6) / 10);
  return scheme.citadelOnly ? allOrNothingRegions(out, citadel) : out;
}
