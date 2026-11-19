import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { RandomEngine, RandomLedger } from "@bluewave/random";

import type { FormationSeparation } from "../formation/contracts.js";
import type { MovementState } from "../movement/index.js";
import { VISUAL_DETECTION_RANGE_UM } from "../spotting/constants.js";
import { isDetected } from "../spotting/detection.js";
import { divisionEffectsV1, type TacticalDivision } from "../tactical/division.js";
import type { BattleWeatherComponents } from "../weather/components.js";
import {
  NAVIGATION_BASIS_POINTS,
  NAVIGATION_BREAKDOWN_PHASE,
  NAVIGATION_RULESET_VERSION,
  NAVIGATION_SEPARATION_STREAM,
  SEPARABLE_FORMATIONS,
  type NavigationSeparationRules,
  type SeparableFormation,
  type SeparationState,
} from "./model.js";
import {
  SEPARATION,
  SEPARATION_REJOIN,
  STATION_DRIFT,
  type SeparationReasonCode,
} from "./reasonCodes.js";
import {
  separationChanceBp,
  separationWeather,
  type SeparationWeather,
} from "./separationChance.js";

export type SeparationRecordKind = "SEPARATED" | "REJOINED" | "DISORDERED";

export interface SeparationRecord {
  readonly shipId: string;
  readonly minute: number;
  readonly kind: SeparationRecordKind;
  readonly reasonCode: SeparationReasonCode;
}

export interface SeparationHold {
  readonly heading: number;
  readonly speedBp: number;
}

export interface SeparationUnit {
  readonly assetId: string;
  readonly shipType: string;
}

export interface ResolveSeparationInput {
  readonly battleId: string;
  readonly minute: number;
  readonly rules: NavigationSeparationRules;
  readonly divisions: readonly TacticalDivision[];
  readonly units: readonly SeparationUnit[];
  readonly movements: Readonly<Record<string, MovementState>>;
  readonly previous: Readonly<Record<string, SeparationState>>;
  readonly weather: BattleWeatherComponents | undefined;
  readonly engine: RandomEngine | undefined;
  readonly ledger: RandomLedger | undefined;
}

export interface SeparationResolution {
  readonly states: Record<string, SeparationState>;
  readonly records: readonly SeparationRecord[];
  readonly holds: Readonly<Record<string, SeparationHold>>;
  readonly steering: FormationSeparation;
}

function isSeparable(formation: string): formation is SeparableFormation {
  return (SEPARABLE_FORMATIONS as readonly string[]).includes(formation);
}

function flagshipSighted(
  weather: SeparationWeather,
  flagship: MovementState,
  ship: MovementState,
): boolean {
  const visibilityBp =
    weather.visibilityUm === undefined
      ? NAVIGATION_BASIS_POINTS
      : Math.min(
          NAVIGATION_BASIS_POINTS,
          Math.floor((weather.visibilityUm * NAVIGATION_BASIS_POINTS) / VISUAL_DETECTION_RANGE_UM),
        );
  return isDetected({
    observer: flagship.position,
    target: ship.position,
    rangeUm: VISUAL_DETECTION_RANGE_UM,
    visibilityMultiplierBp: visibilityBp,
  });
}

function drawSeparation(input: {
  readonly engine: RandomEngine;
  readonly ledger: RandomLedger | undefined;
  readonly battleId: string;
  readonly minute: number;
  readonly shipId: string;
  readonly formation: SeparableFormation;
  readonly chanceBp: number;
}): boolean {
  const streamId = `${NAVIGATION_SEPARATION_STREAM}:${input.shipId}:${input.minute}`;
  const draw = input.engine.stream(streamId).next();
  const separated = Math.floor(draw * NAVIGATION_BASIS_POINTS) < input.chanceBp;
  input.ledger?.record({
    streamId,
    entityKey: input.shipId,
    phase: NAVIGATION_BREAKDOWN_PHASE,
    rulesetVersion: NAVIGATION_RULESET_VERSION,
    inputHash: sha256Hex(
      canonicalSerialize({
        battleId: input.battleId,
        minute: input.minute,
        shipId: input.shipId,
        formation: input.formation,
        chanceBp: input.chanceBp,
      }),
    ),
    draw,
    outcome: separated ? "SEPARATED" : "IN_STATION",
    reasonCode: SEPARATION,
  });
  return separated;
}

export function resolveSeparation(input: ResolveSeparationInput): SeparationResolution {
  const { rules, minute, movements } = input;
  const weather = separationWeather(input.weather);
  const shipTypes = new Map(input.units.map((unit) => [unit.assetId, unit.shipType]));
  const states: Record<string, SeparationState> = {};
  const records: SeparationRecord[] = [];
  const holds: Record<string, SeparationHold> = {};
  const separated: string[] = [];
  const disordered: Record<string, { toleranceMultiplierBp: number; steeringErrorDeg: number }> =
    {};
  for (const division of input.divisions) {
    const formation = division.formation;
    const flagship = movements[division.tacticalFlagshipId];
    if (!isSeparable(formation) || flagship === undefined) continue;
    const cohesionBp = divisionEffectsV1({
      experience: division.initialExperience,
      cohesion: division.initialCohesion,
    }).formationCohesion;
    const chanceBp = separationChanceBp(rules, formation, weather, cohesionBp);
    for (const shipId of division.orderedTacticalUnitIds) {
      const movement = movements[shipId];
      if (shipId === division.tacticalFlagshipId || movement === undefined) continue;
      const previous = input.previous[shipId];
      const sameFormation = previous?.formation === formation;
      let state: SeparationState = previous
        ? { ...previous, formation }
        : {
            formation,
            separated: false,
            heldHeading: movement.heading,
            heldSpeedBp: movement.currentSpeed,
            driftMinutes: 0,
            disordered: false,
          };
      if (!sameFormation && previous) state = { ...state, driftMinutes: 0, disordered: false };
      if (state.separated) {
        if (flagshipSighted(weather, flagship, movement)) {
          state = { ...state, separated: false, driftMinutes: 0, disordered: false };
          records.push({ shipId, minute, kind: "REJOINED", reasonCode: SEPARATION_REJOIN });
        }
      } else {
        if (
          formation === "LINE_ABREAST" &&
          rules.heavyShipTypes.includes(shipTypes.get(shipId) ?? "")
        ) {
          const driftMinutes = state.driftMinutes + 1;
          const isDisordered = driftMinutes >= rules.drift.thresholdMinutes;
          if (isDisordered && !state.disordered)
            records.push({ shipId, minute, kind: "DISORDERED", reasonCode: STATION_DRIFT });
          state = { ...state, driftMinutes, disordered: isDisordered };
        }
        if (
          input.engine !== undefined &&
          chanceBp > 0 &&
          drawSeparation({
            engine: input.engine,
            ledger: input.ledger,
            battleId: input.battleId,
            minute,
            shipId,
            formation,
            chanceBp,
          })
        ) {
          state = {
            ...state,
            separated: true,
            disordered: false,
            heldHeading: movement.heading,
            heldSpeedBp: movement.currentSpeed,
          };
          records.push({ shipId, minute, kind: "SEPARATED", reasonCode: SEPARATION });
        }
      }
      if (state.separated) {
        separated.push(shipId);
        holds[shipId] = { heading: state.heldHeading, speedBp: state.heldSpeedBp };
      } else if (state.disordered) {
        disordered[shipId] = {
          toleranceMultiplierBp: rules.drift.toleranceMultiplierBp,
          steeringErrorDeg:
            state.driftMinutes % 2 === 0
              ? rules.drift.steeringErrorDeg
              : -rules.drift.steeringErrorDeg,
        };
      }
      if (state.separated || state.driftMinutes > 0) states[shipId] = state;
    }
  }
  return { states, records, holds, steering: { separated, disordered } };
}
