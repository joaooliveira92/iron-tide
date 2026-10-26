import { BluewaveError } from "@bluewave/contracts";
import type { RandomEngine } from "@bluewave/random";
import {
  AMMUNITION_TYPES,
  type AmmunitionType,
  type FireMode,
  SURFACE_FIRE_CONTROL_MINIMUM_BP,
} from "./constants.js";
import { resolveAccuracy, resolveHit, type GunneryAccuracyFactors } from "./accuracy.js";
import {
  advanceReloadProgress,
  computeEffectiveReloadMs,
  isReloadComplete,
  resetReloadProgress,
  type GunneryRateFactors,
} from "./rateOfFire.js";
import type { BattleEvent } from "../core/battleLedger.js";
import {
  NO_TARGET,
  type GunneryState,
  withGunneryStateHash,
  assertFixedPointGunnery,
} from "./state.js";
import { getFireModeDefinition } from "./modes.js";
import { reserveAndConsumeAmmunition } from "./salvo.js";
import {
  type GunneryEventRecord,
  gunneryEventId,
  makeGunneryEventRecord,
  type GunneryEventSeed,
} from "./event.js";
import { validateTargetOrder, type TacticalContact } from "../contact/neighbour.js";
import type { Position } from "../core/position.js";
import { TACTICAL_MINUTE_MS } from "../core/tacticalTime.js";
import { INVALID_GUNNERY_STATE } from "./reasonCodes.js";
import { rangeBetweenUm, rangeMultiplierBp } from "./rangeCurve.js";
import { salvoBatchAccuracyBp } from "./salvoBatch.js";

export const GUNNERY_SUBSTEP = 2 as const;
export const GUNNERY_EVENT_PRIORITY = 9 as const;

export { TACTICAL_MINUTE_MS };

export interface GunneryBattery {
  id: string;
  ownerShipId: string;
  sideId?: string;
  mountOrdinal?: number;
  commandSource: string;
  baseReloadMs: number;
  blindFireAllowed?: boolean;
  salvoCount: number;
  preferredType: AmmunitionType;
  permittedTypes?: readonly AmmunitionType[];
  rateFactors: GunneryRateFactors;
  accuracyFactors: GunneryAccuracyFactors;
  state: GunneryState;
}

export interface ResolveGunneryInput {
  battleId: string;
  minute: number;
  substep?: number;
  batteries: readonly GunneryBattery[];
  contacts: readonly TacticalContact[];
  engine?: RandomEngine;
  shipPositions?: Readonly<Record<string, Position>>;
}

export interface ResolveGunneryOutput {
  salvos: readonly GunneryEventRecord[];
  events: readonly BattleEvent[];
  nextStates: Record<string, GunneryState>;
}

interface BatteryOutcome {
  fired: boolean;
  record?: GunneryEventRecord;
  event?: BattleEvent;
  nextState: GunneryState;
}

export function resolveGunnery(input: ResolveGunneryInput): ResolveGunneryOutput {
  const battleId = input.battleId;
  const minute = input.minute;
  const substep = input.substep ?? GUNNERY_SUBSTEP;

  const contactsMap = new Map<string, TacticalContact>();
  for (const c of input.contacts) contactsMap.set(c.contactId, c);

  const salvos: GunneryEventRecord[] = [];
  const events: BattleEvent[] = [];
  const nextStates: Record<string, GunneryState> = {};

  for (const b of input.batteries) {
    const state = b.state;
    assertFixedPointGunnery(state);
    const def = getFireModeDefinition(state.fireMode);
    const active = !def.eligibilityPredicateDeferred && state.fireMode !== "CEASE_FIRE";

    const outcome = resolveOneBattery(b, {
      battleId,
      minute,
      substep,
      contactsMap,
      engine: input.engine,
      shipPositions: input.shipPositions,
      active,
    });
    if (outcome.fired) {
      salvos.push(outcome.record!);
      events.push(outcome.event!);
    }
    nextStates[b.id] = outcome.nextState;
  }

  return { salvos, events, nextStates };
}

interface BatteryContext {
  battleId: string;
  minute: number;
  substep: number;
  contactsMap: Map<string, TacticalContact>;
  engine?: RandomEngine;
  shipPositions?: Readonly<Record<string, Position>>;
  active: boolean;
}

function resolveOneBattery(b: GunneryBattery, ctx: BatteryContext): BatteryOutcome {
  const state = b.state;

  if (!ctx.active) {
    return { fired: false, nextState: state };
  }

  let advanced = withGunneryStateHash({
    ...state,
    reloadProgressMs: advanceReloadProgress(state.reloadProgressMs, TACTICAL_MINUTE_MS),
  });

  if (advanced.fireControlSolutionQualityBp < SURFACE_FIRE_CONTROL_MINIMUM_BP) {
    return { fired: false, nextState: advanced };
  }
  if (state.targetContactId === NO_TARGET || state.targetContactId === "") {
    return { fired: false, nextState: advanced };
  }
  const targetTrack = ctx.contactsMap.get(state.targetContactId);
  const blindFire =
    b.blindFireAllowed === true && targetTrack !== undefined && targetTrack.confidence <= 0;
  if (!blindFire) validateTargetOrder(state.targetContactId, ctx.contactsMap);

  let currentRangeUm: number | undefined;
  if (ctx.shipPositions) {
    const shooterPos = ctx.shipPositions[b.ownerShipId];
    const targetTrack = ctx.contactsMap.get(state.targetContactId);
    if (shooterPos && targetTrack?.position) {
      currentRangeUm = rangeBetweenUm(shooterPos, targetTrack.position);
    }
  }

  if (currentRangeUm !== undefined) {
    const next = withGunneryStateHash({ ...advanced, rangeEstimateUm: currentRangeUm });
    advanced = next;
  }

  const rate = computeEffectiveReloadMs(b.baseReloadMs, b.rateFactors);
  if (!isReloadComplete(advanced.reloadProgressMs, rate.effectiveReloadMs)) {
    return { fired: false, nextState: advanced };
  }

  const { ammunition: nextAmmo, account } = reserveAndConsumeAmmunition(
    state.ammunition,
    b.salvoCount,
    b.preferredType,
    b.permittedTypes ?? AMMUNITION_TYPES,
  );

  const accuracyFactors =
    currentRangeUm !== undefined
      ? { ...b.accuracyFactors, range: rangeMultiplierBp(currentRangeUm) }
      : b.accuracyFactors;
  const acc = resolveAccuracy(accuracyFactors);
  if (!ctx.engine) {
    throw new BluewaveError(INVALID_GUNNERY_STATE, {
      code: INVALID_GUNNERY_STATE,
      reason: "a keyed RandomEngine is required to resolve a gunnery hit draw",
      batteryId: b.id,
    });
  }
  const salvoAccuracyBp = salvoBatchAccuracyBp(acc.finalAccuracyBp, b.salvoCount);
  const hit = resolveHit(
    ctx.engine,
    { battleId: ctx.battleId, batteryId: b.id, minute: ctx.minute, substep: ctx.substep },
    salvoAccuracyBp,
  );

  const nextState: GunneryState = withGunneryStateHash({
    ...state,
    ...(currentRangeUm !== undefined ? { rangeEstimateUm: currentRangeUm } : {}),
    ammunition: nextAmmo,
    reloadProgressMs: resetReloadProgress(),
    lastSalvoMinute: ctx.minute,
    lastSalvoSubstep: ctx.substep,
  });

  const eventId = gunneryEventId({
    battleId: ctx.battleId,
    minute: ctx.minute,
    substep: ctx.substep,
    batteryId: b.id,
    targetContactId: state.targetContactId,
  });

  const seed: GunneryEventSeed = {
    eventId,
    battleId: ctx.battleId,
    minute: ctx.minute,
    substep: ctx.substep,
    batteryId: b.id,
    shooterId: b.ownerShipId,
    targetContactId: state.targetContactId,
    commandSource: b.commandSource,
    fireMode: state.fireMode as FireMode,
    ammunition: {
      type: account.type,
      rounds: account.count,
      before: account.before,
      after: account.after,
    },
    accuracy: acc,
    rate,
    randomDecisions: [hit],
    outcome: hit.isHit ? "HIT" : "MISS",
  };

  if (state.gunFamilyId !== undefined || state.ammunitionPatternId !== undefined) {
    seed.weaponIdentity = {
      ...(state.gunFamilyId !== undefined ? { gunFamilyId: state.gunFamilyId } : {}),
      gunModelId: state.gunDefinitionId,
      mountId: state.mountDefinitionId,
      ...(state.ammunitionPatternId !== undefined
        ? { ammunitionId: state.ammunitionPatternId }
        : {}),
    };
  }

  const record = makeGunneryEventRecord(seed);

  const event: BattleEvent = {
    battleId: ctx.battleId,
    minute: ctx.minute,
    substep: ctx.substep,
    eventPriority: GUNNERY_EVENT_PRIORITY,
    actorId: b.id,
    targetId: state.targetContactId,
    eventId,
    eventType: "gunnery_salvo",
    eventHash: record.eventHash,
  };

  return { fired: true, record, event, nextState };
}
