import type { DiagnosticCollector } from "@bluewave/diagnostics";
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
export interface ResearchSpeedSetting {
  settingId: ResearchId;
  multiplierBp: number;
  rulesetVersion: string;
}
export const CANONICAL_RESEARCH_SPEED_SETTINGS: ResearchSpeedSetting[] = RESEARCH_IDS.map((id) => ({
  settingId: id,
  multiplierBp: RESEARCH_BPS[id],
  rulesetVersion: "1.0",
}));
export function scaledResearchProgress(basePaid: number, mult: number): number {
  // §5: scaledResearchProgress = floor(basePaidResearchProgress * researchSpeedMultiplierBp / 10_000).
  // Wide integer before division; a non-integer base is an authoring error.
  if (!Number.isSafeInteger(basePaid)) {
    throw new TypeError(
      `scaledResearchProgress expects an integer basePaid value, got ${basePaid}`,
    );
  }
  // BigInt division truncates toward zero, which equals floor for non-negative progress.
  return Number((BigInt(basePaid) * BigInt(mult)) / BigInt(10000));
}
export function validateResearchSpeedSettings(settings: unknown, c: DiagnosticCollector) {
  if (!Array.isArray(settings)) {
    c.addError("INVALID_RESEARCH_SPEED_MULTIPLIER", "research speed must be array", {
      stage: "research-speed",
    });
    return undefined;
  }
  let ok = true;
  for (const s of settings as Record<string, unknown>[]) {
    const v = s["multiplierBp"] as number;
    if (typeof v !== "number" || v < RESEARCH_MIN || v > RESEARCH_MAX) {
      c.addError(
        "INVALID_RESEARCH_SPEED_MULTIPLIER",
        `Research multiplier ${v} out of ${RESEARCH_MIN}..${RESEARCH_MAX}`,
        { stage: "research-speed" },
      );
      ok = false;
    }
    if (!RESEARCH_IDS.includes(s["settingId"] as ResearchId)) {
      c.addError(
        "INVALID_RESEARCH_SPEED_MULTIPLIER",
        `Invalid research setting ${String(s["settingId"])}`,
        { stage: "research-speed" },
      );
      ok = false;
    }
  }
  // §5: the active ruleset MUST define exactly these canonical settings.
  if (settings.length !== RESEARCH_IDS.length) {
    c.addError(
      "INVALID_RESEARCH_SPEED_MULTIPLIER",
      `Ruleset must define exactly ${RESEARCH_IDS.length} research-speed settings, got ${settings.length}`,
      { stage: "research-speed" },
    );
    ok = false;
  } else {
    const ids = new Set((settings as ResearchSpeedSetting[]).map((s) => s.settingId));
    for (const id of RESEARCH_IDS) {
      if (!ids.has(id)) {
        c.addError(
          "INVALID_RESEARCH_SPEED_MULTIPLIER",
          `Ruleset missing canonical research-speed setting ${id}`,
          { stage: "research-speed" },
        );
        ok = false;
      }
    }
  }
  return ok ? (settings as ResearchSpeedSetting[]) : undefined;
}
