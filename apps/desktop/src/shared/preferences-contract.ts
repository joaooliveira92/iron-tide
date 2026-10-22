export const PREFERENCES_SCHEMA_VERSION = 1;

export const PREFERENCE_SCOPES = ["app", "campaign", "session"] as const;

export type PreferenceScope = (typeof PREFERENCE_SCOPES)[number];

export const THEME_PREFERENCES = ["system", "light", "dark", "highContrast"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const BACKGROUND_PREFERENCES = [
  "water",
  "stars",
  "mesh-citrus",
  "mesh-lagoon",
  "auralis",
  "nebulore",
  "pattern-waves",
  "none",
] as const;
export type BackgroundPreference = (typeof BACKGROUND_PREFERENCES)[number];

export const FONT_PREFERENCES = ["inter", "jakarta"] as const;
export type FontPreference = (typeof FONT_PREFERENCES)[number];

export const INTERFACE_DENSITY_PREFERENCES = ["comfortable", "compact"] as const;
export type InterfaceDensityPreference = (typeof INTERFACE_DENSITY_PREFERENCES)[number];

export const REDUCED_MOTION_PREFERENCES = ["system", "reduce", "noPreference"] as const;
export type ReducedMotionPreference = (typeof REDUCED_MOTION_PREFERENCES)[number];

export const MEASUREMENT_PRESETS = ["imperial", "metric"] as const;
export type MeasurementPreset = (typeof MEASUREMENT_PRESETS)[number];

export const NUMBER_SCALE_PREFERENCES = ["full", "abbreviated"] as const;
export type NumberScalePreference = (typeof NUMBER_SCALE_PREFERENCES)[number];

export const TOOLTIP_DETAIL_PREFERENCES = ["minimal", "standard", "detailed"] as const;
export type TooltipDetailPreference = (typeof TOOLTIP_DETAIL_PREFERENCES)[number];

export const CURRENCY_DISPLAY_MODES = [
  "navalCredits",
  "budgetPoints",
  "nationalHistorical",
] as const;
export type CurrencyDisplayMode = (typeof CURRENCY_DISPLAY_MODES)[number];

export const CURRENCY_FALLBACK_REASONS = [
  "noActiveNation",
  "nationalCurrencyNotConfigured",
  "nationalCurrencyInvalid",
  "nationalCurrencyOutsideSupportedPeriod",
] as const;
export type CurrencyFallbackReason = (typeof CURRENCY_FALLBACK_REASONS)[number];

export type NationalCurrencyAvailability =
  | { readonly kind: "noActiveNation" }
  | { readonly kind: "configured" }
  | { readonly kind: "nationalCurrencyNotConfigured" }
  | { readonly kind: "nationalCurrencyInvalid" }
  | { readonly kind: "nationalCurrencyOutsideSupportedPeriod" };

export const NO_ACTIVE_NATION_AVAILABILITY: NationalCurrencyAvailability = {
  kind: "noActiveNation",
};

export interface EffectiveCurrencyDisplayMode {
  readonly mode: CurrencyDisplayMode;
  readonly fallbackReason?: CurrencyFallbackReason;
}

export function resolveEffectiveCurrencyDisplayMode(
  request: CurrencyDisplayMode,
  availability: NationalCurrencyAvailability,
): EffectiveCurrencyDisplayMode {
  if (request === "navalCredits" || request === "budgetPoints") {
    return { mode: request };
  }
  return availability.kind === "configured"
    ? { mode: "nationalHistorical" }
    : { mode: "navalCredits", fallbackReason: availability.kind };
}

export const LANGUAGE_PREFERENCES = ["en"] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];

export const FORMATTING_LOCALES = ["en-US"] as const;
export type FormattingLocale = (typeof FORMATTING_LOCALES)[number];

export const TEXT_SCALE_MIN = 85;
export const TEXT_SCALE_MAX = 130;

export interface AppPreferences {
  readonly theme: ThemePreference;
  readonly background: BackgroundPreference;
  readonly font: FontPreference;
  readonly interfaceDensity: InterfaceDensityPreference;
  readonly textScale: number;
  readonly reducedMotion: ReducedMotionPreference;
  readonly language: LanguagePreference;
  readonly formattingLocale: FormattingLocale;
  readonly measurementPreset: MeasurementPreset;
  readonly measurementSelections: Readonly<Record<string, string>>;
  readonly numberScale: NumberScalePreference;
  readonly tooltipDetail: TooltipDetailPreference;
  readonly currencyDisplayMode: CurrencyDisplayMode;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = Object.freeze({
  theme: "system",
  background: "water",
  font: "inter",
  interfaceDensity: "comfortable",
  textScale: 100,
  reducedMotion: "system",
  language: "en",
  formattingLocale: "en-US",
  measurementPreset: "imperial",
  measurementSelections: Object.freeze({}),
  numberScale: "full",
  tooltipDetail: "standard",
  currencyDisplayMode: "navalCredits",
});

export interface PreferencesSnapshot {
  readonly version: number;
  readonly app: AppPreferences;
}

export interface WriteAppPreferencesRequest {
  readonly app: AppPreferences;
}

export interface CampaignPreferences {
  readonly showDetailedTooltips: boolean;
  readonly confirmBeforeTurn: boolean;
  readonly showUnitFatigue: boolean;
  readonly showSupplyOverlay: boolean;
}

export const DEFAULT_CAMPAIGN_PREFERENCES: CampaignPreferences = Object.freeze({
  showDetailedTooltips: true,
  confirmBeforeTurn: true,
  showUnitFatigue: true,
  showSupplyOverlay: false,
});

export interface WriteCampaignPreferencesRequest {
  readonly campaign: CampaignPreferences;
}

export interface CampaignPreferencesSnapshot {
  readonly version: number;
  readonly campaign: CampaignPreferences;
}

export function resolveCampaignPreferences(
  campaign: CampaignPreferences | undefined,
  session: Partial<CampaignPreferences> | undefined,
): CampaignPreferences {
  return { ...DEFAULT_CAMPAIGN_PREFERENCES, ...campaign, ...session };
}
