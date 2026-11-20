import type { NationState } from "@bluewave/campaign";
import type { ExplanationTree } from "@bluewave/events";
import { explainUnrestChange } from "./unrest-explanations.js";

export interface PlayerProjectionUnrestChange {
  readonly reasonCodes: readonly string[];
  readonly before: number;
  readonly after: number;
  readonly delta: number;
  readonly month: string;
  readonly changeExplanation: ExplanationTree;
}

export function unrestChangeField(nation: Pick<NationState, "unrestLastChange">): {
  readonly unrestChange?: PlayerProjectionUnrestChange;
} {
  const change = buildUnrestChange(nation);
  return change === undefined ? {} : { unrestChange: change };
}

export function buildUnrestChange(
  nation: Pick<NationState, "unrestLastChange">,
): PlayerProjectionUnrestChange | undefined {
  const last = nation.unrestLastChange;
  if (last === undefined) return undefined;
  return {
    reasonCodes: [...new Set(last.contributions.map((contribution) => contribution.reasonCode))],
    before: last.before,
    after: last.after,
    delta: last.after - last.before,
    month: last.month,
    changeExplanation: explainUnrestChange(last),
  };
}
