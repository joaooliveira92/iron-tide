/**
 * The bound presentation seam (U-3 map D2/D5, ADR-0218): the preference- and
 * currency-resolved formatters every screen renders through. It is the one
 * interface a component or pure view model holds — no call site reaches for
 * `Intl`/`toLocaleString`/`toFixed` or divides by a unit literal directly.
 *
 * Runtime-free and pure: preferences and the effective currency mode enter as
 * arguments; every method is a thin binding over the single formatters in this
 * directory, so money can never render in a different mode from measurement.
 */
import type { Money } from "@bluewave/contracts";

import type {
  EffectiveCurrencyDisplayMode,
  FormattingLocale,
  MeasurementPreset,
  NumberScalePreference,
} from "../../../shared/preferences-contract.js";
import { formatCount, formatMeasurement, formatNumber, formatPercent } from "./format.js";
import { currencyUnitLabel, formatMoney, formatMoneyFromMicro } from "./money.js";
import type { NationalCurrencyConfiguration } from "./national-currency.js";
import type { MeasurementCategory, MeasurementSelections } from "./units.js";

export interface MoneyFormatOverride {
  /** Override the bound number scale (e.g. a compact header readout). */
  readonly numberScale?: NumberScalePreference;
  readonly maximumFractionDigits?: number;
}

export interface NumberFormatOverride {
  readonly numberScale?: NumberScalePreference;
  readonly maximumFractionDigits?: number;
  readonly minimumFractionDigits?: number;
}

export interface MeasurementFormatOverride {
  readonly maximumFractionDigits?: number;
  readonly minimumFractionDigits?: number;
  readonly showUnit?: boolean;
}

/** The preference-bound, currency-aware formatters a presentation surface renders through. */
export interface PresentationFormat {
  readonly locale: FormattingLocale;
  /** The effective currency mode's unit label ("NC", "BP", or a national symbol). */
  readonly currencyLabel: string;
  /** Canonical money in the effective currency mode. */
  readonly money: (value: Money | number, override?: MoneyFormatOverride) => string;
  /** A ship-design cost authored in micro-currency (1e6 micro per unit). */
  readonly moneyFromMicro: (micro: number, override?: MoneyFormatOverride) => string;
  /** A whole count grouped for reading. */
  readonly count: (value: number) => string;
  /** Canonical basis points as a percentage. */
  readonly percent: (bp: number, maximumFractionDigits?: number) => string;
  /** An ordinary number under the bound number scale. */
  readonly number: (value: number, override?: NumberFormatOverride) => string;
  /** A canonical measurement in its category's display unit under the bound preset. */
  readonly measurement: (
    canonical: number,
    category: MeasurementCategory,
    override?: MeasurementFormatOverride,
  ) => string;
}

export interface PresentationFormatInput {
  readonly locale: FormattingLocale;
  readonly numberScale: NumberScalePreference;
  readonly measurementPreset: MeasurementPreset;
  readonly measurementSelections: MeasurementSelections;
  readonly currency: EffectiveCurrencyDisplayMode;
  /** Required when the effective currency mode is `nationalHistorical`. */
  readonly national?: NationalCurrencyConfiguration;
}

/** Bind the single formatters to a player's preferences and effective currency mode. */
export function createPresentationFormat(input: PresentationFormatInput): PresentationFormat {
  const { locale, numberScale, measurementPreset, measurementSelections, currency, national } =
    input;
  return {
    locale,
    currencyLabel: currencyUnitLabel(currency, national),
    money: (value, override) =>
      formatMoney(value, {
        locale,
        mode: currency,
        ...(national !== undefined ? { national } : {}),
        ...(override?.numberScale !== undefined ? { numberScale: override.numberScale } : {}),
        ...(override?.maximumFractionDigits !== undefined
          ? { maximumFractionDigits: override.maximumFractionDigits }
          : {}),
      }),
    moneyFromMicro: (micro, override) =>
      formatMoneyFromMicro(micro, {
        locale,
        mode: currency,
        ...(national !== undefined ? { national } : {}),
        ...(override?.numberScale !== undefined ? { numberScale: override.numberScale } : {}),
        ...(override?.maximumFractionDigits !== undefined
          ? { maximumFractionDigits: override.maximumFractionDigits }
          : {}),
      }),
    count: (value) => formatCount(value, locale),
    percent: (bp, maximumFractionDigits) =>
      formatPercent(bp, {
        locale,
        ...(maximumFractionDigits !== undefined ? { maximumFractionDigits } : {}),
      }),
    number: (value, override) =>
      formatNumber(value, {
        locale,
        numberScale: override?.numberScale ?? numberScale,
        ...(override?.maximumFractionDigits !== undefined
          ? { maximumFractionDigits: override.maximumFractionDigits }
          : {}),
        ...(override?.minimumFractionDigits !== undefined
          ? { minimumFractionDigits: override.minimumFractionDigits }
          : {}),
      }),
    measurement: (canonical, category, override) =>
      formatMeasurement(canonical, {
        locale,
        category,
        preset: measurementPreset,
        selections: measurementSelections,
        ...(override?.maximumFractionDigits !== undefined
          ? { maximumFractionDigits: override.maximumFractionDigits }
          : {}),
        ...(override?.minimumFractionDigits !== undefined
          ? { minimumFractionDigits: override.minimumFractionDigits }
          : {}),
        ...(override?.showUnit !== undefined ? { showUnit: override.showUnit } : {}),
      }),
  };
}
