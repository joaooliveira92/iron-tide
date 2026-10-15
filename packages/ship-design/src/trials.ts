import { SafeInt } from "@bluewave/contracts";
import { drawUniform, type RandomLedger, type RandomStream } from "@bluewave/random";
import type { CompiledDesign } from "./compile.js";

export type DefectSeverity = "MINOR" | "MAJOR" | "CRITICAL";
export type TrialOutcome = "ACCEPTED" | "ACCEPTED_WITH_DEFICIENCIES" | "REJECTED_REWORK";

export interface TrialsBalance {
  /** Base maximum speed shortfall at trials, bp of design top speed. */
  readonly baseSpeedShortfallBp: number;
  /** Extra shortfall ceiling per bp of plant unreliability. */
  readonly unreliabilityToShortfallBp: number;
  /** Extra shortfall ceiling per bp the ship is over its design target. */
  readonly overweightToShortfallBp: number;
  readonly firstOfClassShortfallBp: number;
  /** Shortfall vs the REQUIRED speed tolerated for plain acceptance / for acceptance with deficiencies, bp. */
  readonly acceptToleranceBp: number;
  readonly deficiencyToleranceBp: number;
  /** Chance (bp, out of 10_000) of any defect found at trials = base + unreliability * factor. */
  readonly baseDefectChanceBp: number;
  readonly unreliabilityToDefectChanceBp: number;
  readonly firstOfClassDefectChanceBp: number;
  /** Cumulative severity thresholds out of 10_000: [minorUpTo, majorUpTo]; the rest is CRITICAL. */
  readonly severityCumulativeBp: readonly [number, number];
}

export interface TrialsInput {
  readonly projectId: string;
  readonly rulesetVersion: string;
  readonly plantReliabilityBp: number;
  readonly requiredSpeedMilliKnots: number;
  readonly firstOfClass: boolean;
  readonly targetDisplacementKg: number;
}

export interface TrialDefect {
  readonly severity: DefectSeverity;
}

export interface TrialsResult {
  readonly achievedSpeedMilliKnots: number;
  readonly speedShortfallBp: number;
  readonly defects: readonly TrialDefect[];
  readonly outcome: TrialOutcome;
  readonly reasonCodes: readonly string[];
}

/** Stream id every trials draw uses (spec §15.5). */
export const trialsStreamId = (projectId: string) => `shipbuilding.trials:${projectId}`;

/**
 * Sea trials: the only randomness in ship building. Validation (`compileDesign`) never calls this and takes no RNG.
 * Every draw is appended to the ledger with stream, entity, phase, input hash, draw, outcome and reason code.
 */
export function runTrials(
  c: CompiledDesign,
  i: TrialsInput,
  b: TrialsBalance,
  stream: RandomStream,
  ledger: RandomLedger,
): TrialsResult {
  const vmax = c.machinery?.maxSpeedMilliKnots ?? 0;
  const unreliability = Math.max(
    0,
    10_000 - i.plantReliabilityBp + (c.systems?.reliabilityPenaltyBp ?? 0),
  );
  const overBp = Math.max(
    0,
    Math.floor(
      ((c.totalKg - i.targetDisplacementKg) * 10_000) / Math.max(1, i.targetDisplacementKg),
    ),
  );
  const ceiling = Math.min(
    10_000,
    b.baseSpeedShortfallBp +
      Math.floor((unreliability * b.unreliabilityToShortfallBp) / 10_000) +
      Math.floor((overBp * b.overweightToShortfallBp) / 10_000) +
      (i.firstOfClass ? b.firstOfClassShortfallBp : 0),
  );
  const rec = (draw: number, outcome: string, reasonCode: string) =>
    ledger.record({
      streamId: stream.id,
      entityKey: i.projectId,
      phase: "TRIALS",
      rulesetVersion: i.rulesetVersion,
      inputHash: c.hash,
      draw,
      outcome,
      reasonCode,
    });

  const shortfall = drawUniform(stream, SafeInt(0), SafeInt(ceiling));
  rec(shortfall, `shortfallBp=${shortfall}`, "TRIAL_SPEED");
  const achieved = Math.floor((vmax * (10_000 - shortfall)) / 10_000);

  const chance = Math.min(
    10_000,
    b.baseDefectChanceBp +
      Math.floor((unreliability * b.unreliabilityToDefectChanceBp) / 10_000) +
      (i.firstOfClass ? b.firstOfClassDefectChanceBp : 0),
  );
  const defectDraw = drawUniform(stream, SafeInt(1), SafeInt(10_000));
  const defects: TrialDefect[] = [];
  if (defectDraw <= chance) {
    const sev = drawUniform(stream, SafeInt(1), SafeInt(10_000));
    const severity: DefectSeverity =
      sev <= b.severityCumulativeBp[0]
        ? "MINOR"
        : sev <= b.severityCumulativeBp[1]
          ? "MAJOR"
          : "CRITICAL";
    defects.push({ severity });
    rec(sev, `defect=${severity}`, "TRIAL_DEFECT");
  } else {
    rec(defectDraw, "no_defect", "TRIAL_DEFECT_NONE");
  }

  const required = i.requiredSpeedMilliKnots;
  const gapBp =
    required <= 0 ? 0 : Math.max(0, Math.floor(((required - achieved) * 10_000) / required));
  const reasons: string[] = [];
  let outcome: TrialOutcome = "ACCEPTED";
  if (gapBp > b.deficiencyToleranceBp) {
    outcome = "REJECTED_REWORK";
    reasons.push("TRIAL_SPEED_FAILED");
  } else if (gapBp > b.acceptToleranceBp) {
    outcome = "ACCEPTED_WITH_DEFICIENCIES";
    reasons.push("TRIAL_SPEED_SHORT");
  }
  if (defects.some((d) => d.severity === "CRITICAL")) {
    outcome = "REJECTED_REWORK";
    reasons.push("TRIAL_CRITICAL_DEFECT");
  } else if (defects.length > 0 && outcome === "ACCEPTED") {
    outcome = "ACCEPTED_WITH_DEFICIENCIES";
    reasons.push("TRIAL_DEFECT_FOUND");
  }
  return {
    achievedSpeedMilliKnots: achieved,
    speedShortfallBp: shortfall,
    defects,
    outcome,
    reasonCodes: reasons,
  };
}
