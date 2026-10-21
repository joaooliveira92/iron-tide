// Additive interruption seam (D-17 stage 1/2/3, R-21).
//
// A month can pause for a mandatory decision or a battle and later resume. This
// module is deliberately small: it consumes recorded external inputs strictly by
// ordinal, raises requests when an input is absent, and applies a recorded battle
// result exactly once. It is NOT a `PhaseResource`, draws no randomness, and adds
// no domain-event kind, so the phase registry/footprints and the frozen event
// wire format are untouched.
import { applyBattleConsequences, applyBattleResult, recordResolvedBattle } from "./battles.js";
import type { BattleInstance, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { compareCodePoints } from "@bluewave/deterministic";
import {
  computeInputHash,
  computeInterruptionId,
  TURN_PHASES,
  type BattleRequest,
  type BattleResultInput,
  type DecisionAnswer,
  type DecisionOption,
  type DecisionRequest,
  type InterruptionRequest,
  type OfferResponseInput,
  type TurnPhase,
  type PendingDecision,
  type RecordedInput,
  type SuspendedTurn,
} from "@bluewave/messages";
import type { MonthContext } from "./monthContext.js";

/**
 * External inputs supplied to a month execution. Present when the caller wants
 * interruption behaviour (the desktop app); absent/undefined keeps today's
 * uninterrupted, byte-identical pipeline.
 */
export interface InterruptionChannel {
  readonly turnId: string;
  readonly recordedInputs: readonly RecordedInput[];
  readonly pendingDecisions?: readonly PendingDecision[];
}

/** Mutable per-execution interruption state — never serialized. */
export interface InterruptionState {
  readonly turnId: string;
  readonly recordedInputs: readonly RecordedInput[];
  readonly pendingDecisions: readonly PendingDecision[];
  nextOrdinal: number;
  suspended?: SuspendedTurn;
}

export function createInterruptionState(channel: InterruptionChannel): InterruptionState {
  return {
    turnId: channel.turnId,
    recordedInputs: channel.recordedInputs,
    pendingDecisions: channel.pendingDecisions ?? [],
    nextOrdinal: 0,
  };
}

const PHASE_INDEX: ReadonlyMap<string, number> = new Map(
  TURN_PHASES.map((phase, index) => [phase, index]),
);

function phaseIndex(phase: string): number {
  return PHASE_INDEX.get(phase) ?? TURN_PHASES.length;
}

function suspend(
  state: InterruptionState,
  request: InterruptionRequest,
  reason: SuspendedTurn["reason"],
): void {
  state.suspended = {
    turnId: state.turnId,
    request,
    nextInterruptionOrdinal: state.nextOrdinal,
    reason,
  };
}

interface DecisionResolution {
  readonly answer: DecisionAnswer;
  readonly option: DecisionOption;
}

/**
 * Consume the recorded input for the next ordinal as a decision answer. Returns
 * the validated answer and its authored option, or `null` after suspending (the
 * input is absent, or present but mismatched — never guessed).
 */
export function consumeDecision(
  ctx: MonthContext,
  pending: PendingDecision,
): DecisionResolution | null {
  const state = ctx.interruption;
  if (state === undefined) return null;

  const ordinal = state.nextOrdinal;
  const interruptionId = computeInterruptionId({
    turnId: state.turnId,
    phase: pending.phase,
    ordinal,
    subjectKey: pending.subjectKey,
  });
  const request: DecisionRequest = {
    kind: "decision",
    turnId: state.turnId,
    interruptionId,
    phase: pending.phase,
    ordinal,
    subjectKey: pending.subjectKey,
    decisionId: pending.decisionId,
    titleKey: pending.titleKey,
    bodyKey: pending.bodyKey,
    interpolation: pending.interpolation,
    options: pending.options,
  };

  const recorded = state.recordedInputs.find((input) => input.ordinal === ordinal);
  if (recorded === undefined) {
    suspend(state, request, "awaiting-input");
    return null;
  }
  const expectedHash = computeInputHash({
    ordinal,
    kind: "decision",
    interruptionId,
    payload: recorded.payload,
  });
  if (
    recorded.kind !== "decision" ||
    recorded.interruptionId !== interruptionId ||
    recorded.inputHash !== expectedHash
  ) {
    suspend(state, request, "invalid-input");
    return null;
  }
  const answer = recorded.payload as DecisionAnswer;
  const option = pending.options.find((candidate) => candidate.optionId === answer.optionId);
  if (option === undefined) {
    suspend(state, request, "invalid-input");
    return null;
  }
  state.nextOrdinal = ordinal + 1;
  return { answer, option };
}

function applyDecisionEffects(ctx: MonthContext, option: DecisionOption): void {
  let nations: Map<string, NationState> | undefined;
  for (const effect of option.effects) {
    const current = nations ?? ctx.currentSnapshot.nations;
    const nation = current.get(effect.nationId);
    if (nation === undefined) continue;
    if (nations === undefined) nations = new Map(ctx.currentSnapshot.nations);
    nations.set(effect.nationId, {
      ...nation,
      treasury: SafeInt(Number(nation.treasury) + effect.delta),
    });
  }
  if (nations !== undefined) {
    ctx.currentSnapshot = { ...ctx.currentSnapshot, nations };
  }
}

/**
 * Consume every pending decision in deterministic (phase, subject) order. Returns
 * `false` if the month suspended and must stop; `true` to continue the pipeline.
 */
export function runInterruptionCheckpoint(ctx: MonthContext): boolean {
  const state = ctx.interruption;
  if (state === undefined) return true;
  const ordered = [...state.pendingDecisions].sort(
    (a, b) =>
      phaseIndex(a.phase) - phaseIndex(b.phase) || compareCodePoints(a.subjectKey, b.subjectKey),
  );
  for (const pending of ordered) {
    const resolution = consumeDecision(ctx, pending);
    if (state.suspended !== undefined) return false;
    if (resolution !== null) applyDecisionEffects(ctx, resolution.option);
  }
  return true;
}

/**
 * Consume the recorded input for the next ordinal as a battle result. Returns the
 * validated result, or `null` after suspending (absent or mismatched input).
 */
export function consumeBattleResult(
  ctx: MonthContext,
  battle: BattleInstance,
): BattleResultInput | null {
  const state = ctx.interruption;
  if (state === undefined) return null;

  const ordinal = state.nextOrdinal;
  const subjectKey = battle["id"];
  const interruptionId = computeInterruptionId({
    turnId: state.turnId,
    phase: "battle_resolution",
    ordinal,
    subjectKey,
  });
  const request: BattleRequest = {
    kind: "battle",
    turnId: state.turnId,
    interruptionId,
    phase: "battle_resolution",
    ordinal,
    subjectKey,
    battleId: battle["id"],
    titleKey: "messages.battle.request.title",
    bodyKey: "messages.battle.request.body",
    interpolation: {
      battleId: battle["id"],
      attackerId: battle["attackerId"],
      defenderId: battle["defenderId"],
      areaId: battle["areaId"],
    },
    attackerId: battle["attackerId"],
    defenderId: battle["defenderId"],
    areaId: battle["areaId"],
  };

  const recorded = state.recordedInputs.find((input) => input.ordinal === ordinal);
  if (recorded === undefined) {
    suspend(state, request, "awaiting-input");
    return null;
  }
  const expectedHash = computeInputHash({
    ordinal,
    kind: "battle",
    interruptionId,
    payload: recorded.payload,
  });
  if (
    recorded.kind !== "battle" ||
    recorded.interruptionId !== interruptionId ||
    recorded.inputHash !== expectedHash
  ) {
    suspend(state, request, "invalid-input");
    return null;
  }
  const result = recorded.payload as BattleResultInput;
  if (result.battleId !== battle["id"]) {
    suspend(state, request, "invalid-input");
    return null;
  }
  state.nextOrdinal = ordinal + 1;
  return result;
}

/** The outcome of looking for a recorded battle-offer response at the next ordinal. */
export type OfferResponseResolution =
  | { readonly status: "inactive" }
  | { readonly status: "awaiting"; readonly ordinal: number; readonly interruptionId: string }
  | { readonly status: "invalid"; readonly ordinal: number; readonly interruptionId: string }
  | { readonly status: "resolved"; readonly response: OfferResponseInput };

/**
 * Consume the recorded input for the next ordinal as a battle-offer response (spec #109 R3, ticket #111). Hash-validated
 * and consumed strictly by ordinal, like decisions and battle results. No offer is raised by this ticket, so it reports
 * `awaiting`/`invalid` rather than suspending; the ordinal advances only on a valid, matching response.
 */
export function consumeOfferResponse(
  state: InterruptionState | undefined,
  subject: { readonly battleId: string; readonly phase: TurnPhase },
): OfferResponseResolution {
  if (state === undefined) return { status: "inactive" };
  const ordinal = state.nextOrdinal;
  const interruptionId = computeInterruptionId({
    turnId: state.turnId,
    phase: subject.phase,
    ordinal,
    subjectKey: subject.battleId,
  });
  const recorded = state.recordedInputs.find((input) => input.ordinal === ordinal);
  if (recorded === undefined) return { status: "awaiting", ordinal, interruptionId };
  const expectedHash = computeInputHash({
    ordinal,
    kind: "offer",
    interruptionId,
    payload: recorded.payload,
  });
  if (
    recorded.kind !== "offer" ||
    recorded.interruptionId !== interruptionId ||
    recorded.inputHash !== expectedHash
  ) {
    return { status: "invalid", ordinal, interruptionId };
  }
  const response = recorded.payload as OfferResponseInput;
  if (response.battleId !== subject.battleId || response.interruptionId !== interruptionId) {
    return { status: "invalid", ordinal, interruptionId };
  }
  state.nextOrdinal = ordinal + 1;
  return { status: "resolved", response };
}

function damageReport(result: BattleResultInput): Record<string, SafeInt> {
  const out: Record<string, SafeInt> = {};
  for (const [shipId, loss] of Object.entries(result.damageReport)) {
    out[shipId] = SafeInt(Number(loss));
  }
  return out;
}

/**
 * Apply a player-resolved battle outcome exactly once: war score (only for a
 * decided battle), per-ship damage and losses, and the recorded result. The
 * strategic resolver never re-rolls the battle.
 */
export function applyRecordedBattleResult(
  ctx: MonthContext,
  battle: BattleInstance,
  result: BattleResultInput,
): void {
  const report = damageReport(result);
  if (result.winnerId !== null && result.loserId !== null) {
    ctx.currentSnapshot = applyBattleResult(
      ctx.currentSnapshot,
      battle,
      { winnerId: result.winnerId, loserId: result.loserId, damageReport: report },
      ctx.campaignMonth,
      ctx.collector,
    );
  }
  ctx.currentSnapshot = applyBattleConsequences(ctx.currentSnapshot, battle, {
    damageReport: report,
    attackerSunkIds: [...result.attackerLosses],
    defenderSunkIds: [...result.defenderLosses],
  });
  ctx.currentSnapshot = recordResolvedBattle(ctx.currentSnapshot, battle, {
    winnerId: result.winnerId,
    loserId: result.loserId,
    attackerLosses: [...result.attackerLosses].sort(),
    defenderLosses: [...result.defenderLosses].sort(),
    damageReport: report,
    explanation: ["player-resolved"],
  });
}

/**
 * Detect inputs that were never consumed (extra/trailing). Any recorded input at
 * or beyond the next ordinal when the pipeline completes cleanly is invalid.
 */
export function trailingInputSuspension(ctx: MonthContext): SuspendedTurn | undefined {
  const state = ctx.interruption;
  if (state === undefined || state.suspended !== undefined) return undefined;
  const trailing = state.recordedInputs.find((input) => input.ordinal >= state.nextOrdinal);
  if (trailing === undefined) return undefined;
  return {
    turnId: state.turnId,
    request: null,
    nextInterruptionOrdinal: state.nextOrdinal,
    reason: "invalid-input",
  };
}
