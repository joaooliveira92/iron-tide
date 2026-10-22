import {
  measureBaseLimits,
  reduceCrewQuality,
  type NationState,
  type Ship,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";

export function runBaseLimitPhase(ctx: PhaseContext): PhaseRunOutcome {
  const rules = ctx.engineOptions?.presence?.baseLimits;
  if (rules === undefined) return { status: "continue" };

  const snapshot = ctx.snapshot.view();
  const over = new Set(measureBaseLimits(snapshot, rules).flatMap((row) => row.overShipIds));
  const flag = { maintenanceAdderBp: SafeInt(rules.maintenanceAdderBp) };
  const reduction = SafeInt(rules.crewQualityReduction);

  let changed = false;
  const updatedNations = new Map<string, NationState>();
  for (const [nationId, nation] of snapshot.nations) {
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
  if (changed) ctx.snapshot.write("nations", updatedNations);
  return { status: "continue" };
}

export const baseLimitsPhase: MonthPhase = {
  id: "base_limits",
  name: "Base Limits",
  permissions: { reads: ["nations", "world"], writes: ["nations"], rng: false },
  run: runBaseLimitPhase,
};
