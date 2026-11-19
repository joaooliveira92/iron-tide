import {
  BASIS_POINTS_PER_WHOLE,
  rateAfterStrike,
  resolveUnrestDrivers,
  resolveUnrestMonthInput,
  revolutionEligible,
  revolutionProbabilityBp,
  strikeActive,
  unrestOf,
  type NationState,
} from "@bluewave/campaign";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { SafeInt } from "@bluewave/contracts";
import { applyAcceptPeace } from "./diplomacy.js";
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";
import { endCareer, monthOf } from "./sackingPhase.js";
import { applyUnrestContributions, unrestConsequenceEvent } from "./unrestApplication.js";

export const UNREST_REVOLUTION_STREAM = "unrest_revolution" as const;

function activeWarIds(ctx: PhaseContext, nationId: string): string[] {
  return ctx.snapshot
    .read("wars")
    .wars.filter(
      (war) =>
        war.status === "ACTIVE" &&
        (war.attackerSideMembers.includes(nationId) || war.defenderSideMembers.includes(nationId)),
    )
    .map((war) => war.id)
    .sort();
}

function freshNation(ctx: PhaseContext, nationId: string): NationState | undefined {
  return ctx.snapshot.read("nations").get(nationId);
}

function writeNation(ctx: PhaseContext, nation: NationState): void {
  const nations = new Map(ctx.snapshot.read("nations"));
  nations.set(nation.id, nation);
  ctx.snapshot.write("nations", nations);
}

function drawRevolution(
  ctx: PhaseContext,
  nation: NationState,
  probabilityBp: number,
  unrest: number,
): boolean {
  const entityKey = `${nation.id}/${ctx.campaignMonth}`;
  const stream = ctx.rng.engine().stream(`${UNREST_REVOLUTION_STREAM}/${entityKey}`);
  const draw = Math.floor(stream.next() * BASIS_POINTS_PER_WHOLE);
  const revolted = draw < probabilityBp;
  const reasonCode = revolted ? "REVOLUTION" : "QUIET";
  ctx.randomLedger.record({
    streamId: UNREST_REVOLUTION_STREAM,
    entityKey,
    phase: "unrest",
    rulesetVersion: ctx.snapshot.read("rulesetVersion"),
    inputHash: sha256Hex(
      canonicalSerialize({
        nationId: nation.id,
        month: ctx.campaignMonth,
        unrest,
        probabilityBp,
      }),
    ),
    draw,
    outcome: reasonCode,
    reasonCode,
  });
  return revolted;
}

function emitConsequence(
  ctx: PhaseContext,
  nationId: string,
  consequence: "STRIKE" | "REVOLUTION",
  unrest: number,
  rateBeforeBp: number,
  rateAfterBp: number,
  careerEnded: boolean,
): void {
  ctx.eventLedger.append(
    unrestConsequenceEvent(
      nationId,
      consequence,
      unrest,
      rateBeforeBp,
      rateAfterBp,
      careerEnded,
      ctx.snapshot.read("rulesetVersion"),
      ctx.nextSeq(),
      ctx.campaignMonth,
    ),
  );
}

export function runUnrestPhase(ctx: PhaseContext): PhaseRunOutcome {
  const rules = ctx.engineOptions?.unrest;
  if (rules === undefined) return { status: "continue" };

  for (const nationId of [...ctx.snapshot.read("nations").keys()].sort()) {
    const nation = freshNation(ctx, nationId);
    if (nation === undefined || (!nation.isPlayable && !nation.isAI)) continue;
    const rateBp = Number(nation.navalAppropriationRateBp ?? 0);

    const wars = ctx.snapshot.read("wars");
    const input = resolveUnrestMonthInput(
      {
        wars: wars.wars,
        blockadeState: wars.blockadeState,
        fleets: nation.fleets,
        designs: ctx.snapshot.read("designs"),
      },
      nationId,
      ctx.campaignMonth,
      rateBp,
    );
    applyUnrestContributions(ctx, nationId, resolveUnrestDrivers(input, rules));

    const current = freshNation(ctx, nationId);
    if (current === undefined) continue;
    const unrest = unrestOf(current);
    const atWar = input.warMonths !== undefined;

    if (revolutionEligible(unrest, atWar, rules)) {
      const probabilityBp = revolutionProbabilityBp(rules, current.governmentType);
      if (drawRevolution(ctx, current, probabilityBp, unrest)) {
        applyRevolution(ctx, current, unrest, rateBp);
        continue;
      }
    }
    if (strikeActive(unrest, rules)) {
      const after = rateAfterStrike(rateBp, rules);
      writeNation(ctx, { ...current, navalAppropriationRateBp: SafeInt(after) });
      emitConsequence(ctx, nationId, "STRIKE", unrest, rateBp, after, false);
    }
  }
  return { status: "continue" };
}

function applyRevolution(
  ctx: PhaseContext,
  nation: NationState,
  unrest: number,
  rateBp: number,
): void {
  const rules = ctx.engineOptions?.unrest;
  if (rules === undefined) return;
  if (nation.id === ctx.playerNationId) {
    endCareer(ctx, nation.id, nation.prestige, "REVOLUTION", monthOf(ctx.campaignMonth));
    emitConsequence(ctx, nation.id, "REVOLUTION", unrest, rateBp, rateBp, true);
    return;
  }
  for (const warId of activeWarIds(ctx, nation.id)) {
    ctx.snapshot.current = applyAcceptPeace(
      ctx.snapshot.current,
      { type: "AcceptPeace", nationId: nation.id, warId },
      ctx.campaignMonth,
    );
  }
  applyUnrestContributions(ctx, nation.id, [
    { reasonCode: "REVOLUTION_AFTERMATH", delta: rules.aftermathUnrest - unrest },
  ]);
  emitConsequence(ctx, nation.id, "REVOLUTION", unrest, rateBp, rateBp, false);
}

export const unrestPhase: MonthPhase = {
  id: "unrest",
  name: "Unrest",
  permissions: { reads: "all", writes: ["nations", "wars", "politics", "careerResult"], rng: true },
  run: runUnrestPhase,
};
