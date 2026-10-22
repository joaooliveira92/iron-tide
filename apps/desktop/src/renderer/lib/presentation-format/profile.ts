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

export interface PresentationFormat {
  readonly locale: FormattingLocale;
  readonly currencyLabel: string;
  readonly money: (value: Money | number, override?: MoneyFormatOverride) => string;
  readonly moneyFromMicro: (micro: number, override?: MoneyFormatOverride) => string;
  readonly count: (value: number) => string;
  readonly percent: (bp: number, maximumFractionDigits?: number) => string;
  readonly number: (value: number, override?: NumberFormatOverride) => string;
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
  readonly national?: NationalCurrencyConfiguration;
}

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
