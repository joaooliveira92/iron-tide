import {
  applyBattleConsequences,
  applyBattleResult,
  collectLostShips,
  recordResolvedBattle,
} from "./battles.js";
import type { BattleInstance, NationState } from "@bluewave/campaign";
import { SafeInt, TURN_PHASES } from "@bluewave/contracts";
import { compareCodePoints } from "@bluewave/deterministic";
import {
  computeInputHash,
  computeInterruptionId,
  type BattleRequest,
  type BattleResultInput,
  type DecisionAnswer,
  type DecisionOption,
  type DecisionRequest,
  type InterruptionRequest,
  type PendingDecision,
  type RecordedInput,
  type SuspendedTurn,
} from "@bluewave/messages";
import type { MonthCheckpoint, PhaseContext } from "./pipeline.js";

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

export function suspend(
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
  ctx: PhaseContext,
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

function applyDecisionEffects(ctx: PhaseContext, option: DecisionOption): void {
  let nations: Map<string, NationState> | undefined;
  for (const effect of option.effects) {
    const current = nations ?? ctx.snapshot.read("nations");
    const nation = current.get(effect.nationId);
    if (nation === undefined) continue;
    if (nations === undefined) nations = new Map(ctx.snapshot.read("nations"));
    nations.set(effect.nationId, {
      ...nation,
      treasury: SafeInt(Number(nation.treasury) + effect.delta),
    });
  }
  if (nations !== undefined) {
    ctx.snapshot.write("nations", nations);
  }
}

export function runInterruptionCheckpoint(ctx: PhaseContext): boolean {
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

export const interruptionCheckpoint: MonthCheckpoint = {
  id: "interruption_checkpoint",
  name: "Interruption Checkpoint",
  after: "resolve_carrier_operations",
  permissions: { reads: ["nations"], writes: ["nations"], rng: false },
  run: runInterruptionCheckpoint,
};

export function consumeBattleResult(
  ctx: PhaseContext,
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

function damageReport(result: BattleResultInput): Record<string, SafeInt> {
  const out: Record<string, SafeInt> = {};
  for (const [shipId, loss] of Object.entries(result.damageReport)) {
    out[shipId] = SafeInt(Number(loss));
  }
  return out;
}

export function applyRecordedBattleResult(
  ctx: PhaseContext,
  battle: BattleInstance,
  result: BattleResultInput,
): void {
  const report = damageReport(result);
  let snapshot = ctx.snapshot.view();
  if (result.winnerId !== null && result.loserId !== null) {
    snapshot = applyBattleResult(
      snapshot,
      battle,
      { winnerId: result.winnerId, loserId: result.loserId, damageReport: report },
      ctx.campaignMonth,
      ctx.collector,
    );
  }
  const lostShips = collectLostShips(
    snapshot,
    battle,
    {
      damageReport: report,
      attackerSunkIds: [...result.attackerLosses],
      defenderSunkIds: [...result.defenderLosses],
    },
    ctx.campaignMonth,
  );
  snapshot = applyBattleConsequences(snapshot, battle, {
    damageReport: report,
    attackerSunkIds: [...result.attackerLosses],
    defenderSunkIds: [...result.defenderLosses],
  });
  snapshot = recordResolvedBattle(snapshot, battle, {
    winnerId: result.winnerId,
    loserId: result.loserId,
    attackerLosses: [...result.attackerLosses].sort(),
    defenderLosses: [...result.defenderLosses].sort(),
    damageReport: report,
    explanation: ["player-resolved"],
    ...(lostShips.length > 0 ? { lostShips } : {}),
  });
  ctx.snapshot.current = snapshot;
}

export function trailingInputSuspension(
  state: InterruptionState | undefined,
): SuspendedTurn | undefined {
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
