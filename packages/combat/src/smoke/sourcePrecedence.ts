// DESIGN-42 §23: smoke source precedence validation.

import { SMOKE_EQUIPMENT_MODE_CONFLICT } from "./reasonCodes.js";

export type SmokeEquipmentMode = "NONE" | "FLOATS" | "GENERATOR";

export function validateSmokeSourcePrecedence(
  currentMode: SmokeEquipmentMode,
  desiredSourceType: string,
  hasFunnelSmoke: boolean,
  hasActiveDeliberateSource: boolean,
): { allowed: boolean; reason?: string } {
  // Funnel smoke is always passive and compatible with any deliberate source
  // Funnel + one deliberate source always OK

  // If no funnel and no active deliberate source, any source is allowed
  if (!hasFunnelSmoke && !hasActiveDeliberateSource) {
    return { allowed: true };
  }

  // If only funnel is active, any deliberate source is allowed
  if (hasFunnelSmoke && !hasActiveDeliberateSource) {
    return { allowed: true };
  }

  // If there is one deliberate source already active:
  // - Same source type as the desired one: allowed (merge)
  // - Funnel + additional deliberate source: check mode conflict
  const isFloatOrGenerator = desiredSourceType === "FLOAT" || desiredSourceType === "GENERATOR";

  // If the desired source is a deliberate smoke source (not funnel/fire)
  // and we have a current mode set, validate the mode transition
  if (isFloatOrGenerator) {
    // Floats and generator must NOT be simultaneous
    if (desiredSourceType === "FLOAT" && currentMode === "GENERATOR") {
      return { allowed: false, reason: SMOKE_EQUIPMENT_MODE_CONFLICT };
    }
    if (desiredSourceType === "GENERATOR" && currentMode === "FLOATS") {
      return { allowed: false, reason: SMOKE_EQUIPMENT_MODE_CONFLICT };
    }

    // If currentMode is NONE and we have an active deliberate source (but not
    // from a float/generator), this is fine
    if (currentMode === "NONE") {
      return { allowed: true };
    }

    // If currentMode matches the desired source type, allowed (replacement or merge)
    if (
      (desiredSourceType === "FLOAT" && currentMode === "FLOATS") ||
      (desiredSourceType === "GENERATOR" && currentMode === "GENERATOR")
    ) {
      return { allowed: true };
    }
  } else {
    // Non-float/non-generator deliberate sources (SMOKESCREEN, FUNNEL, FIRE)
    // No mode conflict with deliberate source types that don't use EQUIPMENT mode
    return { allowed: true };
  }

  // Safety fallback: should be unreachable
  return { allowed: false, reason: SMOKE_EQUIPMENT_MODE_CONFLICT };
}

export interface SourcePrecedenceInfo {
  sourceType: string;
  equipmentMode: SmokeEquipmentMode;
  isDeliberate: boolean;
}

export function computeSourcePrecedenceInfo(
  sourceType: string,
  equipmentMode: SmokeEquipmentMode,
): SourcePrecedenceInfo {
  const isDeliberate = sourceType !== "FUNNEL";
  return { sourceType, equipmentMode, isDeliberate };
}
