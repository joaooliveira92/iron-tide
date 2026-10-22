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

export function parseMeasurement(text: string, options: ParseMeasurementOptions): number {
  const unit = resolveDisplayUnit(options.category, options.preset, options.selections ?? {});
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
