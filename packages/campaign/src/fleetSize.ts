import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { compareCodePoints } from "@bluewave/deterministic";
export const FLEET_SIZE_IDS = ["small", "standard", "large", "very_large"] as const;
export type FleetSizeId = (typeof FLEET_SIZE_IDS)[number];
export const FLEET_SIZE_BPS: Record<FleetSizeId, number> = {
  small: 7500,
  standard: 10000,
  large: 12500,
  very_large: 15000,
};
export const FLEET_MIN = 5000,
  FLEET_MAX = 20000;
export interface FleetSizeSetting {
  settingId: FleetSizeId;
  navalAppropriationMultiplierBp: number;
  sustainableFleetSizeMultiplierBp: number;
  aiForceTargetMultiplierBp: number;
  generatedLegacyFleetScaleMultiplierBp: number;
  roundingMode: "FLOOR";
  rulesetVersion: string;
}
export const CANONICAL_FLEET_SIZE_SETTINGS: FleetSizeSetting[] = FLEET_SIZE_IDS.map((id) => ({
  settingId: id,
  navalAppropriationMultiplierBp: FLEET_SIZE_BPS[id],
  sustainableFleetSizeMultiplierBp: FLEET_SIZE_BPS[id],
  aiForceTargetMultiplierBp: FLEET_SIZE_BPS[id],
  generatedLegacyFleetScaleMultiplierBp: FLEET_SIZE_BPS[id],
  roundingMode: "FLOOR",
  rulesetVersion: "1.0",
}));
export const TACTICAL_STATS = new Set([
  "displacement",
  "dimensions",
  "speed",
  "acceleration",
  "turning performance",
  "range",
  "fuel efficiency",
  "armor thickness",
  "armor quality",
  "weapon caliber",
  "damage",
  "penetration",
  "accuracy",
  "rate of fire",
  "ammunition capacity",
  "sensor effectiveness",
  "aircraft capacity",
  "aircraft performance",
  "crew quality",
  "damage resistance",
  "construction quality",
  "technology effects",
]);
export function checkFleetSizeTacticalViolation(formulaId: string) {
  if (TACTICAL_STATS.has(formulaId.toLowerCase()))
    throw Object.assign(new Error(`FLEET_SIZE_TACTICAL_STAT_VIOLATION: ${formulaId}`), {
      code: "FLEET_SIZE_TACTICAL_STAT_VIOLATION",
    });
}
export function scaleValue(unscaled: number, multiplierBp: number): SafeInt {
  if (!Number.isSafeInteger(unscaled)) {
    throw new TypeError(`scaleValue expects an integer unscaled value, got ${unscaled}`);
  }
  const scaled = (BigInt(unscaled) * BigInt(multiplierBp)) / BigInt(10000);
  return SafeInt(Number(scaled));
}
export function allocateIndivisible(
  totalUnscaled: number,
  multiplierBp: number,
  items: { id: string; unscaled: number }[],
) {
  const aggregate = Number(scaleValue(totalUnscaled, multiplierBp));
  const floors = items.map((it) => ({
    id: it.id,
    floor: Number(scaleValue(it.unscaled, multiplierBp)),
    rem: Number((BigInt(it.unscaled) * BigInt(multiplierBp)) % BigInt(10000)),
  }));
  let sum = floors.reduce((a, b) => a + b.floor, 0);
  let remaining = aggregate - sum;
  floors.sort((a, b) => (b.rem !== a.rem ? b.rem - a.rem : compareCodePoints(a.id, b.id)));
  const out = new Map<string, number>(floors.map((f) => [f.id, f.floor]));
  for (let i = 0; i < remaining; i++) {
    const id = floors[i % floors.length]!.id;
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  const sorted = new Map([...out.entries()].sort((a, b) => compareCodePoints(a[0], b[0])));
  return sorted;
}
export function validateFleetSizeSetting(s: unknown, c: DiagnosticCollector) {
  const r = s as Record<string, unknown>;
  const required = [
    "settingId",
    "navalAppropriationMultiplierBp",
    "sustainableFleetSizeMultiplierBp",
    "aiForceTargetMultiplierBp",
    "generatedLegacyFleetScaleMultiplierBp",
    "roundingMode",
    "rulesetVersion",
  ];
  for (const f of required) {
    if (!(f in r)) {
      c.addError(
        "MISSING_FLEET_SIZE_MULTIPLIER",
        `Missing fleet-size field ${f} for ${String(r["settingId"])}`,
        { stage: "fleet-size" },
      );
      return false;
    }
  }
  const fields = [
    "navalAppropriationMultiplierBp",
    "sustainableFleetSizeMultiplierBp",
    "aiForceTargetMultiplierBp",
    "generatedLegacyFleetScaleMultiplierBp",
  ] as const;
  for (const f of fields) {
    const v = r[f] as number;
    if (typeof v !== "number" || v < FLEET_MIN || v > FLEET_MAX) {
      c.addError(
        "FLEET_SIZE_MULTIPLIER_OUT_OF_RANGE",
        `${f}=${v} out of ${FLEET_MIN}..${FLEET_MAX}`,
        { stage: "fleet-size" },
      );
      return false;
    }
  }
  if (r["roundingMode"] !== "FLOOR") {
    c.addError("MISSING_FLEET_SIZE_MULTIPLIER", "roundingMode must be FLOOR", {
      stage: "fleet-size",
    });
    return false;
  }
  return true;
}
export function validateFleetSizeSettings(settings: unknown, c: DiagnosticCollector) {
  if (!Array.isArray(settings)) {
    c.addError("MISSING_FLEET_SIZE_MULTIPLIER", "fleet size settings must be array", {
      stage: "fleet-size",
    });
    return undefined;
  }
  let ok = true;
  for (const s of settings) if (!validateFleetSizeSetting(s, c)) ok = false;
  if (settings.length !== FLEET_SIZE_IDS.length) {
    c.addError(
      "MISSING_FLEET_SIZE_MULTIPLIER",
      `Ruleset must define exactly ${FLEET_SIZE_IDS.length} fleet-size settings, got ${settings.length}`,
      { stage: "fleet-size" },
    );
    ok = false;
  } else {
    const ids = new Set((settings as FleetSizeSetting[]).map((s) => s.settingId));
    for (const id of FLEET_SIZE_IDS) {
      if (!ids.has(id)) {
        c.addError(
          "MISSING_FLEET_SIZE_MULTIPLIER",
          `Ruleset missing canonical fleet-size setting ${id}`,
          {
            stage: "fleet-size",
          },
        );
        ok = false;
      }
    }
  }
  for (const s of settings as FleetSizeSetting[]) {
    const exp = FLEET_SIZE_BPS[s.settingId as FleetSizeId];
    if (
      exp !== undefined &&
      (s.navalAppropriationMultiplierBp !== exp ||
        s.sustainableFleetSizeMultiplierBp !== exp ||
        s.aiForceTargetMultiplierBp !== exp ||
        s.generatedLegacyFleetScaleMultiplierBp !== exp)
    ) {
      if (s.rulesetVersion === "1.0") {
        c.addError(
          "FLEET_SIZE_MULTIPLIER_OUT_OF_RANGE",
          `Canonical ${s.settingId} must be ${exp}`,
          { stage: "fleet-size" },
        );
        ok = false;
      }
    }
  }
  return ok ? (settings as FleetSizeSetting[]) : undefined;
}
