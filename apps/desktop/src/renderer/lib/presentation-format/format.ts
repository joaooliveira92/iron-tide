import { BP_ONE, type Bp } from "@bluewave/contracts";

import type {
  FormattingLocale,
  MeasurementPreset,
  NumberScalePreference,
} from "../../../shared/preferences-contract.js";
import { cachedNumberFormat } from "./intl-cache.js";
import {
  convertToDisplay,
  resolveDisplayUnit,
  type MeasurementCategory,
  type MeasurementSelections,
} from "./units.js";

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
  return cachedNumberFormat(options.locale, formatOptions).format(value);
}

export interface FormatFixedOptions {
  readonly locale: FormattingLocale;
  readonly digits: number;
}

const DECIMAL_SEPARATORS = new Map<string, string>();

function decimalSeparator(locale: string): string {
  const cached = DECIMAL_SEPARATORS.get(locale);
  if (cached !== undefined) return cached;
  const discovered =
    cachedNumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".";
  DECIMAL_SEPARATORS.set(locale, discovered);
  return discovered;
}

export function formatFixed(value: number, options: FormatFixedOptions): string {
  return value.toFixed(options.digits).replace(".", decimalSeparator(options.locale));
}

export function formatCount(value: number, locale: FormattingLocale = "en-US"): string {
  return cachedNumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export interface FormatPercentOptions {
  readonly locale: FormattingLocale;
  readonly maximumFractionDigits?: number;
}

export function formatPercent(bp: Bp | number, options: FormatPercentOptions): string {
  return cachedNumberFormat(options.locale, {
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
  readonly showUnit?: boolean;
}

export function formatMeasurement(canonical: number, options: FormatMeasurementOptions): string {
  const { value, unit } = convertToDisplay(
    canonical,
    options.category,
    options.preset,
    options.selections ?? {},
  );
  const digits = options.maximumFractionDigits ?? DEFAULT_FRACTION_DIGITS[options.category] ?? 1;
  const text = cachedNumberFormat(options.locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
  }).format(value);
  return options.showUnit === false ? text : `${text} ${unit.symbol}`;
}

export function measurementUnitSymbol(
  category: MeasurementCategory,
  preset: MeasurementPreset,
  selections: MeasurementSelections = {},
): string {
  return resolveDisplayUnit(category, preset, selections).symbol;
}
