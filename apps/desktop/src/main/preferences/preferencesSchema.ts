import { Schema } from "effect";
import {
  BACKGROUND_PREFERENCES,
  CURRENCY_DISPLAY_MODES,
  FONT_PREFERENCES,
  FORMATTING_LOCALES,
  INTERFACE_DENSITY_PREFERENCES,
  LANGUAGE_PREFERENCES,
  MEASUREMENT_PRESETS,
  NUMBER_SCALE_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
  REDUCED_MOTION_PREFERENCES,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  THEME_PREFERENCES,
  TOOLTIP_DETAIL_PREFERENCES,
} from "../../shared/preferences-contract.js";

export const AppPreferencesSchema = Schema.Struct({
  theme: Schema.Literals(THEME_PREFERENCES),
  background: Schema.Literals(BACKGROUND_PREFERENCES),
  font: Schema.Literals(FONT_PREFERENCES),
  interfaceDensity: Schema.Literals(INTERFACE_DENSITY_PREFERENCES),
  textScale: Schema.Int.check(
    Schema.isBetween({ minimum: TEXT_SCALE_MIN, maximum: TEXT_SCALE_MAX }),
  ),
  reducedMotion: Schema.Literals(REDUCED_MOTION_PREFERENCES),
  language: Schema.Literals(LANGUAGE_PREFERENCES),
  formattingLocale: Schema.Literals(FORMATTING_LOCALES),
  measurementPreset: Schema.Literals(MEASUREMENT_PRESETS),
  measurementSelections: Schema.Record(Schema.String, Schema.String),
  numberScale: Schema.Literals(NUMBER_SCALE_PREFERENCES),
  tooltipDetail: Schema.Literals(TOOLTIP_DETAIL_PREFERENCES),
  currencyDisplayMode: Schema.Literals(CURRENCY_DISPLAY_MODES),
});

export const PreferencesFileSchema = Schema.Struct({
  version: Schema.Literal(PREFERENCES_SCHEMA_VERSION),
  app: AppPreferencesSchema,
});

export const WriteAppPreferencesRequestSchema = Schema.Struct({
  app: AppPreferencesSchema,
});

export const CampaignPreferencesSchema = Schema.Struct({
  showDetailedTooltips: Schema.Boolean,
  confirmBeforeTurn: Schema.Boolean,
  showUnitFatigue: Schema.Boolean,
  showSupplyOverlay: Schema.Boolean,
});

export const CampaignPreferencesFileSchema = Schema.Struct({
  version: Schema.Literal(PREFERENCES_SCHEMA_VERSION),
  campaign: CampaignPreferencesSchema,
});

export const WriteCampaignPreferencesRequestSchema = Schema.Struct({
  campaign: CampaignPreferencesSchema,
});

export type AppPreferencesDecoded = typeof AppPreferencesSchema.Type;
export type CampaignPreferencesDecoded = typeof CampaignPreferencesSchema.Type;
