import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { ExplanationTree } from "@bluewave/events";
import type { RandomEngine, RandomLedger } from "@bluewave/random";

import { KNOTS_TO_UM_S, SPEED_BP_SCALE } from "../movement/neighbour.js";
import type { MovementState } from "../movement/index.js";
import type { UnitOrders } from "../simulation/engine.js";
import { explainAttainableMax, type SpeedReduction } from "./explanation.js";
import {
  breakdownCeilingBp,
  breakdownChancePpm,
  foulingCeilingBp,
  isAtCruiseOrBelow,
  isAtFullSpeed,
  stepFouling,
} from "./machinery.js";
import {
  INITIAL_MACHINERY_STATE,
  NAVIGATION_BASIS_POINTS,
  NAVIGATION_BREAKDOWN_PHASE,
  NAVIGATION_BREAKDOWN_STREAM,
  NAVIGATION_PPM,
  NAVIGATION_RULESET_VERSION,
  type MachineryState,
  type NavigationContext,
  type NavigationShipInput,
} from "./model.js";
import { BREAKDOWN, FLOODING_DAMAGE, type NavigationSpeedReasonCode } from "./reasonCodes.js";

export interface NavigationUnit {
  readonly assetId: string;
  readonly designedSpeedUms: number;
}

export interface NavigationBreakdownRecord {
  readonly shipId: string;
  readonly minute: number;
  readonly chancePpm: number;
  readonly drawPpm: number;
  readonly brokeDown: boolean;
  readonly reasonCode: typeof BREAKDOWN;
}

export interface NavigationShipRecord {
  readonly shipId: string;
  readonly minute: number;
  readonly baselineBp: number;
  readonly attainableMaxBp: number;
  readonly reasonCodes: readonly NavigationSpeedReasonCode[];
}

export interface ResolveNavigationInput {
  readonly battleId: string;
  readonly minute: number;
  readonly context: NavigationContext;
  readonly units: readonly NavigationUnit[];
  readonly movements: Readonly<Record<string, MovementState>>;
  readonly orders: Readonly<Record<string, UnitOrders>> | undefined;
  readonly engine?: RandomEngine;
}

export interface NavigationResolution {
  readonly orders: Record<string, UnitOrders>;
  readonly machinery: Record<string, MachineryState>;
  readonly shipRecords: readonly NavigationShipRecord[];
  readonly breakdownRecords: readonly NavigationBreakdownRecord[];
  readonly explanations: Readonly<Record<string, ExplanationTree>>;
  readonly vibrationBp: Readonly<Record<string, number>>;
}

function designedSpeedBp(unit: NavigationUnit): number {
  return Math.floor((unit.designedSpeedUms * SPEED_BP_SCALE) / KNOTS_TO_UM_S);
}

function drawBreakdown(input: {
  readonly engine: RandomEngine;
  readonly ledger: RandomLedger | undefined;
  readonly battleId: string;
  readonly minute: number;
  readonly ship: NavigationShipInput;
  readonly chancePpm: number;
}): NavigationBreakdownRecord {
  const streamId = `${NAVIGATION_BREAKDOWN_STREAM}:${input.ship.shipId}:${input.minute}`;
  const draw = input.engine.stream(streamId).next();
  const drawPpm = Math.floor(draw * NAVIGATION_PPM);
  const brokeDown = drawPpm < input.chancePpm;
  input.ledger?.record({
    streamId,
    entityKey: input.ship.shipId,
    phase: NAVIGATION_BREAKDOWN_PHASE,
    rulesetVersion: NAVIGATION_RULESET_VERSION,
    inputHash: sha256Hex(
      canonicalSerialize({
        battleId: input.battleId,
        minute: input.minute,
        shipId: input.ship.shipId,
        chancePpm: input.chancePpm,
      }),
    ),
    draw,
    outcome: brokeDown ? "BREAKDOWN" : "NO_BREAKDOWN",
    reasonCode: BREAKDOWN,
  });
  return {
    shipId: input.ship.shipId,
    minute: input.minute,
    chancePpm: input.chancePpm,
    drawPpm,
    brokeDown,
    reasonCode: BREAKDOWN,
  };
}

export function resolveNavigation(input: ResolveNavigationInput): NavigationResolution {
  const { context, minute, battleId } = input;
  const { rules } = context;
  const unitsById = new Map(input.units.map((unit) => [unit.assetId, unit]));
  const orders: Record<string, UnitOrders> = { ...input.orders };
  const machinery: Record<string, MachineryState> = { ...context.machinery };
  const shipRecords: NavigationShipRecord[] = [];
  const breakdownRecords: NavigationBreakdownRecord[] = [];
  const explanations: Record<string, ExplanationTree> = {};
  const vibrationBp: Record<string, number> = {};
  const ships = [...context.ships].sort((a, b) => (a.shipId < b.shipId ? -1 : 1));
  for (const ship of ships) {
    const unit = unitsById.get(ship.shipId);
    const movement = input.movements[ship.shipId];
    if (!unit || !movement) continue;
    const designed = designedSpeedBp(unit);
    if (designed <= 0) continue;
    const classRules = rules.fouling.classes[ship.machineryClass];
    const previous = machinery[ship.shipId] ?? INITIAL_MACHINERY_STATE;
    const atFullSpeed = isAtFullSpeed(previous, designed, movement.currentSpeed);
    const fouling = stepFouling(classRules, previous, {
      atFullSpeed,
      atCruiseOrBelow: isAtCruiseOrBelow(rules, designed, movement.currentSpeed),
    });
    let breakdownMinutesLeft = previous.breakdownMinutesLeft;
    if (breakdownMinutesLeft === 0 && atFullSpeed && input.engine !== undefined) {
      const record = drawBreakdown({
        engine: input.engine,
        ledger: context.randomLedger,
        battleId,
        minute,
        ship,
        chancePpm: breakdownChancePpm(rules, ship),
      });
      breakdownRecords.push(record);
      if (record.brokeDown) breakdownMinutesLeft = rules.breakdown.repairMinutes;
    }
    machinery[ship.shipId] = {
      ...fouling,
      breakdownMinutesLeft: Math.max(0, breakdownMinutesLeft - 1),
    };
    const reductions: SpeedReduction[] = [];
    if (fouling.fouling !== "CLEAN")
      reductions.push({
        reasonCode: fouling.fouling,
        ceilingBp: foulingCeilingBp(designed, fouling.fouling),
      });
    if (breakdownMinutesLeft > 0)
      reductions.push({ reasonCode: BREAKDOWN, ceilingBp: breakdownCeilingBp(rules, designed) });
    if (ship.damageSpeedCapBp !== undefined && ship.damageSpeedCapBp < designed)
      reductions.push({ reasonCode: FLOODING_DAMAGE, ceilingBp: ship.damageSpeedCapBp });
    const existing = orders[ship.shipId];
    const attainableMaxBp = reductions.reduce(
      (cap, reduction) => Math.min(cap, reduction.ceilingBp),
      existing?.attainableMaxBp ?? designed,
    );
    orders[ship.shipId] = {
      orderedHeading: existing?.orderedHeading ?? movement.heading,
      orderedSpeedBp: existing?.orderedSpeedBp ?? movement.orderedSpeed,
      attainableMaxBp,
    };
    if (reductions.length > 0) {
      shipRecords.push({
        shipId: ship.shipId,
        minute,
        baselineBp: designed,
        attainableMaxBp,
        reasonCodes: reductions.map((reduction) => reduction.reasonCode),
      });
      explanations[ship.shipId] = explainAttainableMax({
        shipId: ship.shipId,
        baselineBp: designed,
        attainableMaxBp,
        reductions,
      });
    }
    if (atFullSpeed && movement.currentSpeed >= rules.vibration.thresholdKnots * SPEED_BP_SCALE)
      vibrationBp[ship.shipId] = Math.min(
        NAVIGATION_BASIS_POINTS,
        rules.vibration.gunneryMultiplierBp,
      );
  }
  return { orders, machinery, shipRecords, breakdownRecords, explanations, vibrationBp };
}
