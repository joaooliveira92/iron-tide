import type { Money } from "@bluewave/contracts";

import type {
  EffectiveCurrencyDisplayMode,
  CurrencyDisplayMode,
  FormattingLocale,
  NumberScalePreference,
} from "../../../shared/preferences-contract.js";
import { formatNumber } from "./format.js";
import type { NationalCurrencyConfiguration } from "./national-currency.js";

export const NAVAL_CREDITS_LABEL = "NC";
export const BUDGET_POINTS_LABEL = "BP";

export const MICRO_PER_UNIT = 1_000_000;

export interface FormatMoneyOptions {
  readonly locale: FormattingLocale;
  readonly mode: CurrencyDisplayMode | EffectiveCurrencyDisplayMode;
  readonly national?: NationalCurrencyConfiguration;
  readonly numberScale?: NumberScalePreference;
  readonly maximumFractionDigits?: number;
}

function modeOf(mode: CurrencyDisplayMode | EffectiveCurrencyDisplayMode): CurrencyDisplayMode {
  return typeof mode === "string" ? mode : mode.mode;
}

export function currencyUnitLabel(
  mode: CurrencyDisplayMode | EffectiveCurrencyDisplayMode,
  national?: NationalCurrencyConfiguration,
): string {
  const resolved = modeOf(mode);
  if (resolved === "budgetPoints") return BUDGET_POINTS_LABEL;
  if (resolved === "nationalHistorical" && national !== undefined) return national.symbol;
  return NAVAL_CREDITS_LABEL;
}

function renderNavalCredits(amount: number, options: FormatMoneyOptions): string {
  return `${formatNumber(amount, {
    locale: options.locale,
    numberScale: options.numberScale,
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
  })} ${NAVAL_CREDITS_LABEL}`;
}

export function formatMoney(value: Money | number, options: FormatMoneyOptions): string {
  const amount = Number(value);
  const mode = modeOf(options.mode);

  if (mode === "nationalHistorical") {
    if (options.national === undefined) return renderNavalCredits(amount, options);
    return renderNationalHistorical(amount, options.national, options);
  }
  if (mode === "budgetPoints") {
    return `${formatNumber(amount, {
      locale: options.locale,
      numberScale: options.numberScale,
      maximumFractionDigits: options.maximumFractionDigits ?? 0,
    })} ${BUDGET_POINTS_LABEL}`;
  }
  return renderNavalCredits(amount, options);
}

export function formatMoneyFromMicro(micro: number, options: FormatMoneyOptions): string {
  return formatMoney(micro / MICRO_PER_UNIT, options);
}

export function applyNationalCurrencyScale(
  value: number,
  config: NationalCurrencyConfiguration,
): number {
  if (config.scale === null) return value;
  return (value * config.scale.numerator) / config.scale.denominator;
}

function renderNationalHistorical(
  value: number,
  config: NationalCurrencyConfiguration,
  options: FormatMoneyOptions,
): string {
  const amount = applyNationalCurrencyScale(value, config);
  const negative = amount < 0;
  const body = new Intl.NumberFormat(options.locale, {
    useGrouping: config.grouping,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(Math.abs(amount));
  const spaced = config.spacing ? " " : "";
  const withSymbol =
    config.symbolPosition === "prefix"
      ? `${config.symbol}${spaced}${body}`
      : `${body}${spaced}${config.symbol}`;
  if (!negative) return withSymbol;
  return config.negatives === "parentheses" ? `(${withSymbol})` : `-${withSymbol}`;
}
