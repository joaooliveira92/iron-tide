import {
  applyBattleConsequences,
  applyBattleResult,
  collectLostShips,
  recordResolvedBattle,
} from "./battles.js";
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
  type OfferRequest,
  type OfferResponseInput,
  type TurnPhase,
  type PendingDecision,
  type RecordedInput,
  type SuspendedTurn,
} from "@bluewave/messages";
import { declineRefusal } from "./battleDecline.js";
import type { OfferContent } from "./battleOffer.js";
import type { MonthContext } from "./monthContext.js";

export interface InterruptionChannel {
  readonly turnId: string;
  readonly recordedInputs: readonly RecordedInput[];
  readonly pendingDecisions?: readonly PendingDecision[];
}

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
  refusalTag?: string,
): void {
  state.suspended = {
    turnId: state.turnId,
    request,
    nextInterruptionOrdinal: state.nextOrdinal,
    reason,
    ...(refusalTag === undefined ? {} : { refusalTag }),
  };
}

interface DecisionResolution {
  readonly answer: DecisionAnswer;
  readonly option: DecisionOption;
}

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

export type OfferRefusal =
  | { readonly _tag: "OfferResponseDuplicate" }
  | { readonly _tag: "OfferResponseOutOfOrder" }
  | { readonly _tag: "OfferResponseWrongKind" }
  | { readonly _tag: "OfferResponseStale" }
  | { readonly _tag: "OfferResponseTampered" }
  | { readonly _tag: "OfferResponseWrongBattle" }
  | { readonly _tag: "BATTLE_DECLINE_NOT_ALLOWED" }
  | { readonly _tag: "OfferDeclineUnpriced" };

export type OfferResponseResolution =
  | { readonly status: "inactive" }
  | { readonly status: "awaiting"; readonly ordinal: number; readonly interruptionId: string }
  | {
      readonly status: "invalid";
      readonly ordinal: number;
      readonly interruptionId: string;
      readonly refusal: OfferRefusal;
    }
  | {
      readonly status: "resolved";
      readonly response: OfferResponseInput;
      readonly inputHash: string;
    };

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
  const refuse = (refusal: OfferRefusal): OfferResponseResolution => ({
    status: "invalid",
    ordinal,
    interruptionId,
    refusal,
  });
  const atOrdinal = state.recordedInputs.filter((input) => input.ordinal === ordinal);
  if (atOrdinal.length === 0) {
    return state.recordedInputs.some((input) => input.ordinal > ordinal)
      ? refuse({ _tag: "OfferResponseOutOfOrder" })
      : { status: "awaiting", ordinal, interruptionId };
  }
  if (atOrdinal.length > 1) return refuse({ _tag: "OfferResponseDuplicate" });
  const recorded = atOrdinal[0]!;
  if (recorded.kind !== "offer") return refuse({ _tag: "OfferResponseWrongKind" });
  if (recorded.interruptionId !== interruptionId) return refuse({ _tag: "OfferResponseStale" });
  const expectedHash = computeInputHash({
    ordinal,
    kind: "offer",
    interruptionId,
    payload: recorded.payload,
  });
  if (recorded.inputHash !== expectedHash) return refuse({ _tag: "OfferResponseTampered" });
  const response = recorded.payload as OfferResponseInput;
  if (response.interruptionId !== interruptionId) return refuse({ _tag: "OfferResponseStale" });
  if (response.battleId !== subject.battleId) return refuse({ _tag: "OfferResponseWrongBattle" });
  state.nextOrdinal = ordinal + 1;
  return { status: "resolved", response, inputHash: recorded.inputHash };
}

export type AnsweredOffer = OfferResponseInput & { readonly inputHash: string };

export function consumeOffer(ctx: MonthContext, content: OfferContent): AnsweredOffer | null {
  const state = ctx.interruption;
  if (state === undefined) return null;
  const phase = "battle_resolution" as const;
  const resolution = consumeOfferResponse(state, { battleId: content.battleId, phase });
  if (resolution.status === "inactive") return null;

  const ordinal = state.nextOrdinal - (resolution.status === "resolved" ? 1 : 0);
  const interruptionId =
    resolution.status === "resolved"
      ? resolution.response.interruptionId
      : resolution.interruptionId;
  const request: OfferRequest = {
    kind: "offer",
    turnId: state.turnId,
    interruptionId,
    phase,
    ordinal,
    subjectKey: content.battleId,
    battleId: content.battleId,
    titleKey: "messages.offer.request.title",
    bodyKey: "messages.offer.request.body",
    interpolation: {
      battleId: content.battleId,
      missionType: content.missionType,
      areaId: content.areaId,
      attackerId: content.attackerId,
      defenderId: content.defenderId,
    },
    missionType: content.missionType,
    acceptanceClass: content.acceptanceClass,
    areaId: content.areaId,
    attackerId: content.attackerId,
    defenderId: content.defenderId,
    playerSide: content.playerSide,
    playerForce: content.playerForce,
    estimate: content.estimate,
    supportForcePresent: content.supportForcePresent,
    ...(content.supportNationIds === undefined
      ? {}
      : { supportNationIds: content.supportNationIds }),
    declineStatementKeys: content.declineStatementKeys,
  };

  switch (resolution.status) {
    case "awaiting":
      suspend(state, request, "awaiting-input");
      return null;
    case "invalid":
      suspend(state, request, "invalid-input", resolution.refusal._tag);
      return null;
    case "resolved": {
      const answered = resolution.response;
      if (answered.response === "decline") {
        const refusal =
          ctx.battleOffers === undefined ? null : declineRefusal(content, ctx.battleOffers);
        if (refusal !== null) {
          state.nextOrdinal = ordinal;
          suspend(state, request, "invalid-input", refusal._tag);
          return null;
        }
      }
      return { ...answered, inputHash: resolution.inputHash };
    }
  }
}

function damageReport(result: BattleResultInput): Record<string, SafeInt> {
  const out: Record<string, SafeInt> = {};
  for (const [shipId, loss] of Object.entries(result.damageReport)) {
    out[shipId] = SafeInt(Number(loss));
  }
  return out;
}

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
  const lostShips = collectLostShips(
    ctx.currentSnapshot,
    battle,
    {
      damageReport: report,
      attackerSunkIds: [...result.attackerLosses],
      defenderSunkIds: [...result.defenderLosses],
    },
    ctx.campaignMonth,
  );
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
    ...(lostShips.length > 0 ? { lostShips } : {}),
  });
}

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
