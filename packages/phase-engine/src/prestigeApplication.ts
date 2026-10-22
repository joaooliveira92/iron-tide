import { applyPrestigeRule } from "@bluewave/campaign";
import type { PrestigeChange, PrestigeReasonCode, PrestigeRule } from "@bluewave/campaign";
import type { NationState } from "@bluewave/campaign";
import { prestigeChangedEvent } from "./events.js";
import type { MonthContext } from "./monthContext.js";

export type PrestigeApplicationContext = Pick<
  MonthContext,
  "currentSnapshot" | "collector" | "eventLedger" | "nextSeq" | "campaignMonth"
>;

export const PRESTIGE_APPLICATION_FAILED = "PRESTIGE_APPLICATION_FAILED" as const;

export function applyPrestigeChange(
  ctx: PrestigeApplicationContext,
  nationId: string,
  reason: PrestigeReasonCode,
  rule?: PrestigeRule,
): PrestigeChange | undefined {
  const nation = ctx.currentSnapshot["nations"].get(nationId);
  if (nation === undefined) return undefined;
  const set = ctx.currentSnapshot["prestigeRules"];

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
  if (!applied.ok) {
    ctx.collector.addError(
      PRESTIGE_APPLICATION_FAILED,
      `Prestige rule ${reason} could not be applied to nation ${nationId}: ${applied.error._tag}`,
      { stage: "prestige", entityId: nationId },
    );
    return undefined;
  }
  const change = applied.value;
  if ((change.delta as number) === 0) return change;

  const updatedNation: NationState = { ...nation, prestige: change.after };
  const updatedNations = new Map(ctx.currentSnapshot["nations"]);
  updatedNations.set(nationId, updatedNation);
  ctx.currentSnapshot = { ...ctx.currentSnapshot, nations: updatedNations };

  ctx.eventLedger.append(
    prestigeChangedEvent(
      nationId,
      reason,
      used.kind,
      change,
      ctx.currentSnapshot["rulesetVersion"],
      ctx.nextSeq(),
      ctx.campaignMonth,
    ),
  );
  return change;
}
