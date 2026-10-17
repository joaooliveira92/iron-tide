/**
 * The display-unit taxonomy and the canonical→display conversions (U-3 map D2/D3).
 * This is one half of the single presentation conversion home: every screen reads
 * a display unit from here instead of dividing by a literal at the call site.
 *
 * Runtime-free: it imports only the canonical table from `@bluewave/contracts`
 * and the effect-free preferences types. It never touches `effect`, Node, the
 * filesystem, or an authoritative package.
 */
import {
  KNOTS_TO_UMS,
  MM_TO_UM,
  UM_PER_INCH,
  type Kg,
  type Kw,
  type Litre,
  type Um,
  type UmPerSec,
} from "@bluewave/contracts";

import type { MeasurementPreset } from "../../../shared/preferences-contract.js";

/** Per-category display-unit selections (mirrors the U-2 preference shape). */
export type MeasurementSelections = Readonly<Record<string, string>>;

/** Canonical micrometres in one yard (36 inches). */
export const UM_PER_YARD = UM_PER_INCH * 36;
/** Canonical micrometres in one metre. */
export const UM_PER_METRE = 1_000_000;
/** Canonical micrometres in one kilometre. */
export const UM_PER_KILOMETRE = 1_000_000_000;
/** Kilograms in one tonne. */
export const KG_PER_TONNE = 1_000;
/** Kilograms in one pound (international avoirdupois, exact). */
export const KG_PER_POUND = 0.45359237;
/** Litres in one cubic metre. */
export const LITRE_PER_CUBIC_METRE = 1_000;
/** Kilowatts in one mechanical horsepower (1 hp = 745.699872 W). */
export const KW_PER_HORSEPOWER = 0.745699872;

export const MEASUREMENT_CATEGORIES = [
  "speed",
  "length",
  "calibre",
  "armour",
  "range",
  "mass",
  "volume",
  "power",
] as const;
export type MeasurementCategory = (typeof MEASUREMENT_CATEGORIES)[number];

export type DisplayUnitId =
  | "knots"
  | "metresPerSecond"
  | "inches"
  | "millimetres"
  | "metres"
  | "yards"
  | "kilometres"
  | "tonnes"
  | "pounds"
  | "litres"
  | "cubicMetres"
  | "kilowatts"
  | "horsepower";

/** The canonical quantity a category converts from. */
export type CanonicalQuantity = "Um" | "UmPerSec" | "Kg" | "Litre" | "Kw";

export interface DisplayUnitDefinition {
  readonly id: DisplayUnitId;
  readonly category: MeasurementCategory;
  readonly symbol: string;
  /** The preset this unit is the default for, or `both`. */
  readonly preset: MeasurementPreset | "both";
  /** canonical unit → display value (may be fractional; presentation only). */
  readonly fromCanonical: (canonical: number) => number;
  /** display value → canonical unit (authoring/parser direction). */
  readonly toCanonical: (display: number) => number;
}

const umToInches = (v: number): number => v / UM_PER_INCH;
const inchesToUm = (v: number): number => v * UM_PER_INCH;
const umToMm = (v: number): number => v / MM_TO_UM;
const mmToUmValue = (v: number): number => v * MM_TO_UM;
const umToMetres = (v: number): number => v / UM_PER_METRE;
const metresToUm = (v: number): number => v * UM_PER_METRE;
const umToYards = (v: number): number => v / UM_PER_YARD;
const yardsToUm = (v: number): number => v * UM_PER_YARD;
const umsToKnots = (v: number): number => v / KNOTS_TO_UMS;
const knotsToUms = (v: number): number => v * KNOTS_TO_UMS;
const umsToMetresPerSecond = (v: number): number => v / UM_PER_METRE;
const metresPerSecondToUms = (v: number): number => v * UM_PER_METRE;
const kgToTonnes = (v: number): number => v / KG_PER_TONNE;
const tonnesToKg = (v: number): number => v * KG_PER_TONNE;
const kgToPounds = (v: number): number => v / KG_PER_POUND;
const poundsToKg = (v: number): number => v * KG_PER_POUND;
const litreToCubicMetres = (v: number): number => v / LITRE_PER_CUBIC_METRE;
const cubicMetresToLitre = (v: number): number => v * LITRE_PER_CUBIC_METRE;
const kwToHorsepower = (v: number): number => v / KW_PER_HORSEPOWER;
const horsepowerToKw = (v: number): number => v * KW_PER_HORSEPOWER;

const ALL_UNITS: readonly DisplayUnitDefinition[] = [
  // speed — knots is the naval default in both presets.
  {
    id: "knots",
    category: "speed",
    symbol: "kn",
    preset: "both",
    fromCanonical: umsToKnots,
    toCanonical: knotsToUms,
  },
  {
    id: "metresPerSecond",
    category: "speed",
    symbol: "m/s",
    preset: "both",
    fromCanonical: umsToMetresPerSecond,
    toCanonical: metresPerSecondToUms,
  },
  // length / calibre / armour / range — canonical micrometres.
  {
    id: "inches",
    category: "calibre",
    symbol: "in",
    preset: "imperial",
    fromCanonical: umToInches,
    toCanonical: inchesToUm,
  },
  {
    id: "millimetres",
    category: "calibre",
    symbol: "mm",
    preset: "metric",
    fromCanonical: umToMm,
    toCanonical: mmToUmValue,
  },
  {
    id: "inches",
    category: "armour",
    symbol: "in",
    preset: "imperial",
    fromCanonical: umToInches,
    toCanonical: inchesToUm,
  },
  {
    id: "millimetres",
    category: "armour",
    symbol: "mm",
    preset: "metric",
    fromCanonical: umToMm,
    toCanonical: mmToUmValue,
  },
  {
    id: "yards",
    category: "range",
    symbol: "yd",
    preset: "imperial",
    fromCanonical: umToYards,
    toCanonical: yardsToUm,
  },
  {
    id: "kilometres",
    category: "range",
    symbol: "km",
    preset: "metric",
    fromCanonical: (v) => v / UM_PER_KILOMETRE,
    toCanonical: (v) => v * UM_PER_KILOMETRE,
  },
  {
    id: "yards",
    category: "length",
    symbol: "yd",
    preset: "imperial",
    fromCanonical: umToYards,
    toCanonical: yardsToUm,
  },
  {
    id: "metres",
    category: "length",
    symbol: "m",
    preset: "metric",
    fromCanonical: umToMetres,
    toCanonical: metresToUm,
  },
  // mass — tonnes is the common default; pounds is the manual's bomb-weight unit (p.18).
  {
    id: "tonnes",
    category: "mass",
    symbol: "t",
    preset: "both",
    fromCanonical: kgToTonnes,
    toCanonical: tonnesToKg,
  },
  {
    id: "pounds",
    category: "mass",
    symbol: "lb",
    preset: "both",
    fromCanonical: kgToPounds,
    toCanonical: poundsToKg,
  },
  // volume / power.
  {
    id: "cubicMetres",
    category: "volume",
    symbol: "m³",
    preset: "both",
    fromCanonical: litreToCubicMetres,
    toCanonical: cubicMetresToLitre,
  },
  {
    id: "litres",
    category: "volume",
    symbol: "L",
    preset: "both",
    fromCanonical: (v) => v,
    toCanonical: (v) => v,
  },
  {
    id: "kilowatts",
    category: "power",
    symbol: "kW",
    preset: "metric",
    fromCanonical: (v) => v,
    toCanonical: (v) => v,
  },
  {
    id: "horsepower",
    category: "power",
    symbol: "hp",
    preset: "imperial",
    fromCanonical: kwToHorsepower,
    toCanonical: horsepowerToKw,
  },
];

/** A typed failure of the measurement taxonomy (discriminate by `_tag`, RULES.md). */
export class PresentationFormatError extends Error {
  readonly _tag = "PresentationFormatError";
  constructor(
    readonly reason:
      | "unknown-measurement-category"
      | "incompatible-display-unit"
      | "unparseable-value",
    message: string,
  ) {
    super(message);
    this.name = "PresentationFormatError";
  }
}

export function isPresentationFormatError(value: unknown): value is PresentationFormatError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly _tag?: unknown })._tag === "PresentationFormatError"
  );
}

export function isMeasurementCategory(value: string): value is MeasurementCategory {
  return (MEASUREMENT_CATEGORIES as readonly string[]).includes(value);
}

export function isDisplayUnitId(value: string): value is DisplayUnitId {
  return ALL_UNITS.some((unit) => unit.id === value);
}

export function displayUnitsForCategory(
  category: MeasurementCategory,
): readonly DisplayUnitDefinition[] {
  return ALL_UNITS.filter((unit) => unit.category === category);
}

/** The preset's default unit for a category (the manual's imperial default, p.18). */
export function defaultDisplayUnit(
  category: MeasurementCategory,
  preset: MeasurementPreset,
): DisplayUnitDefinition {
  const candidates = displayUnitsForCategory(category);
  const match = candidates.find((unit) => unit.preset === preset) ?? candidates[0];
  if (match === undefined) {
    throw new PresentationFormatError(
      "unknown-measurement-category",
      `no display unit for category ${category}`,
    );
  }
  return match;
}

/**
 * Reject a selection that names an unknown unit or one from another category.
 * Used at the selection-write boundary; `formatMeasurement` degrades a malformed
 * selection to the preset default instead of throwing on the render path.
 */
export function assertMeasurementSelection(category: MeasurementCategory, unitId: string): void {
  const unit = ALL_UNITS.find(
    (candidate) => candidate.id === unitId && candidate.category === category,
  );
  if (unit === undefined) {
    throw new PresentationFormatError(
      "incompatible-display-unit",
      `${unitId} is not a ${category} display unit`,
    );
  }
}

/** The unit for a category: the valid per-category selection, else the preset default. */
export function resolveDisplayUnit(
  category: MeasurementCategory,
  preset: MeasurementPreset,
  selections: MeasurementSelections = {},
): DisplayUnitDefinition {
  if (!isMeasurementCategory(category)) {
    throw new PresentationFormatError(
      "unknown-measurement-category",
      `unknown measurement category ${String(category)}`,
    );
  }
  const selected = selections[category];
  if (selected !== undefined && isDisplayUnitId(selected)) {
    const match = ALL_UNITS.find((unit) => unit.id === selected && unit.category === category);
    if (match !== undefined) return match;
  }
  return defaultDisplayUnit(category, preset);
}

/** Convert a canonical value to its display-unit value under a category/preset/selection. */
export function convertToDisplay(
  canonical: number,
  category: MeasurementCategory,
  preset: MeasurementPreset,
  selections: MeasurementSelections = {},
): { readonly value: number; readonly unit: DisplayUnitDefinition } {
  const unit = resolveDisplayUnit(category, preset, selections);
  return { value: unit.fromCanonical(canonical), unit };
}

/** Narrow canonical inputs to their branded types for call-site clarity. */
export type { Kg, Kw, Litre, Um, UmPerSec };
