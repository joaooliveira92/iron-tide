/**
 * The presentation formatters (U-3 map D2/D3/D5): the single home for formatting
 * canonical values for display. Money, measurements, percentages, numbers, and
 * dates all render through here; components call these functions instead of
 * `Intl`/`toLocaleString`/`toFixed` or ad-hoc unit division (the D6 gate).
 *
 * Runtime-free and pure: every function takes the value, the display
 * preference(s), and an explicit locale, so tests never depend on the host
 * locale and nothing authoritative is touched.
 */
import { BP_ONE, type Bp } from "@bluewave/contracts";

import type {
  FormattingLocale,
  MeasurementPreset,
  NumberScalePreference,
} from "../../../shared/preferences-contract.js";
import {
  convertToDisplay,
  resolveDisplayUnit,
  type MeasurementCategory,
  type MeasurementSelections,
} from "./units.js";

/** Sensible default fraction digits per category (documented per call site here, once). */
const DEFAULT_FRACTION_DIGITS: Readonly<Record<MeasurementCategory, number>> = {
  speed: 1,
  length: 1,
  calibre: 1,
  armour: 0,
  range: 0,
  mass: 0,
  volume: 1,
  power: 0,
};

export interface FormatNumberOptions {
  readonly locale: FormattingLocale;
  readonly numberScale?: NumberScalePreference;
  readonly maximumFractionDigits?: number;
  readonly minimumFractionDigits?: number;
}

/** Format an ordinary number, honouring the number scale (`full` | `abbreviated`). */
export function formatNumber(value: number, options: FormatNumberOptions): string {
  const abbreviated = options.numberScale === "abbreviated";
  const formatOptions: Intl.NumberFormatOptions = {
    notation: abbreviated ? "compact" : "standard",
  };
  if (options.maximumFractionDigits !== undefined) {
    formatOptions.maximumFractionDigits = options.maximumFractionDigits;
  } else if (!abbreviated) {
    formatOptions.maximumFractionDigits = 0;
  }
  if (options.minimumFractionDigits !== undefined) {
    formatOptions.minimumFractionDigits = options.minimumFractionDigits;
  }
  return new Intl.NumberFormat(options.locale, formatOptions).format(value);
}

/**
 * A whole count grouped for reading ("12,345"): the presentation of treasury-unit figures on the economy surfaces, which have no
 * fractions and never abbreviate. The locale defaults to the one supported formatting locale.
 */
export function formatCount(value: number, locale: FormattingLocale = "en-US"): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export interface FormatPercentOptions {
  readonly locale: FormattingLocale;
  readonly maximumFractionDigits?: number;
}

/** Format canonical basis points as a percentage (2500 bp → "25%"). */
export function formatPercent(bp: Bp | number, options: FormatPercentOptions): string {
  return new Intl.NumberFormat(options.locale, {
    style: "percent",
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
  }).format(bp / BP_ONE);
}

export interface FormatMeasurementOptions {
  readonly locale: FormattingLocale;
  readonly category: MeasurementCategory;
  readonly preset: MeasurementPreset;
  readonly selections?: MeasurementSelections;
  readonly maximumFractionDigits?: number;
  readonly minimumFractionDigits?: number;
  /** Defaults to true; set false to omit the unit symbol. */
  readonly showUnit?: boolean;
}

/** Format a canonical value in its display unit under the preset/selection. */
export function formatMeasurement(canonical: number, options: FormatMeasurementOptions): string {
  const { value, unit } = convertToDisplay(
    canonical,
    options.category,
    options.preset,
    options.selections ?? {},
  );
  const digits = options.maximumFractionDigits ?? DEFAULT_FRACTION_DIGITS[options.category] ?? 1;
  const text = new Intl.NumberFormat(options.locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
  }).format(value);
  return options.showUnit === false ? text : `${text} ${unit.symbol}`;
}

/** The unit symbol a category/preset/selection resolves to (for labels). */
export function measurementUnitSymbol(
  category: MeasurementCategory,
  preset: MeasurementPreset,
  selections: MeasurementSelections = {},
): string {
  return resolveDisplayUnit(category, preset, selections).symbol;
}
