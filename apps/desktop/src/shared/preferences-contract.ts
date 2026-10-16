/**
 * The effect-free preferences contract (D2): the stable keys, value unions, the
 * scope enum, the version constant, the central defaults, and the plain decoded
 * shape shared by the preload and renderer. This module imports nothing (not even
 * types) so the runtime-free renderer and preload can depend on it without
 * pulling `effect` across the boundary (ADR-0159).
 *
 * The strict Effect `Schema` lives in the main process
 * (`src/main/preferences/preferencesSchema.ts`) and is bound to this contract by
 * a parity test; this module is the single source for the value literal arrays
 * the schema is built from, so the two cannot drift.
 */

/** The on-disk preferences format version. `0` was the implicit `localStorage` era. */
export const PREFERENCES_SCHEMA_VERSION = 1;

/** Where a preference is stored and how long it lives (D3). */
export const PREFERENCE_SCOPES = ["app", "campaign", "session"] as const;

export type PreferenceScope = (typeof PREFERENCE_SCOPES)[number];

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** The eight existing backdrop styles. */
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

/** The stored currency-display **request** (ADR-0211); no `customCurrency` (ADR-0208). */
export const CURRENCY_DISPLAY_MODES = [
  "navalCredits",
  "budgetPoints",
  "nationalHistorical",
] as const;
export type CurrencyDisplayMode = (typeof CURRENCY_DISPLAY_MODES)[number];

/**
 * Why a National Historical request could not be honoured (ADR-0211). U-3 maps
 * these to localized messages; U-2 only models the codes.
 */
export const CURRENCY_FALLBACK_REASONS = [
  "noActiveNation",
  "nationalCurrencyNotConfigured",
  "nationalCurrencyInvalid",
  "nationalCurrencyOutsideSupportedPeriod",
] as const;
export type CurrencyFallbackReason = (typeof CURRENCY_FALLBACK_REASONS)[number];

/**
 * The availability of the active nation's National Historical configuration. U-3
 * computes this from the active campaign; U-2 models its shape. `configured` means
 * a validated configuration applies to the active nation and period; every other
 * kind is a fallback reason.
 */
export type NationalCurrencyAvailability =
  | { readonly kind: "noActiveNation" }
  | { readonly kind: "configured" }
  | { readonly kind: "nationalCurrencyNotConfigured" }
  | { readonly kind: "nationalCurrencyInvalid" }
  | { readonly kind: "nationalCurrencyOutsideSupportedPeriod" };

/** The default when no campaign is active: the effective mode is Naval Credits. */
export const NO_ACTIVE_NATION_AVAILABILITY: NationalCurrencyAvailability = {
  kind: "noActiveNation",
};

/** The derived effective mode, with a reason when it differs from the request. */
export interface EffectiveCurrencyDisplayMode {
  readonly mode: CurrencyDisplayMode;
  readonly fallbackReason?: CurrencyFallbackReason;
}

/**
 * Resolve the effective currency-display mode from the stored request and the
 * active nation's availability (ADR-0211). Pure: it never mutates the request.
 * Naval Credits and Budget Points are always honourable; National Historical
 * falls back to Naval Credits when no validated configuration applies, recording
 * the reason so the UI can state it.
 */
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

/** Bounded integer text scale, in percent (D4); integer keeps migration deterministic. */
export const TEXT_SCALE_MIN = 85;
export const TEXT_SCALE_MAX = 130;

/** The app-scope preferences (D4). `highContrast` is deliberately deferred to U-4. */
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

/** The central defaults (D4), frozen so no consumer can mutate them in place. */
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

/** A decoded preferences snapshot: the format version plus the app-scope values. */
export interface PreferencesSnapshot {
  readonly version: number;
  readonly app: AppPreferences;
}

/** A full-object app-scope write; the renderer sends the merged full object (D6). */
export interface WriteAppPreferencesRequest {
  readonly app: AppPreferences;
}
