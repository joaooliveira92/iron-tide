// S-2 04 (spec #74 R4, R5): the one place a phase applies a prestige source's rule to a nation.
//
// `applyPrestigeChange` resolves the rule from the snapshot's carried value set (it holds no prestige value of its
// own), writes the new prestige to the nation, and appends one `PrestigeChanged` event when the applied change is
// non-zero. It is the seam every later source (battle results, declined battles) calls from its owning phase; the
// owning phase declares the `nations` read and write in its footprint. It consumes no randomness and reads no
// ambient input.
import { applyPrestigeRule } from "@bluewave/campaign";
import type { PrestigeChange, PrestigeReasonCode } from "@bluewave/campaign";
import type { NationState } from "@bluewave/campaign";
import { prestigeChangedEvent } from "./events.js";
import type { MonthContext } from "./monthContext.js";

/** Collector error code for a prestige rule that could not be applied (a malformed prestige or value set). */
export const PRESTIGE_APPLICATION_FAILED = "PRESTIGE_APPLICATION_FAILED" as const;

/**
 * Apply `reason`'s rule to `nationId`'s prestige in `ctx.currentSnapshot`. Returns the applied change, or
 * `undefined` when the nation is absent or the rule failed (the failure is recorded as a collector error). A zero
 * delta writes nothing and emits no event. The caller decides WHETHER the source fires and for WHICH nation.
 */
export function applyPrestigeChange(
  ctx: MonthContext,
  nationId: string,
  reason: PrestigeReasonCode,
): PrestigeChange | undefined {
  const nation = ctx.currentSnapshot["nations"].get(nationId);
  if (nation === undefined) return undefined;
  const set = ctx.currentSnapshot["prestigeRules"];

  const applied = applyPrestigeRule(nation["prestige"], reason, set);
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
      set.rules[reason].kind,
      change,
      ctx.currentSnapshot["rulesetVersion"],
      ctx.nextSeq(),
      ctx.campaignMonth,
    ),
  );
  return change;
}
