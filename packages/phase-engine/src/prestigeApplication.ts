import { applyPrestigeRule } from "@bluewave/campaign";
import type { PrestigeChange, PrestigeReasonCode, PrestigeRule } from "@bluewave/campaign";
import type { NationState } from "@bluewave/campaign";
import { Result } from "effect";
import { prestigeChangedEvent } from "./events.js";
import type { PhaseContext } from "./pipeline.js";

export type PrestigeApplicationContext = Pick<
  PhaseContext,
  "snapshot" | "collector" | "eventLedger" | "nextSeq" | "campaignMonth"
>;

export const PRESTIGE_APPLICATION_FAILED = "PRESTIGE_APPLICATION_FAILED" as const;

export function applyPrestigeChange(
  ctx: PrestigeApplicationContext,
  nationId: string,
  reason: PrestigeReasonCode,
  rule?: PrestigeRule,
): PrestigeChange | undefined {
  const nation = ctx.snapshot.read("nations").get(nationId);
  if (nation === undefined) return undefined;
  const set = ctx.snapshot.read("prestigeRules");

  const used = rule ?? set.rules[reason];
  if (used === undefined) {
    ctx.collector.addError(
      PRESTIGE_APPLICATION_FAILED,
      `Prestige rule ${reason} could not be applied to nation ${nationId}: PrestigeRuleMissing`,
      { stage: "prestige", entityId: nationId },
    );
    return undefined;
  }
  const applied = applyPrestigeRule(nation["prestige"], reason, set, used);
  if (Result.isFailure(applied)) {
    ctx.collector.addError(
      PRESTIGE_APPLICATION_FAILED,
      `Prestige rule ${reason} could not be applied to nation ${nationId}: ${applied.failure._tag}`,
      { stage: "prestige", entityId: nationId },
    );
    return undefined;
  }
  const change = applied.success;
  if ((change.delta as number) === 0) return change;

  const updatedNation: NationState = {
    ...nation,
    prestige: change.after,
    prestigeLastChange: {
      reasonCode: reason,
      before: change.before,
      after: change.after,
      delta: change.delta,
      month: ctx.campaignMonth,
    },
  };
  const updatedNations = new Map(ctx.snapshot.read("nations"));
  updatedNations.set(nationId, updatedNation);
  ctx.snapshot.write("nations", updatedNations);

  ctx.eventLedger.append(
    prestigeChangedEvent(
      nationId,
      reason,
      used.kind,
      change,
      ctx.snapshot.read("rulesetVersion"),
      ctx.nextSeq(),
      ctx.campaignMonth,
    ),
  );
  return change;
}
