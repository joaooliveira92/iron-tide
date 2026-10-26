import {
  ARMOUR_REGIONS,
  allOrNothingRegions,
  newArmourRegion,
  type ArmourRegion,
  type ArmourRegionId,
  type RegionSizing,
} from "./armour.js";
import { designInvariant } from "./errors.js";

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
  readonly citation: string;
  readonly unlockYear: number | null;
  readonly layout: readonly ArmourRegionId[];
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

export function applyArmourScheme(
  schemeId: ArmourSchemeId,
  regions: readonly ArmourRegion[],
  size: RegionSizing,
  materialId: string,
): ArmourRegion[] {
  const scheme = ARMOUR_SCHEMES.find((s) => s.id === schemeId);
  if (scheme === undefined) throw designInvariant(`unknown armour scheme '${schemeId}'`);
  const fitted: ReadonlySet<ArmourRegionId> = new Set(scheme.layout);
  const kept = regions.filter((r) => !SCHEME_FAMILY.has(r.region) || fitted.has(r.region));
  const have = new Set(kept.map((r) => r.region));
  const added = ARMOUR_REGIONS.filter((r) => fitted.has(r) && !have.has(r)).map((r) =>
    newArmourRegion(r, size, materialId),
  );
  const out = [...kept, ...added];
  const citadel =
    size.citadelLengthMm > 0 ? size.citadelLengthMm : Math.floor((size.lengthWlMm * 6) / 10);
  return scheme.citadelOnly ? allOrNothingRegions(out, citadel) : out;
}
