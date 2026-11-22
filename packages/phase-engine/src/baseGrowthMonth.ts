import { stepBaseGrowth, type NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import type { PhaseContext } from "./pipeline.js";

export const ECONOMIC_BASE_CEILING_REACHED = "ECONOMIC_BASE_CEILING_REACHED" as const;

export function growNationBase(
  ctx: PhaseContext,
  nationId: string,
  nation: NationState,
): NationState {
  const step = stepBaseGrowth(
    ctx.engineOptions?.baseGrowth,
    nationId,
    nation["baseResources"] ?? SafeInt(0),
  );
  if (step === undefined) return nation;
  if (step.ceilingReached)
    ctx.collector.addWarning(
      ECONOMIC_BASE_CEILING_REACHED,
      `Nation ${nationId} reached the economic base ceiling; further growth is held`,
      { stage: "monthly_revenue", entityId: nationId },
    );
  return { ...nation, baseResources: step.base };
}
