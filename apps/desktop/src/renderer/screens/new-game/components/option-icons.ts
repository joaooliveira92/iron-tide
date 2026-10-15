import type { LucideIcon } from "lucide-react";
import {
  Coins,
  Crosshair,
  FlaskConical,
  Gauge,
  Hourglass,
  Shuffle,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from "lucide-react";
import type { UncertaintyField } from "../rules-of-the-naval-age-content.js";

/**
 * The lucide glyphs for the "Rules of the Naval Age" select options, kept in
 * one place so the wizard's dropdowns share one visual vocabulary — the same
 * icon-per-option treatment the shipbuilding toolbar's pickers use.
 */

/** A rising signal-strength glyph reads as fleet scale, one step per size. */
const FLEET_SIZE_ICONS: Record<string, LucideIcon> = {
  small: SignalLow,
  standard: SignalMedium,
  large: SignalHigh,
  very_large: Signal,
};

/** The scale glyph for a fleet size; an unknown id falls back to the middle step. */
export function fleetSizeIcon(valueId: string): LucideIcon {
  return FLEET_SIZE_ICONS[valueId] ?? SignalMedium;
}

/**
 * Scenarios are dated starts, not categorised kinds, so every one shares the
 * hourglass until scenario data carries its own icon.
 */
export const ScenarioEraIcon: LucideIcon = Hourglass;

const UNCERTAINTY_FIELD_ICONS: Record<UncertaintyField, LucideIcon> = {
  researchSpeed: FlaskConical,
  technologyVariation: Shuffle,
  historicalBudget: Coins,
  tacticalRealism: Crosshair,
  difficulty: Gauge,
};

/** The setting's glyph, shared by all of its values (the values are levels, not kinds). */
export function uncertaintyFieldIcon(field: UncertaintyField): LucideIcon {
  return UNCERTAINTY_FIELD_ICONS[field];
}
