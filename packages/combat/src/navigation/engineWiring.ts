import type { ExplanationTree } from "@bluewave/events";

import type { AdvanceMinuteInput } from "../simulation/engine.js";
import { withCurrentSpeeds } from "./damageControlSpeed.js";
import type { UnitOrders } from "../simulation/engine.js";
import type { MachineryState, SeparationState } from "./model.js";
import {
  resolveNavigation,
  type NavigationBreakdownRecord,
  type NavigationShipRecord,
} from "./resolution.js";
import { resolveSeparation, type SeparationRecord } from "./separation.js";

export interface NavigationMinuteOutput {
  readonly separation?: Readonly<Record<string, SeparationState>>;
  readonly separationRecords?: readonly SeparationRecord[];
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
  const rules = context.rules.separation;
  const separation =
    rules !== undefined && input.formation !== undefined
      ? resolveSeparation({
          battleId: input.state.battleId,
          minute: input.minute,
          rules,
          divisions: input.state.divisions ?? [],
          units: input.state.units ?? [],
          movements,
          previous: context.separation ?? {},
          weather: input.weather?.components,
          engine: input.engine,
          ledger: context.randomLedger,
        })
      : undefined;
  const orders: Record<string, UnitOrders> = { ...resolution.orders };
  if (separation !== undefined) {
    for (const [shipId, hold] of Object.entries(separation.holds)) {
      const existing = orders[shipId];
      orders[shipId] = {
        orderedHeading: hold.heading,
        orderedSpeedBp:
          existing?.attainableMaxBp === undefined
            ? hold.speedBp
            : Math.min(hold.speedBp, existing.attainableMaxBp),
        ...(existing?.attainableMaxBp === undefined
          ? {}
          : { attainableMaxBp: existing.attainableMaxBp }),
      };
    }
  }
  return {
    input: {
      ...input,
      orders,
      ...(damageControl === undefined ? {} : { damageControl }),
      ...(separation === undefined || input.formation === undefined
        ? {}
        : { formation: { ...input.formation, separation: separation.steering } }),
    },
    output: {
      ...(separation === undefined
        ? {}
        : {
            separation: separation.states,
            ...(separation.records.length === 0 ? {} : { separationRecords: separation.records }),
          }),
      machinery: resolution.machinery,
      shipRecords: resolution.shipRecords,
      breakdownRecords: resolution.breakdownRecords,
      explanations: resolution.explanations,
      vibrationBp: resolution.vibrationBp,
    },
  };
}
