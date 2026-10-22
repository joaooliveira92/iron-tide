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

const FLEET_SIZE_ICONS: Record<string, LucideIcon> = {
  small: SignalLow,
  standard: SignalMedium,
  large: SignalHigh,
  very_large: Signal,
};

export function fleetSizeIcon(valueId: string): LucideIcon {
  return FLEET_SIZE_ICONS[valueId] ?? SignalMedium;
}

export const ScenarioEraIcon: LucideIcon = Hourglass;

const UNCERTAINTY_FIELD_ICONS: Record<UncertaintyField, LucideIcon> = {
  researchSpeed: FlaskConical,
  technologyVariation: Shuffle,
  historicalBudget: Coins,
  tacticalRealism: Crosshair,
  difficulty: Gauge,
};

export function uncertaintyFieldIcon(field: UncertaintyField): LucideIcon {
  return UNCERTAINTY_FIELD_ICONS[field];
}
