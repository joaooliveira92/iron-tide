import type { NationState, Ship } from "@bluewave/campaign";
import { growDivisionCohesion, readinessAfterCrewRamp, rampCrewQuality } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { shipReadinessChangedEvent } from "./events.js";
import type { PhaseContext } from "./pipeline.js";
import { advanceSpecialTrainingForMonth } from "./specialTraining.js";

export const WORKING_UP_COMPLETE_REASON = "WORKING_UP_COMPLETE" as const;
export const REPAIR_COMPLETE_REASON = "REPAIR_COMPLETE" as const;

function releaseFromRepair(ship: Ship): Ship {
  const released: Ship = { ...ship, readiness: "ACTIVE" };
  delete released.repairMonthsRemaining;
  return released;
}

function growDivisionCohesionForMonth(ctx: PhaseContext): void {
  const rules = ctx.fleetManagement?.divisionCohesion;
  if (rules === undefined) return;

  let changed = false;
  const updatedNations = new Map<string, NationState>();
  for (const [nationId, nation] of ctx.snapshot.read("nations")) {
    const shipsById = new Map(
      nation["fleets"].flatMap((fleet) => fleet["ships"]).map((ship) => [ship["id"], ship]),
    );
    const divisions = nation["divisions"].map((division) => {
      const grown = growDivisionCohesion(division, shipsById, ctx.campaignMonth, rules);
      if (grown !== division) changed = true;
      return grown;
    });
    updatedNations.set(nationId, { ...nation, divisions });
  }
  if (changed) ctx.snapshot.write("nations", updatedNations);
}

export function applyReadinessEvolution(ctx: PhaseContext): void {
  const { campaignMonth, eventLedger, nextSeq } = ctx;

  let changed = false;
  const updatedNations = new Map<string, NationState>();

  for (const [nationId, nation] of ctx.snapshot.read("nations")) {
    if (!nation["isPlayable"] && !nation["isAI"]) {
      updatedNations.set(nationId, nation);
      continue;
    }

    const fleets = nation["fleets"].map((fleet) => ({
      ...fleet,
      ships: fleet["ships"].map((ship) => {
        if (ship["readiness"] === "REPAIR") {
          const remaining = ship["repairMonthsRemaining"] ?? SafeInt.ZERO;
          if (remaining > 0) {
            const nextRemaining = SafeInt.sub(remaining, SafeInt(1));
            if (nextRemaining > 0) {
              changed = true;
              return { ...ship, repairMonthsRemaining: nextRemaining };
            }
          }
          changed = true;
          eventLedger.append(
            shipReadinessChangedEvent(
              ship["id"],
              nationId,
              "REPAIR",
              "ACTIVE",
              REPAIR_COMPLETE_REASON,
              ship["crewQuality"],
              nextSeq(),
              campaignMonth,
            ),
          );
          return releaseFromRepair(ship);
        }

        const crewQuality = rampCrewQuality(ship["crewQuality"], ship["readiness"]);
        const readiness = readinessAfterCrewRamp(ship["readiness"], crewQuality);
        if (readiness === ship["readiness"] && crewQuality === ship["crewQuality"]) return ship;
        changed = true;
        if (readiness !== ship["readiness"]) {
          eventLedger.append(
            shipReadinessChangedEvent(
              ship["id"],
              nationId,
              ship["readiness"],
              readiness,
              WORKING_UP_COMPLETE_REASON,
              crewQuality,
              nextSeq(),
              campaignMonth,
            ),
          );
        }
        return { ...ship, readiness, crewQuality };
      }),
    }));

    updatedNations.set(nationId, { ...nation, fleets });
  }

  if (changed) ctx.snapshot.write("nations", updatedNations);
  growDivisionCohesionForMonth(ctx);
  advanceSpecialTrainingForMonth(ctx);
}
