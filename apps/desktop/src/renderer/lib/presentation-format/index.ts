/**
 * The single presentation formatting/conversion home (U-3 map D2). Import from
 * here; do not call `Intl`/`toLocaleString`/`toFixed` or divide by a unit
 * literal anywhere else (the D6 gate).
 */
export {
  MEASUREMENT_CATEGORIES,
  assertMeasurementSelection,
  convertToDisplay,
  defaultDisplayUnit,
  displayUnitsForCategory,
  isDisplayUnitId,
  isMeasurementCategory,
  isPresentationFormatError,
  PresentationFormatError,
  resolveDisplayUnit,
  KG_PER_POUND,
  KG_PER_TONNE,
  LITRE_PER_CUBIC_METRE,
  KW_PER_HORSEPOWER,
  UM_PER_KILOMETRE,
  UM_PER_METRE,
  UM_PER_YARD,
  type CanonicalQuantity,
  type DisplayUnitDefinition,
  type DisplayUnitId,
  type MeasurementCategory,
  type MeasurementSelections,
} from "./units.js";
export {
  formatMeasurement,
  formatNumber,
  formatPercent,
  measurementUnitSymbol,
  type FormatMeasurementOptions,
  type FormatNumberOptions,
  type FormatPercentOptions,
} from "./format.js";
export {
  applyNationalCurrencyScale,
  BUDGET_POINTS_LABEL,
  formatMoney,
  NAVAL_CREDITS_LABEL,
  type FormatMoneyOptions,
} from "./money.js";
export type {
  NationalCurrencyConfiguration,
  NationalCurrencyPeriod,
  NationalCurrencyScale,
} from "./national-currency.js";
export {
  formatCampaignMonth,
  localizedMonthName,
  type CampaignMonth,
  type MonthNameStyle,
} from "./dates.js";
export {
  computeNationalCurrencyAvailability,
  currencyFallbackMessageKey,
  resolveCurrencyDisplay,
  type ActiveCampaignCurrencyContext,
  type NationalCurrencySource,
} from "./currency-availability.js";
export { parseMeasurement, type ParseMeasurementOptions } from "./parse.js";
