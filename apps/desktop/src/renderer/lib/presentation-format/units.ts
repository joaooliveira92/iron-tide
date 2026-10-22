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

export type MeasurementSelections = Readonly<Record<string, string>>;

export const UM_PER_YARD = UM_PER_INCH * 36;
export const UM_PER_METRE = 1_000_000;
export const UM_PER_KILOMETRE = 1_000_000_000;
export const KG_PER_TONNE = 1_000;
export const KG_PER_POUND = 0.45359237;
export const LITRE_PER_CUBIC_METRE = 1_000;
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

export type CanonicalQuantity = "Um" | "UmPerSec" | "Kg" | "Litre" | "Kw";

export interface DisplayUnitDefinition {
  readonly id: DisplayUnitId;
  readonly category: MeasurementCategory;
  readonly symbol: string;
  readonly preset: MeasurementPreset | "both";
  readonly fromCanonical: (canonical: number) => number;
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

export function convertToDisplay(
  canonical: number,
  category: MeasurementCategory,
  preset: MeasurementPreset,
  selections: MeasurementSelections = {},
): { readonly value: number; readonly unit: DisplayUnitDefinition } {
  const unit = resolveDisplayUnit(category, preset, selections);
  return { value: unit.fromCanonical(canonical), unit };
}

export type { Kg, Kw, Litre, Um, UmPerSec };
