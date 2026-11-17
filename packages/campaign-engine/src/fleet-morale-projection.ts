import { FLEET_MORALE_MAX, fleetMoraleOf, type NationState } from "@bluewave/campaign";
import type { ExplanationTree } from "@bluewave/events";
import { explainFleetMoraleChange } from "./fleet-morale-explanations.js";

export interface PlayerProjectionFleetMorale {
  readonly current: number;
  readonly max: number;
  readonly lastChange?: {
    readonly reasonCodes: readonly string[];
    readonly before: number;
    readonly after: number;
    readonly delta: number;
    readonly month: string;
  };
  readonly changeExplanation?: ExplanationTree;
}

export function buildFleetMorale(
  nation: Pick<NationState, "fleetMorale" | "fleetMoraleLastChange">,
): PlayerProjectionFleetMorale {
  const last = nation.fleetMoraleLastChange;
  return {
    current: fleetMoraleOf(nation),
    max: FLEET_MORALE_MAX,
    ...(last === undefined
      ? {}
      : {
          lastChange: {
            reasonCodes: last.contributions.map((contribution) => contribution.reasonCode),
            before: last.before,
            after: last.after,
            delta: last.after - last.before,
            month: last.month,
          },
          changeExplanation: explainFleetMoraleChange(last),
        }),
  };
}
