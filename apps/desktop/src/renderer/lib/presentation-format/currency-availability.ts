import {
  resolveEffectiveCurrencyDisplayMode,
  type CurrencyDisplayMode,
  type CurrencyFallbackReason,
  type EffectiveCurrencyDisplayMode,
  type NationalCurrencyAvailability,
} from "../../../shared/preferences-contract.js";
import type { NationalCurrencyConfiguration } from "./national-currency.js";

export interface ActiveCampaignCurrencyContext {
  readonly nationId?: string;
  readonly year?: number;
}

export interface NationalCurrencySource {
  readonly configurations: readonly NationalCurrencyConfiguration[];
  readonly invalidNationIds?: readonly string[];
}

export const NO_NATIONAL_CURRENCY_CONFIGURATIONS: NationalCurrencySource = Object.freeze({
  configurations: [] as const,
});

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

export function resolveCurrencyDisplay(
  request: CurrencyDisplayMode,
  availability: NationalCurrencyAvailability,
): EffectiveCurrencyDisplayMode {
  return resolveEffectiveCurrencyDisplayMode(request, availability);
}

export function currencyFallbackMessageKey(reason: CurrencyFallbackReason): string {
  return `settings.currency.unavailable.${reason}`;
}
