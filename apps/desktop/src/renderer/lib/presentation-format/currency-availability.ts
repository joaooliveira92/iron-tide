/**
 * Currency availability and the requested→effective resolution (U-3 map D4/D5,
 * ADR-0211). U-3 computes availability from the active campaign and the validated
 * National Historical configuration; the pure request→effective resolution lives in
 * the U-2 contract and is reused here. The stored request is never rewritten.
 *
 * Runtime-free and pure: the active campaign's nation and year enter as arguments.
 */
import {
  resolveEffectiveCurrencyDisplayMode,
  type CurrencyDisplayMode,
  type CurrencyFallbackReason,
  type EffectiveCurrencyDisplayMode,
  type NationalCurrencyAvailability,
} from "../../../shared/preferences-contract.js";
import type { NationalCurrencyConfiguration } from "./national-currency.js";

export interface ActiveCampaignCurrencyContext {
  /** The player's nation, or undefined before a campaign is open. */
  readonly nationId?: string;
  /** The current campaign year, for the configuration's supported period. */
  readonly year?: number;
}

export interface NationalCurrencySource {
  /** Validated configurations, if any are authored (U-3 ships none). */
  readonly configurations: readonly NationalCurrencyConfiguration[];
  /** Nation ids with a configuration that failed validation. */
  readonly invalidNationIds?: readonly string[];
}

/**
 * The production National Historical source: no validated per-nation
 * configuration is authored (U-3 owner decision, ADR-0211). A nation with no
 * configuration falls back to Naval Credits with a stated reason; nothing is
 * fabricated here.
 */
export const NO_NATIONAL_CURRENCY_CONFIGURATIONS: NationalCurrencySource = Object.freeze({
  configurations: [] as const,
});

/** Compute National Historical availability for the active campaign. */
export function computeNationalCurrencyAvailability(
  context: ActiveCampaignCurrencyContext,
  source: NationalCurrencySource,
): NationalCurrencyAvailability {
  if (context.nationId === undefined) return { kind: "noActiveNation" };
  if (source.invalidNationIds?.includes(context.nationId) === true) {
    return { kind: "nationalCurrencyInvalid" };
  }
  const config = source.configurations.find((entry) => entry.nationId === context.nationId);
  if (config === undefined) return { kind: "nationalCurrencyNotConfigured" };
  if (context.year !== undefined && !withinPeriod(config, context.year)) {
    return { kind: "nationalCurrencyOutsideSupportedPeriod" };
  }
  return { kind: "configured" };
}

function withinPeriod(config: NationalCurrencyConfiguration, year: number): boolean {
  return year >= config.period.fromYear && year <= config.period.toYear;
}

/** Resolve the effective mode from the stored request and availability (pure). */
export function resolveCurrencyDisplay(
  request: CurrencyDisplayMode,
  availability: NationalCurrencyAvailability,
): EffectiveCurrencyDisplayMode {
  return resolveEffectiveCurrencyDisplayMode(request, availability);
}

/**
 * The stable message key for a fallback reason (U-4's catalogue resolves the text;
 * a stable key here keeps the reason out of a raw literal). `configured` has none.
 */
export function currencyFallbackMessageKey(reason: CurrencyFallbackReason): string {
  return `settings.currency.unavailable.${reason}`;
}
