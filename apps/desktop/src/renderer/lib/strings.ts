/**
 * The string catalogues and resolver (U-4 map D6, ADR-0209). UI strings are keyed
 * by stable identifiers, resolved through a per-language catalogue with a complete
 * `en-US` fallback, so a missing translation falls back to en-US with no raw key
 * ever reaching the screen.
 *
 * The Options screen is the first surface migrated onto this catalogue; other
 * screens migrate in a bounded follow-on (U-4 map D6).
 */
import type { LanguagePreference } from "../../shared/preferences-contract.js";

/** The English (en-US) catalogue — the complete fallback. */
export const EN_US_MESSAGES = {
  "settings.title": "Options",
  "settings.description": "Appearance, display, measurements, currency and accessibility.",

  "settings.section.general": "General",
  "settings.section.appearance": "Appearance",
  "settings.section.measurements": "Measurements",
  "settings.section.currency": "Currency and Numbers",
  "settings.section.language": "Language and Region",
  "settings.section.accessibility": "Accessibility",
  "settings.section.advanced": "Advanced",

  "settings.theme.label": "Theme",
  "settings.theme.system": "System",
  "settings.theme.light": "Light",
  "settings.theme.dark": "Dark",
  "settings.theme.highContrast": "High contrast",
  "settings.background.label": "Background",
  "settings.font.label": "Application font",
  "settings.density.label": "Display density",
  "settings.density.comfortable": "Comfortable",
  "settings.density.compact": "Compact",
  "settings.textScale.label": "Text size",
  "settings.textScale.decrease": "Decrease text size",
  "settings.textScale.increase": "Increase text size",

  "settings.measurement.preset": "Measurement units",
  "settings.measurement.imperial": "Imperial",
  "settings.measurement.metric": "Metric",
  "settings.numberScale.label": "Number style",
  "settings.numberScale.full": "Full",
  "settings.numberScale.abbreviated": "Abbreviated",

  "settings.currency.label": "Currency display",
  "settings.currency.navalCredits": "Naval Credits",
  "settings.currency.budgetPoints": "Budget Points",
  "settings.currency.nationalHistorical": "National Historical",
  "settings.currency.unavailable.noActiveNation": "Available once a campaign is open.",
  "settings.currency.unavailable.nationalCurrencyNotConfigured":
    "No validated historical currency is configured for this nation.",
  "settings.currency.unavailable.nationalCurrencyInvalid":
    "The historical currency configuration for this nation is invalid.",
  "settings.currency.unavailable.nationalCurrencyOutsideSupportedPeriod":
    "The historical currency is not defined for this period.",

  "settings.language.label": "Language",
  "settings.language.en": "English",
  "settings.locale.label": "Number and date formatting",
  "settings.locale.en-US": "English (United States)",

  "settings.reducedMotion.label": "Motion",
  "settings.reducedMotion.system": "Follow system",
  "settings.reducedMotion.reduce": "Reduce motion",
  "settings.reducedMotion.noPreference": "No preference",
  "settings.tooltipDetail.label": "Tooltip detail",
  "settings.tooltipDetail.minimal": "Minimal",
  "settings.tooltipDetail.standard": "Standard",
  "settings.tooltipDetail.detailed": "Detailed",

  "settings.reset.all": "Reset all to defaults",
  "settings.reset.section": "Reset section",
} as const;

export type MessageKey = keyof typeof EN_US_MESSAGES;

/** Catalogues per language; only fully supported languages appear (ADR-0209). */
const CATALOGUES: Readonly<
  Record<LanguagePreference, Readonly<Partial<Record<MessageKey, string>>>>
> = {
  en: EN_US_MESSAGES,
};

/** Keys requested that were absent from every catalogue (for tests/telemetry). */
const missingKeys = new Set<string>();

/** The keys that were ever missing (a development aid; never shown to the player). */
export function missingMessageKeys(): readonly string[] {
  return [...missingKeys];
}

/**
 * Resolve a message keyed in the catalogue. Falls back to the complete en-US
 * catalogue; if a key is missing everywhere, returns an empty string rather than
 * a raw key (ADR-0209: no raw keys in production).
 */
export function translate(key: string, language: LanguagePreference = "en"): string {
  const fromLanguage = CATALOGUES[language]?.[key as MessageKey];
  if (fromLanguage !== undefined) return fromLanguage;
  const fallback = EN_US_MESSAGES[key as MessageKey];
  if (fallback !== undefined) return fallback;
  missingKeys.add(key);
  return "";
}
