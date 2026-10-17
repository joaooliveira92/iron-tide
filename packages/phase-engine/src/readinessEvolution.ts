// S-1 readiness/crew evolution: the monthly per-ship step that advances every
// in-commission ship one month — crew quality ramps toward the readiness state's
// ceiling and a working-up ship is promoted to active once its crew reaches the
// "decent" threshold (manual p.51). It runs inside the maintenance phase (whose
// footprint declares the fleets write) and is pure: the ramp consumes no
// randomness (S-1 D4). The ruleset constants live in @bluewave/campaign.
import type { NationState } from "@bluewave/campaign";
import { readinessAfterCrewRamp, rampCrewQuality } from "@bluewave/campaign";
import { shipReadinessChangedEvent } from "./events.js";
import type { MonthContext } from "./monthContext.js";

/** Stable reason code: a working-up ship reached the "decent" crew threshold (manual p.51). */
export const WORKING_UP_COMPLETE_REASON = "WORKING_UP_COMPLETE" as const;

/**
 * Run one month of crew-quality ramp across every playable/AI nation's fleets and
 * record a `ShipReadinessChanged` domain event on each readiness transition. A run
 * with no working-up or laid-up ships (every hull active at its ceiling) is a
 * strict no-op, so hashes do not move.
 */
export function applyReadinessEvolution(ctx: MonthContext): void {
  const { campaignMonth, eventLedger, nextSeq } = ctx;

  let changed = false;
  const updatedNations = new Map<string, NationState>();

  for (const [nationId, nation] of ctx.currentSnapshot["nations"]) {
    if (!nation["isPlayable"] && !nation["isAI"]) {
      updatedNations.set(nationId, nation);
      continue;
    }

    const fleets = nation["fleets"].map((fleet) => ({
      ...fleet,
      ships: fleet["ships"].map((ship) => {
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

  if (changed) ctx.currentSnapshot = { ...ctx.currentSnapshot, nations: updatedNations };
}
