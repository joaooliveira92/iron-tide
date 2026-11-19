import { growDivisionServiceExperience, type NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { compareCodePoints } from "@bluewave/deterministic";
import { divisionExperienceChangedEvent } from "./events.js";
import type { PhaseContext } from "./pipeline.js";

export function growDivisionServiceExperienceForMonth(ctx: PhaseContext): void {
  const rules = ctx.fleetManagement?.divisionExperience.service;
  if (rules === undefined) return;

  const nations = ctx.snapshot.read("nations");
  const updated = new Map<string, NationState>();
  let changed = false;
  for (const nationId of [...nations.keys()].sort(compareCodePoints)) {
    const nation = nations.get(nationId)!;
    const shipsById = new Map(
      nation["fleets"].flatMap((fleet) => fleet["ships"]).map((ship) => [ship["id"], ship]),
    );
    const grown = nation["divisions"].map((division) => ({
      before: division,
      after: growDivisionServiceExperience(division, shipsById, ctx.campaignMonth, rules),
    }));
    const events = grown
      .filter(({ before, after }) => after !== before)
      .sort((a, b) => compareCodePoints(a.before.divisionId, b.before.divisionId));
    for (const { before, after } of events) {
      ctx.eventLedger.append(
        divisionExperienceChangedEvent(
          nationId,
          before.divisionId,
          ctx.campaignMonth,
          "SERVICE_TIME",
          {
            before: before.experience,
            after: after.experience,
            delta: SafeInt.sub(after.experience, before.experience),
          },
          ctx.nextSeq(),
          ctx.campaignMonth,
        ),
      );
    }
    if (events.length > 0) changed = true;
    updated.set(
      nationId,
      events.length > 0 ? { ...nation, divisions: grown.map(({ after }) => after) } : nation,
    );
  }
  if (changed) ctx.snapshot.write("nations", updated);
}
