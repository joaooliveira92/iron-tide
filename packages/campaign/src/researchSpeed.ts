import { compareCodePoints } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { Result, Schema } from "effect";
import { displayValue, issueKeys, recordOf } from "./schemaIssueKeys.js";
export const RESEARCH_IDS = ["slow", "standard", "fast", "very_fast"] as const;
export type ResearchId = (typeof RESEARCH_IDS)[number];
export const RESEARCH_BPS: Record<ResearchId, number> = {
  slow: 7500,
  standard: 10000,
  fast: 12500,
  very_fast: 15000,
};
export const RESEARCH_MIN = 5000,
  RESEARCH_MAX = 20000;
export const ResearchSpeedSettingSchema = Schema.Struct({
  settingId: Schema.Literals(RESEARCH_IDS),
  multiplierBp: Schema.Int.check(
    Schema.isBetween({ minimum: RESEARCH_MIN, maximum: RESEARCH_MAX }),
  ),
  rulesetVersion: Schema.NonEmptyString,
});
export type ResearchSpeedSetting = typeof ResearchSpeedSettingSchema.Type;
export const CANONICAL_RESEARCH_SPEED_SETTINGS: ResearchSpeedSetting[] = RESEARCH_IDS.map((id) => ({
  settingId: id,
  multiplierBp: RESEARCH_BPS[id],
  rulesetVersion: "1.0",
}));
export function scaledResearchProgress(basePaid: number, mult: number): number {
  if (!Number.isSafeInteger(basePaid)) {
    throw new TypeError(
      `scaledResearchProgress expects an integer basePaid value, got ${basePaid}`,
    );
  }
  return Number((BigInt(basePaid) * BigInt(mult)) / BigInt(10000));
}
const STAGE = { stage: "research-speed" } as const;

const decodeSetting = Schema.decodeUnknownResult(ResearchSpeedSettingSchema, {
  errors: "all",
  onExcessProperty: "error",
});

function reportSetting(entry: unknown, c: DiagnosticCollector): ResearchSpeedSetting | undefined {
  if (typeof entry !== "object" || entry === null) {
    c.addError("INVALID_RESEARCH_SPEED_MULTIPLIER", "research speed setting must be object", STAGE);
    return undefined;
  }
  const row = recordOf(entry);
  const decoded = decodeSetting(row);
  if (Result.isSuccess(decoded)) return decoded.success;
  const keys = issueKeys(decoded.failure.issue);
  const rejected = (field: string) => keys.missing.has(field) || keys.invalid.has(field);
  if (rejected("multiplierBp")) {
    c.addError(
      "INVALID_RESEARCH_SPEED_MULTIPLIER",
      `Research multiplier ${displayValue(row["multiplierBp"])} out of ${RESEARCH_MIN}..${RESEARCH_MAX}`,
      STAGE,
    );
  }
  if (rejected("settingId")) {
    c.addError(
      "INVALID_RESEARCH_SPEED_MULTIPLIER",
      `Invalid research setting ${displayValue(row["settingId"])}`,
      STAGE,
    );
  }
  if (rejected("rulesetVersion")) {
    c.addError(
      "INVALID_RESEARCH_SPEED_MULTIPLIER",
      `Research setting ${displayValue(row["settingId"])}: rulesetVersion must be a non-empty string`,
      STAGE,
    );
  }
  for (const key of [...keys.unexpected].sort(compareCodePoints)) {
    c.addError(
      "INVALID_RESEARCH_SPEED_MULTIPLIER",
      `Research setting ${displayValue(row["settingId"])}: unknown field ${key}`,
      STAGE,
    );
  }
  return undefined;
}

export function validateResearchSpeedSettings(
  settings: unknown,
  c: DiagnosticCollector,
): ResearchSpeedSetting[] | undefined {
  if (!Array.isArray(settings)) {
    c.addError("INVALID_RESEARCH_SPEED_MULTIPLIER", "research speed must be array", STAGE);
    return undefined;
  }
  let ok = true;
  const accepted: ResearchSpeedSetting[] = [];
  for (const entry of settings) {
    const setting = reportSetting(entry, c);
    if (setting === undefined) ok = false;
    else accepted.push(setting);
  }
  if (settings.length !== RESEARCH_IDS.length) {
    c.addError(
      "INVALID_RESEARCH_SPEED_MULTIPLIER",
      `Ruleset must define exactly ${RESEARCH_IDS.length} research-speed settings, got ${settings.length}`,
      STAGE,
    );
    ok = false;
  } else {
    const ids = new Set(
      settings.map((entry) =>
        typeof entry === "object" && entry !== null ? recordOf(entry)["settingId"] : undefined,
      ),
    );
    for (const id of RESEARCH_IDS) {
      if (!ids.has(id)) {
        c.addError(
          "INVALID_RESEARCH_SPEED_MULTIPLIER",
          `Ruleset missing canonical research-speed setting ${id}`,
          STAGE,
        );
        ok = false;
      }
    }
  }
  return ok ? accepted : undefined;
}
