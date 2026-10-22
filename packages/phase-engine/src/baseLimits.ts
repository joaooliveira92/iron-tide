import {
  measureBaseLimits,
  reduceCrewQuality,
  type NationState,
  type Ship,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import type { MonthContext } from "./monthContext.js";

export function runBaseLimitStep(ctx: MonthContext): void {
  const rules = ctx.engineOptions?.presence?.baseLimits;
  if (rules === undefined) return;

  const over = new Set(
    measureBaseLimits(ctx.currentSnapshot, rules).flatMap((row) => row.overShipIds),
  );
  const flag = { maintenanceAdderBp: SafeInt(rules.maintenanceAdderBp) };
  const reduction = SafeInt(rules.crewQualityReduction);

  let changed = false;
  const updatedNations = new Map<string, NationState>();
  for (const [nationId, nation] of ctx.currentSnapshot["nations"]) {
    if (!nation["isPlayable"] && !nation["isAI"]) {
      updatedNations.set(nationId, nation);
      continue;
    }
    const fleets = nation["fleets"].map((fleet) => ({
      ...fleet,
      ships: fleet["ships"].map((ship): Ship => {
        if (over.has(ship["id"])) {
          const crewQuality = reduceCrewQuality(ship["crewQuality"], reduction);
          if (
            ship["overBase"]?.maintenanceAdderBp === flag.maintenanceAdderBp &&
            crewQuality === ship["crewQuality"]
          ) {
            return ship;
          }
          changed = true;
          return { ...ship, crewQuality, overBase: { ...flag } };
        }
        if (ship["overBase"] === undefined) return ship;
        changed = true;
        const cleared: Ship = { ...ship };
        delete cleared.overBase;
        return cleared;
      }),
    }));
    updatedNations.set(nationId, { ...nation, fleets });
  }
  if (changed) ctx.currentSnapshot = { ...ctx.currentSnapshot, nations: updatedNations };
}
