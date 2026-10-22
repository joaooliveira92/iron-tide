import { SMOKE_EQUIPMENT_MODE_CONFLICT } from "./reasonCodes.js";

export type SmokeEquipmentMode = "NONE" | "FLOATS" | "GENERATOR";

export function validateSmokeSourcePrecedence(
  currentMode: SmokeEquipmentMode,
  desiredSourceType: string,
  hasFunnelSmoke: boolean,
  hasActiveDeliberateSource: boolean,
): { allowed: boolean; reason?: string } {
  if (!hasFunnelSmoke && !hasActiveDeliberateSource) {
    return { allowed: true };
  }

  if (hasFunnelSmoke && !hasActiveDeliberateSource) {
    return { allowed: true };
  }

  const isFloatOrGenerator = desiredSourceType === "FLOAT" || desiredSourceType === "GENERATOR";

  if (isFloatOrGenerator) {
    if (desiredSourceType === "FLOAT" && currentMode === "GENERATOR") {
      return { allowed: false, reason: SMOKE_EQUIPMENT_MODE_CONFLICT };
    }
    if (desiredSourceType === "GENERATOR" && currentMode === "FLOATS") {
      return { allowed: false, reason: SMOKE_EQUIPMENT_MODE_CONFLICT };
    }

    if (currentMode === "NONE") {
      return { allowed: true };
    }

    if (
      (desiredSourceType === "FLOAT" && currentMode === "FLOATS") ||
      (desiredSourceType === "GENERATOR" && currentMode === "GENERATOR")
    ) {
      return { allowed: true };
    }
  } else {
    return { allowed: true };
  }

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
