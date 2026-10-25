import { compareCodePoints } from "@bluewave/deterministic";
import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { Data, Result, Schema } from "effect";
import { displayValue, issueKeys, recordOf } from "./schemaIssueKeys.js";
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
const fleetMultiplierBp = Schema.Int.check(
  Schema.isBetween({ minimum: FLEET_MIN, maximum: FLEET_MAX }),
);
export const FleetSizeSettingSchema = Schema.Struct({
  settingId: Schema.Literals(FLEET_SIZE_IDS),
  navalAppropriationMultiplierBp: fleetMultiplierBp,
  sustainableFleetSizeMultiplierBp: fleetMultiplierBp,
  aiForceTargetMultiplierBp: fleetMultiplierBp,
  generatedLegacyFleetScaleMultiplierBp: fleetMultiplierBp,
  roundingMode: Schema.Literal("FLOOR"),
  rulesetVersion: Schema.NonEmptyString,
});
export type FleetSizeSetting = typeof FleetSizeSettingSchema.Type;
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
export class FleetSizeTacticalStatViolation extends Data.TaggedError(
  "FLEET_SIZE_TACTICAL_STAT_VIOLATION",
)<{
  readonly formulaId: string;
}> {
  readonly code = "FLEET_SIZE_TACTICAL_STAT_VIOLATION";

  override get message(): string {
    return `FLEET_SIZE_TACTICAL_STAT_VIOLATION: ${this.formulaId}`;
  }
}

export function checkFleetSizeTacticalViolation(formulaId: string) {
  if (TACTICAL_STATS.has(formulaId.toLowerCase()))
    throw new FleetSizeTacticalStatViolation({ formulaId });
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
const FLEET_STAGE = { stage: "fleet-size" } as const;

const FLEET_FIELDS = Object.keys(FleetSizeSettingSchema.fields) as ReadonlyArray<
  keyof FleetSizeSetting
>;

const FLEET_MULTIPLIER_FIELDS = [
  "navalAppropriationMultiplierBp",
  "sustainableFleetSizeMultiplierBp",
  "aiForceTargetMultiplierBp",
  "generatedLegacyFleetScaleMultiplierBp",
] as const;

const decodeFleetSetting = Schema.decodeUnknownResult(FleetSizeSettingSchema, {
  errors: "all",
  onExcessProperty: "error",
});

function reportFleetSetting(entry: unknown, c: DiagnosticCollector): FleetSizeSetting | undefined {
  if (typeof entry !== "object" || entry === null) {
    c.addError("MISSING_FLEET_SIZE_MULTIPLIER", "fleet-size setting must be object", FLEET_STAGE);
    return undefined;
  }
  const row = recordOf(entry);
  const decoded = decodeFleetSetting(row);
  if (Result.isSuccess(decoded)) return decoded.success;
  const keys = issueKeys(decoded.failure.issue);
  const label = displayValue(row["settingId"]);

  for (const field of FLEET_FIELDS) {
    if (keys.missing.has(field)) {
      c.addError(
        "MISSING_FLEET_SIZE_MULTIPLIER",
        `Missing fleet-size field ${field} for ${label}`,
        FLEET_STAGE,
      );
      return undefined;
    }
  }
  for (const field of FLEET_MULTIPLIER_FIELDS) {
    if (keys.invalid.has(field)) {
      c.addError(
        "FLEET_SIZE_MULTIPLIER_OUT_OF_RANGE",
        `${field}=${displayValue(row[field])} out of ${FLEET_MIN}..${FLEET_MAX}`,
        FLEET_STAGE,
      );
      return undefined;
    }
  }
  if (keys.invalid.has("roundingMode")) {
    c.addError("MISSING_FLEET_SIZE_MULTIPLIER", "roundingMode must be FLOOR", FLEET_STAGE);
    return undefined;
  }
  if (keys.invalid.has("settingId")) {
    c.addError(
      "MISSING_FLEET_SIZE_MULTIPLIER",
      `Invalid fleet-size settingId ${label}`,
      FLEET_STAGE,
    );
    return undefined;
  }
  if (keys.invalid.has("rulesetVersion")) {
    c.addError(
      "MISSING_FLEET_SIZE_MULTIPLIER",
      `rulesetVersion must be a non-empty string for ${label}`,
      FLEET_STAGE,
    );
    return undefined;
  }
  const [unknownKey] = [...keys.unexpected].sort(compareCodePoints);
  c.addError(
    "MISSING_FLEET_SIZE_MULTIPLIER",
    unknownKey === undefined
      ? `invalid fleet-size setting for ${label}`
      : `unknown fleet-size field ${unknownKey} for ${label}`,
    FLEET_STAGE,
  );
  return undefined;
}

export function validateFleetSizeSetting(s: unknown, c: DiagnosticCollector) {
  return reportFleetSetting(s, c) !== undefined;
}

function rowOfEntry(entry: unknown): Readonly<Record<string, unknown>> {
  return typeof entry === "object" && entry !== null ? recordOf(entry) : {};
}

export function validateFleetSizeSettings(
  settings: unknown,
  c: DiagnosticCollector,
): FleetSizeSetting[] | undefined {
  if (!Array.isArray(settings)) {
    c.addError("MISSING_FLEET_SIZE_MULTIPLIER", "fleet size settings must be array", FLEET_STAGE);
    return undefined;
  }
  let ok = true;
  const accepted: FleetSizeSetting[] = [];
  for (const entry of settings) {
    const setting = reportFleetSetting(entry, c);
    if (setting === undefined) ok = false;
    else accepted.push(setting);
  }
  const rows = settings.map(rowOfEntry);
  if (settings.length !== FLEET_SIZE_IDS.length) {
    c.addError(
      "MISSING_FLEET_SIZE_MULTIPLIER",
      `Ruleset must define exactly ${FLEET_SIZE_IDS.length} fleet-size settings, got ${settings.length}`,
      FLEET_STAGE,
    );
    ok = false;
  } else {
    const ids = new Set(rows.map((row) => row["settingId"]));
    for (const id of FLEET_SIZE_IDS) {
      if (!ids.has(id)) {
        c.addError(
          "MISSING_FLEET_SIZE_MULTIPLIER",
          `Ruleset missing canonical fleet-size setting ${id}`,
          FLEET_STAGE,
        );
        ok = false;
      }
    }
  }
  for (const row of rows) {
    const id = row["settingId"];
    if (typeof id !== "string" || !Object.hasOwn(FLEET_SIZE_BPS, id)) continue;
    const exp = FLEET_SIZE_BPS[id as FleetSizeId];
    const differs = FLEET_MULTIPLIER_FIELDS.some((field) => row[field] !== exp);
    if (differs && row["rulesetVersion"] === "1.0") {
      c.addError(
        "FLEET_SIZE_MULTIPLIER_OUT_OF_RANGE",
        `Canonical ${id} must be ${exp}`,
        FLEET_STAGE,
      );
      ok = false;
    }
  }
  return ok ? accepted : undefined;
}
