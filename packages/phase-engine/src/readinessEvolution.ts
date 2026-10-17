// S-1 readiness/crew evolution: the monthly per-ship step that advances every
// in-commission ship one month — crew quality ramps toward the readiness state's
// ceiling, a working-up ship is promoted to active once its crew reaches the
// "decent" threshold, and a repairing ship's countdown ticks down until it is
// released (manual pp.48, 51). It runs inside the maintenance phase (whose
// footprint declares the fleets write) and is pure: it consumes no randomness
// (S-1 D4/D6). The ruleset constants live in @bluewave/campaign.
import type { NationState, Ship } from "@bluewave/campaign";
import { readinessAfterCrewRamp, rampCrewQuality } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { shipReadinessChangedEvent } from "./events.js";
import type { MonthContext } from "./monthContext.js";

/** Stable reason code: a working-up ship reached the "decent" crew threshold (manual p.51). */
export const WORKING_UP_COMPLETE_REASON = "WORKING_UP_COMPLETE" as const;
/** Stable reason code: a repair countdown reached zero and the ship returned to normal (manual p.48). */
export const REPAIR_COMPLETE_REASON = "REPAIR_COMPLETE" as const;

/** A repairing ship released to active, without its repair counter and without losing crew (S-1 D6). */
function releaseFromRepair(ship: Ship): Ship {
  const released: Ship = { ...ship, readiness: "ACTIVE" };
  delete released.repairMonthsRemaining;
  return released;
}

/**
 * Run one month of readiness/crew evolution across every playable/AI nation's
 * fleets and record a `ShipReadinessChanged` domain event on each readiness
 * transition. A run with no working-up, laid-up or repairing ships is a strict
 * no-op, so hashes do not move.
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
        // A repairing ship only counts down; its crew is held, not ramped (S-1 D6).
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

  if (changed) ctx.currentSnapshot = { ...ctx.currentSnapshot, nations: updatedNations };
}
