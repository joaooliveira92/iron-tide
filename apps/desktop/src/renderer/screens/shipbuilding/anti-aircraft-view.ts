import {
  antiAircraftAvailable,
  MAX_AA_DIRECTORS,
  type AntiAircraftBalance,
  type AntiAircraftFit,
  type DesignDraft,
  type WorkshopView,
} from "@bluewave/ship-design";
import { formatTonnes } from "../../lib/presentation-format/index.js";

/**
 * The Armament "Other" tab's AA readout (manual p.43, ADR-0247). Pure: it reads what the compile decided. The control is
 * offered only once the ruleset makes the fit available for the design date, or while a design already asks for one, so
 * an 1880 design is never shown a feature its era lacks. Battle does not read the fit yet, and the text says so.
 */
export type AntiAircraftStatus = "empty" | "fitted" | "unavailable";

export interface AntiAircraftModel {
  readonly offered: boolean;
  /** The counts now on the design (all zero when none). */
  readonly fit: AntiAircraftFit;
  readonly maxDirectors: number;
  readonly status: AntiAircraftStatus;
  readonly text: string;
}

const NONE: AntiAircraftFit = { lightGuns: 0, mediumGuns: 0, directors: 0 };

export function antiAircraftModel(
  draft: DesignDraft,
  view: WorkshopView,
  balance: AntiAircraftBalance | undefined,
  month: string,
): AntiAircraftModel {
  const available = antiAircraftAvailable(balance, month);
  const fit = draft.antiAircraft ?? NONE;
  const result = view.compiled.antiAircraft;
  const base = { fit, maxDirectors: MAX_AA_DIRECTORS };
  if (result === undefined)
    return {
      ...base,
      offered: available,
      status: "empty",
      text: `Light and medium AA guns and AA directors (up to ${MAX_AA_DIRECTORS}) take weight and topside space.`,
    };
  if (!result.available)
    return {
      ...base,
      offered: true,
      status: "unavailable",
      text: "Requested, but not available at this date: the fit adds no weight or topside load.",
    };
  return {
    ...base,
    offered: true,
    status: "fitted",
    text: `Adds ${formatTonnes(result.weightKg)} t and its deck area to the topside load. Battle does not yet read the fit.`,
  };
}
