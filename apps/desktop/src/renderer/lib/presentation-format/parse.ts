/**
 * The single parse-once input path (U-3 map D6): a value the player types in a
 * display unit is converted once into the category's canonical integer, so no
 * downstream code re-parses a formatted string and no double conversion can occur.
 *
 * Runtime-free and pure. The canonical integer is rounded once here; callers brand
 * it with the canonical constructor for the quantity.
 */
import type { MeasurementPreset } from "../../../shared/preferences-contract.js";
import {
  PresentationFormatError,
  resolveDisplayUnit,
  type MeasurementCategory,
  type MeasurementSelections,
} from "./units.js";

export interface ParseMeasurementOptions {
  readonly category: MeasurementCategory;
  readonly preset: MeasurementPreset;
  readonly selections?: MeasurementSelections;
}

/**
 * Parse a display-unit string into the category's canonical integer, converting
 * once. Grouping separators and a trailing unit symbol are tolerated; anything
 * without a number throws a typed {@link PresentationFormatError}.
 */
export function parseMeasurement(text: string, options: ParseMeasurementOptions): number {
  const unit = resolveDisplayUnit(options.category, options.preset, options.selections ?? {});
  // Take the numeric part, ignoring grouping separators, spaces, and any unit text.
  const match = /-?\d[\d.,\u00a0\u202f ]*/.exec(text.replace(/\u00a0|\u202f/g, " "));
  if (match === null) {
    throw new PresentationFormatError("unparseable-value", `no number in ${JSON.stringify(text)}`);
  }
  const numeric = Number(match[0].replace(/[,\s]/g, ""));
  if (!Number.isFinite(numeric)) {
    throw new PresentationFormatError("unparseable-value", `not a number: ${JSON.stringify(text)}`);
  }
  return Math.round(unit.toCanonical(numeric));
}
