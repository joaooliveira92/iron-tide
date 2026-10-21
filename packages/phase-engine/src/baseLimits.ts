// S-5 08 (spec #73 R10/R11, ADR-0250): the month-end base-limit step. It runs last in the month - after movement, battle
// resolution, presence measurement and foreign-station routing - so a fleet that arrived this month has already fought at
// full strength and ships suffer only now. Ships beyond their area's limit are flagged (`*`) and take the over-base crew-
// quality consequence through the S-1 readiness seam; the flag carries the maintenance adder the S-1 maintenance seam
// charges from next month. A ship back within its limit loses the flag. It reads no war or blockade (base limits are not
// exempt, ADR-0248), draws no randomness and, with the ruleset block absent, does nothing.
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
