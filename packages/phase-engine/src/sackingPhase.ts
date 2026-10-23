import { BASIS_POINTS_PER_WHOLE, buildCareerResult, resolveSacking } from "@bluewave/campaign";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";

export const PRESTIGE_SACKING_STREAM = "prestige_sacking" as const;
export const PRESTIGE_SACKING_FAILED = "PRESTIGE_SACKING_FAILED" as const;

export function runSackingPhase(ctx: PhaseContext): PhaseRunOutcome {
  const player = ctx.playerNationId;
  if (player === undefined) return { status: "continue" };
  const nation = ctx.snapshot.read("nations").get(player);
  if (nation === undefined) return { status: "continue" };
  const rules = ctx.snapshot.read("prestigeRules");
  const prestige = nation["prestige"];

  const entityKey = `${player}/${ctx.campaignMonth}`;
  let drawn: number | undefined;
  const outcome = resolveSacking(prestige, rules, () => {
    const stream = ctx.rng.engine().stream(`${PRESTIGE_SACKING_STREAM}/${entityKey}`);
    drawn = Math.floor(stream.next() * BASIS_POINTS_PER_WHOLE);
    return drawn;
  });
  if (!outcome.ok) {
    ctx.collector.addError(
      PRESTIGE_SACKING_FAILED,
      `Sacking check for nation ${player} failed: ${outcome.error._tag}`,
      { stage: "sacking", entityId: player },
    );
    return { status: "continue" };
  }
  if (!outcome.value.eligible || drawn === undefined) return { status: "continue" };

  const sacked = outcome.value.sacked;
  const reasonCode = sacked ? "SACKED" : "RETAINED";
  ctx.randomLedger.record({
    streamId: PRESTIGE_SACKING_STREAM,
    entityKey,
    phase: "sacking",
    rulesetVersion: ctx.snapshot.read("rulesetVersion"),
    inputHash: sha256Hex(
      canonicalSerialize({
        nationId: player,
        month: ctx.campaignMonth,
        prestige,
        sackingThreshold: rules.sackingThreshold,
        sackingProbabilityBp: rules.sackingProbabilityBp,
      }),
    ),
    draw: drawn,
    outcome: reasonCode,
    reasonCode,
  });
  if (!sacked) return { status: "continue" };

  const [year, month] = ctx.campaignMonth.split("-").map(Number);
  const result = buildCareerResult({
    nationId: player,
    score: prestige,
    reason: "SACKED",
    month: { year: year!, month: month! },
  });
  if (!result.ok) {
    ctx.collector.addError(
      PRESTIGE_SACKING_FAILED,
      `Career result for nation ${player} could not be built: ${result.error._tag}`,
      { stage: "sacking", entityId: player },
    );
    return { status: "continue" };
  }
  ctx.snapshot.write("careerResult", result.value);
  return { status: "continue" };
}

export const sackingPhase: MonthPhase = {
  id: "sacking",
  name: "Sacking",
  permissions: {
    reads: ["nations", "prestigeRules", "rulesetVersion"],
    writes: ["careerResult"],
    rng: true,
  },
  run: runSackingPhase,
};
