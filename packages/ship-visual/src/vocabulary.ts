export const VISUAL_ERA_RULESET = "ship-visual-era/1";

export const VISUAL_ERAS = [
  "VICTORIAN",
  "PRE_DREADNOUGHT",
  "DREADNOUGHT",
  "LATE_DREADNOUGHT",
] as const;
export type VisualEra = (typeof VISUAL_ERAS)[number];

export const VISUAL_ERA_CODE: Readonly<Record<VisualEra, string>> = {
  VICTORIAN: "V",
  PRE_DREADNOUGHT: "P",
  DREADNOUGHT: "D",
  LATE_DREADNOUGHT: "L",
};

export const DEFAULT_ERA: VisualEra = "DREADNOUGHT";

const ERA_LAST_YEAR: readonly (readonly [VisualEra, number])[] = [
  ["VICTORIAN", 1895],
  ["PRE_DREADNOUGHT", 1905],
  ["DREADNOUGHT", 1935],
];

export function visualEraOf(month: string): VisualEra | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  for (const [era, last] of ERA_LAST_YEAR) if (year <= last) return era;
  return "LATE_DREADNOUGHT";
}

export const NATION_STYLES = ["A", "B", "F", "G", "I", "J", "Q", "R", "S", "U", "X"] as const;
export type NationStyle = (typeof NATION_STYLES)[number];

export const UNIVERSAL_STYLE: NationStyle = "X";

const STYLE_OF_NATION: Readonly<Record<string, NationStyle>> = {
  austria_hungary: "A",
  uk: "B",
  france: "F",
  germany: "G",
  italy: "I",
  japan: "J",
  qing: "Q",
  russia: "R",
  spain: "S",
  usa: "U",
};

export function nationStyleOf(nationId: string): NationStyle {
  return STYLE_OF_NATION[nationId] ?? UNIVERSAL_STYLE;
}

export const SIZE_BANDS = ["SMALL", "MEDIUM", "LARGE"] as const;
export type SizeBand = (typeof SIZE_BANDS)[number];

const UM_PER_INCH = 25_400;

export const wholeInches = (caliberUm: number): number =>
  Math.floor((caliberUm + UM_PER_INCH / 2) / UM_PER_INCH);

export function sizeBandOf(caliberUm: number): SizeBand {
  const inches = wholeInches(caliberUm);
  if (inches <= 5) return "SMALL";
  if (inches <= 11) return "MEDIUM";
  return "LARGE";
}

export const MOUNT_CLASSES = ["TURRET", "BARBETTE", "SHIELDED", "OPEN", "CASEMATE"] as const;
export type MountClass = (typeof MOUNT_CLASSES)[number];

export const MULTI_GUN_CLASSES: ReadonlySet<MountClass> = new Set(["TURRET", "BARBETTE"]);

const GUN_CATEGORIES = new Set(["MAIN_GUN", "SECONDARY_GUN", "DUAL_PURPOSE_GUN", "AA_WEAPON"]);

const CLASS_OF_MOUNT_TYPE: Readonly<Record<string, MountClass | null>> = {
  TURRET: "TURRET",
  BARBETTE: "BARBETTE",
  DECK_SHIELDED: "SHIELDED",
  DECK_OPEN: "OPEN",
  CASEMATE: "CASEMATE",
  BROADSIDE_BATTERY: "CASEMATE",
  SUBMERGED_TUBE: null,
  ABOVE_WATER_TUBE: null,
};

export function mountClassOf(category: string, mountType: string | undefined): MountClass | null {
  if (!GUN_CATEGORIES.has(category)) return null;
  if (mountType === undefined) return category === "MAIN_GUN" ? "TURRET" : "SHIELDED";
  return CLASS_OF_MOUNT_TYPE[mountType] ?? null;
}
