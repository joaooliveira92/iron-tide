import {
  isLongBlockadeCramped,
  resolveFleetMoraleMonth,
  type NationState,
} from "@bluewave/campaign";
import type { PhaseContext } from "./pipeline.js";

export function applyFleetMorale(ctx: PhaseContext, nationId: string, unpaid: boolean): void {
  const rules = ctx.engineOptions?.fleetMorale;
  if (rules === undefined) return;
  const nation = ctx.snapshot.read("nations").get(nationId);
  if (nation === undefined) return;
  const blockadedCramped = isLongBlockadeCramped(
    {
      fleets: nation.fleets,
      designs: ctx.snapshot.read("designs"),
      wars: ctx.snapshot.read("wars").wars,
      blockadeState: ctx.snapshot.read("wars").blockadeState,
    },
    nationId,
    ctx.campaignMonth,
    rules,
  );
  const change = resolveFleetMoraleMonth({
    current: nation.fleetMorale,
    rules,
    unpaid,
    blockadedCramped,
  });
  if (change === undefined) return;
  const updated: NationState = {
    ...nation,
    fleetMorale: change.after,
    fleetMoraleLastChange: { ...change, month: ctx.campaignMonth },
  };
  const nations = new Map(ctx.snapshot.read("nations"));
  nations.set(nationId, updated);
  ctx.snapshot.write("nations", nations);
}
