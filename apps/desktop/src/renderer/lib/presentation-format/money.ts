/**
 * Money formatting across the three display modes (U-3 map D4, ADR-0206/0207/0211):
 * Naval Credits (the default comparison unit), Budget Points (abstract), and a
 * nation's validated National Historical configuration. The formatter renders what
 * it is told; currency **availability** and the requested→effective resolution are
 * the resolution layer's job (ticket 05), and this module never rewrites a request.
 *
 * Runtime-free and pure: explicit locale and mode in, string out.
 */
import type { Money } from "@bluewave/contracts";

import type {
  EffectiveCurrencyDisplayMode,
  CurrencyDisplayMode,
  FormattingLocale,
  NumberScalePreference,
} from "../../../shared/preferences-contract.js";
import { formatNumber } from "./format.js";
import type { NationalCurrencyConfiguration } from "./national-currency.js";

/** The label Naval Credits renders with (a comparison unit, never historical). */
export const NAVAL_CREDITS_LABEL = "NC";
/** The label Budget Points renders with (an abstract unit). */
export const BUDGET_POINTS_LABEL = "BP";

/**
 * Treasury micro-units in one canonical unit (1e6): ship-design costs are authored
 * in micro-currency (ADR-0218's single conversion home). The content-driven
 * `treasuryUnitMicro` is the authority where it is available; this constant is the
 * default factor the economy surfaces already used.
 */
export const MICRO_PER_UNIT = 1_000_000;

export interface FormatMoneyOptions {
  readonly locale: FormattingLocale;
  /** A bare mode or a resolved `EffectiveCurrencyDisplayMode`; both are accepted. */
  readonly mode: CurrencyDisplayMode | EffectiveCurrencyDisplayMode;
  /** Required when the effective mode is `nationalHistorical`. */
  readonly national?: NationalCurrencyConfiguration;
  readonly numberScale?: NumberScalePreference;
  readonly maximumFractionDigits?: number;
}

function modeOf(mode: CurrencyDisplayMode | EffectiveCurrencyDisplayMode): CurrencyDisplayMode {
  return typeof mode === "string" ? mode : mode.mode;
}

/**
 * The unit label the effective mode renders with ("NC", "BP", or the national
 * symbol). A caller composing its own layout (a compact header readout) uses this
 * instead of hard-coding a currency symbol.
 */
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

/** Format canonical money (treasury units) in the effective currency-display mode. */
export function formatMoney(value: Money | number, options: FormatMoneyOptions): string {
  const amount = Number(value);
  const mode = modeOf(options.mode);

  if (mode === "nationalHistorical") {
    // Malformed content with no configuration falls back to Naval Credits, never
    // a fabricated symbol (ADR-0211 "never silent" is the resolution layer's job).
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

/**
 * Format a ship-design cost authored in micro-currency. The factor is the single
 * conversion home's constant (`MICRO_PER_UNIT`); a surface with the content-driven
 * `treasuryUnitMicro` converts to canonical money itself and calls `formatMoney`.
 */
export function formatMoneyFromMicro(micro: number, options: FormatMoneyOptions): string {
  return formatMoney(micro / MICRO_PER_UNIT, options);
}

/** Apply the configuration's exact integer scale (relabel keeps the value). */
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
