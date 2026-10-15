//packages/combat/src/gunnery/resolve.ts
// INC-4: resolveGunnery — the pure minute-advance surface-gunnery stage (AC-11).
// Given the observing ships' batteries (their GunneryState + per-battery definitions)
// and the B-2 TacticalContact tracks, it decides which batteries fire this minute:
//
//   * in an IMPLEMENTED surface fire mode (RANGING / NORMAL / LOCAL_CONTROL);
//     CEASE_FIRE never fires and RAPID/AA_TRACKING/AA_BARRAGE report their DEFERRED
//     predicate rather than fabricating one (AC-2) -> battery does not fire;
//   * with a fire-control solution >= SURFACE_FIRE_CONTROL_MINIMUM_BP;
//   * referencing a LEGAL contact track (fog-of-war: reuse validateTargetOrder,
//     DESIGN-38 predicate; a battery targeting a hidden/illegal true asset fails
//     with TACTICAL_FOG_OF_WAR_VIOLATION — AC-12);
//   * reload complete (DESIGN-39 §4) after the minute's reload work;
//   * with ammunition available (atomic reserve+consume, AC-7).
//
// Reload progress advances by one tactical minute for active (non-CEASE_FIRE,
// non-deferred) batteries BEFORE the fire check; a battery that fires resets its
// reload to 0. Eligible batteries produce ONE salvo per minute: a GunneryEventRecord
// (immutable, §30) plus a ledger-ready BattleEvent, and an updated GunneryState.
// Pure/deterministic: the only randomness is the domain-separated keyed hit draw
// (INC-2).
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
import type { BattleEvent } from "../battleLedger.js";
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
import { validateTargetOrder } from "../targeting.js";
import type { TacticalContact } from "../contact/lifecycle.js";
import type { Position } from "../spotting/detection.js";
import { SUBSTEPS_PER_MINUTE } from "../movement/constants.js";
import { INVALID_GUNNERY_STATE } from "./reasonCodes.js";
import { rangeBetweenUm, rangeMultiplierBp } from "./rangeCurve.js";
import { salvoBatchAccuracyBp } from "./salvoBatch.js";

// Gunnery runs after spotting (step 8) in the DESIGN-38 pipeline. Contacts are
// created/updated at substeps 0 and 1 within step 8, so gunnery uses substep 2;
// its eventPriority sits after spotting (8).
export const GUNNERY_SUBSTEP = 2 as const;
export const GUNNERY_EVENT_PRIORITY = 9 as const;

// One tactical minute of reload work (60 discrete 1-second substeps).
export const TACTICAL_MINUTE_MS = SUBSTEPS_PER_MINUTE * 1_000;

export interface GunneryBattery {
  id: string; // batteryId
  ownerShipId: string; // shooter / observing ship carrying the battery
  sideId?: string;
  mountOrdinal?: number;
  commandSource: string;
  baseReloadMs: number; // positive integer ms (DESIGN-39 §4)
  salvoCount: number; // rounds fired in one salvo
  preferredType: AmmunitionType;
  permittedTypes?: readonly AmmunitionType[];
  rateFactors: GunneryRateFactors;
  accuracyFactors: GunneryAccuracyFactors;
  state: GunneryState; // authoritative per-battery state
}

export interface ResolveGunneryInput {
  battleId: string;
  minute: number;
  substep?: number;
  batteries: readonly GunneryBattery[];
  contacts: readonly TacticalContact[];
  engine?: RandomEngine;
  /** True post-movement ship positions (`assetId -> [x, y]` integer µm), used
   *  to fill the DESIGN-39 §3 `range` accuracy factor from the TRUE legal
   *  contact range each minute (P-1 ticket 06): a battery targeting a legal
   *  contact whose track and shooter position are both supplied fires at
   *  `rangeMultiplierBp(distance shooters -> contact)`, and its range estimate
   *  is written into the next GunneryState. When positions are absent the
   *  battery's authored `range` factor and range estimate are used unchanged
   *  (backwards-compatible; direct-call tests never pass positions). */
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

  // deterministic iteration over the supplied batteries (declared order); output
  // is canonically re-ordered downstream (battleLedger / gunneryEventOrder).
  for (const b of input.batteries) {
    const state = b.state;
    assertFixedPointGunnery(state);
    const def = getFireModeDefinition(state.fireMode);
    // CEASE_FIRE and deferred-predicate modes (RAPID/AA) do not participate in an
    // active reload cycle this slice; CEASE_FIRE preserves progress (AC-2).
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

  // Not in an active reload cycle (CEASE_FIRE / deferred modes) -> no fire, and
  // reload progress is preserved (no advance).
  if (!ctx.active) {
    return { fired: false, nextState: state };
  }

  // Advance reload by one tactical minute's work, then evaluate firing predicates.
  let advanced = withGunneryStateHash({
    ...state,
    reloadProgressMs: advanceReloadProgress(state.reloadProgressMs, TACTICAL_MINUTE_MS),
  });

  // Surface fire-control sufficiency (DESIGN-39 §1 / reason code in spec §1.4).
  if (advanced.fireControlSolutionQualityBp < SURFACE_FIRE_CONTROL_MINIMUM_BP) {
    return { fired: false, nextState: advanced };
  }
  // No contact assigned -> nothing to fire at (not a violation).
  if (state.targetContactId === NO_TARGET || state.targetContactId === "") {
    return { fired: false, nextState: advanced };
  }
  // Fog-of-war (AC-12): the battery MUST reference a legal contact track; a hidden
  // / illegal true asset fails with TACTICAL_FOG_OF_WAR_VIOLATION (validateTargetOrder).
  validateTargetOrder(state.targetContactId, ctx.contactsMap);

  // P-1 ticket 06: the TRUE legal contact range this minute. The engine supplies
  // post-movement ship positions; the range is measured shooter -> contact-track
  // position in integer µm (floored distance), overriding the battle planner's
  // 10 km estimate. When positions (or the target's track position) are absent,
  // `currentRangeUm` stays undefined and the battery behaves exactly as before
  // (authored `range` factor + authored range estimate — the caller authored the
  // factor, so there is nothing to fall back to and fail on).
  let currentRangeUm: number | undefined;
  if (ctx.shipPositions) {
    const shooterPos = ctx.shipPositions[b.ownerShipId];
    const targetTrack = ctx.contactsMap.get(state.targetContactId);
    if (shooterPos && targetTrack?.position) {
      currentRangeUm = rangeBetweenUm(shooterPos, targetTrack.position);
    }
  }

  // The true range is authoritative state: write it into the advanced state even
  // when the battery will not fire this minute (reload/solution gating), so the
  // next minute's state reflects the measured range regardless of firing.
  if (currentRangeUm !== undefined) {
    const next = withGunneryStateHash({ ...advanced, rangeEstimateUm: currentRangeUm });
    advanced = next;
  }

  // Reload complete (DESIGN-39 §4) after this minute's reload work.
  const rate = computeEffectiveReloadMs(b.baseReloadMs, b.rateFactors);
  if (!isReloadComplete(advanced.reloadProgressMs, rate.effectiveReloadMs)) {
    return { fired: false, nextState: advanced };
  }

  // Atomic ammunition reserve+consume (AC-7). Fully committed or throws
  // GUNNERY_AMMUNITION_UNAVAILABLE; never partially consumed.
  const { ammunition: nextAmmo, account } = reserveAndConsumeAmmunition(
    state.ammunition,
    b.salvoCount,
    b.preferredType,
    b.permittedTypes ?? AMMUNITION_TYPES,
  );

  // Accuracy + the single keyed hit draw (INC-2). When the true range is known,
  // its §3 `range` factor replaces the battery's authored (neutral) one for this
  // salvo; `record.accuracy` keeps the per-round §3 resolution while
  // `randomDecisions[0].finalAccuracyBp` carries the salvo batch value below.
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
  // P-1 ticket 06: N-gun salvo sensitivity without changing the ONE-draw shape —
  // the binomial-equivalent batch probability of `salvoCount` independent rounds
  // is evaluated exactly (bigint) and fed to the single keyed draw.
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
    // The single keyed draw carries the SALVO (batch) probability — the per-round
    // §3 resolution stays in `accuracy`; `finalAccuracyBp` here is that batch
    // value (P-1 ticket 06).
    randomDecisions: [hit],
    outcome: hit.isHit ? "HIT" : "MISS",
  };

  // ADR-0093 Step 4: carry the first-class armament identity when the battery was projected from a
  // compiled design that carries a `CompiledArmamentMount` snapshot; legacy batteries omit it.
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
