import type { ExplanationTree } from "@bluewave/events";

import type { AdvanceMinuteInput } from "../simulation/engine.js";
import { withCurrentSpeeds } from "./damageControlSpeed.js";
import type { MachineryState } from "./model.js";
import {
  resolveNavigation,
  type NavigationBreakdownRecord,
  type NavigationShipRecord,
} from "./resolution.js";

export interface NavigationMinuteOutput {
  readonly machinery: Readonly<Record<string, MachineryState>>;
  readonly shipRecords: readonly NavigationShipRecord[];
  readonly breakdownRecords: readonly NavigationBreakdownRecord[];
  readonly explanations: Readonly<Record<string, ExplanationTree>>;
  readonly vibrationBp: Readonly<Record<string, number>>;
}

export interface NavigationStage {
  readonly input: AdvanceMinuteInput;
  readonly output?: NavigationMinuteOutput;
}

export function applyNavigation(input: AdvanceMinuteInput): NavigationStage {
  const context = input.navigation;
  if (!context) return { input };
  const movements = input.state.movementStates ?? {};
  const resolution = resolveNavigation({
    battleId: input.state.battleId,
    minute: input.minute,
    context,
    units: input.state.units ?? [],
    movements,
    orders: input.orders,
    ...(input.engine === undefined ? {} : { engine: input.engine }),
  });
  const damageControl = withCurrentSpeeds(input.damageControl, movements);
  return {
    input: {
      ...input,
      orders: resolution.orders,
      ...(damageControl === undefined ? {} : { damageControl }),
    },
    output: {
      machinery: resolution.machinery,
      shipRecords: resolution.shipRecords,
      breakdownRecords: resolution.breakdownRecords,
      explanations: resolution.explanations,
      vibrationBp: resolution.vibrationBp,
    },
  };
}
