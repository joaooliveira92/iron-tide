import type { CampaignSnapshot } from "@bluewave/campaign";
import type { BattleManifest } from "@bluewave/combat";
import {
  advancePlayerBattleMinute,
  createPlayerBattleSession,
  playerBattleResult,
  playerBattleSessionHash,
  playerBattleView,
  runPlayerBattleToEnd,
  type AutoResolverNation,
  type PlayerBattleSession,
} from "@bluewave/combat/battleResolution";
import { isBluewaveError } from "@bluewave/contracts";
import { Effect } from "effect";
import type {
  AdvancePlayerBattleResult,
  FinishPlayerBattleResult,
  PlayerBattleResultDto,
  StartPlayerBattleResult,
} from "../../shared/player-battle-contract.js";
import { toCombatOrders } from "../../shared/player-battle-orders.js";
import type { PlayerBattleStep } from "../playerBattleSidecar.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { DecisionSource } from "../runtime/decisionSource.js";
import { PlayerBattleRegistry } from "../runtime/playerBattleRegistry.js";
import { PendingTurnStore, PlayerBattleStore } from "../runtime/turnSidecarStores.js";
import { runTurnTransaction } from "./turnTransaction.js";

export interface PlayerBattleRefusal {
  readonly kind: "refused";
  readonly reason: string;
  readonly diagnostics: readonly string[];
}

export type ResumeOutcome = "fresh" | "resumed" | "resume-failed" | "save-corrupt";

export type StartBattleOutcome =
  | {
      readonly kind: "started";
      readonly resume: ResumeOutcome;
      readonly value: StartPlayerBattleResult;
    }
  | PlayerBattleRefusal;

export type StepBattleOutcome =
  | { readonly kind: "stepped"; readonly value: AdvancePlayerBattleResult }
  | PlayerBattleRefusal;

export type FinishBattleOutcome =
  | { readonly kind: "finished"; readonly value: FinishPlayerBattleResult }
  | PlayerBattleRefusal;

const refuse = (reason: string, ...diagnostics: string[]): PlayerBattleRefusal => ({
  kind: "refused",
  reason,
  diagnostics,
});

function applyStep(session: PlayerBattleSession, step: PlayerBattleStep): PlayerBattleSession {
  const orders = toCombatOrders(step.divisions);
  return step.mode === "to_end"
    ? runPlayerBattleToEnd(session, orders)
    : advancePlayerBattleMinute(session, orders);
}

type Replay =
  | { readonly kind: "replayed"; readonly session: PlayerBattleSession }
  | { readonly kind: "failed" };

function replaySteps(session: PlayerBattleSession, steps: readonly PlayerBattleStep[]): Replay {
  try {
    return { kind: "replayed", session: steps.reduce(applyStep, session) };
  } catch {
    return { kind: "failed" };
  }
}

function nationOf(
  snapshot: CampaignSnapshot,
  nationId: string,
  designs: CampaignSnapshot["designs"],
): AutoResolverNation {
  const nation = snapshot.nations.get(nationId);
  if (nation === undefined) throw new Error(`No nation ${nationId} in the battle snapshot`);
  return {
    nationId,
    ships: nation.fleets.flatMap((fleet) => fleet.ships),
    designs,
    divisions: nation.divisions,
    officers: nation.officers,
  };
}

function toResultDto(session: PlayerBattleSession): PlayerBattleResultDto {
  const result = playerBattleResult(session);
  return {
    battleId: session.battleId,
    winnerId: result.winnerId,
    loserId: result.loserId,
    attackerLosses: [...result.attackerLosses],
    defenderLosses: [...result.defenderLosses],
    damageReport: { ...result.damageReport },
  };
}

export function projectSession(
  snapshot: CampaignSnapshot,
  battleId: string,
  campaignSeed: string,
  pending: { readonly createdAt: string; readonly playerNationId: string },
): PlayerBattleSession | PlayerBattleRefusal {
  const manifest = (snapshot.wars.battleManifests ?? []).find(
    (candidate) => candidate.battleId === battleId,
  );
  if (manifest === undefined) {
    return refuse("BATTLE_MANIFEST_MISSING", `No committed manifest for battle ${battleId}`);
  }
  const strategicWeather = snapshot.strategicWeather.find(
    (candidate) => candidate.areaId === manifest.areaId,
  );
  if (strategicWeather === undefined) {
    return refuse(
      "BATTLE_WEATHER_MISSING",
      `No committed strategic weather for area ${manifest.areaId}`,
    );
  }
  try {
    return createPlayerBattleSession({
      manifest: manifest as BattleManifest,
      areaId: manifest.areaId,
      campaignMonth: pending.createdAt,
      attacker: nationOf(snapshot, manifest.attackerId, snapshot.designs),
      defender: nationOf(snapshot, manifest.defenderId, snapshot.designs),
      playerNationId: pending.playerNationId,
      strategicWeather,
      campaignSeed,
      rulesetVersion: snapshot.rulesetVersion,
      formulaVersion: manifest.formulaVersion,
      rngVersion: manifest.rngVersion,
    });
  } catch (error) {
    return refuse("PLAYER_BATTLE_PROJECTION_FAILED", projectionFailureReason(error));
  }
}

export const projectionFailureReason = (error: unknown): string => {
  if (isBluewaveError(error)) {
    const { reason } = error.context;
    return typeof reason === "string" ? reason : error.message;
  }
  return error instanceof Error ? error.message : String(error);
};

const isRefusal = (
  value: PlayerBattleSession | PlayerBattleRefusal,
): value is PlayerBattleRefusal => "kind" in value && value.kind === "refused";

export const startPlayerBattle = (input: {
  readonly sessionId: string;
  readonly battleId: string;
}) =>
  Effect.gen(function* () {
    const record = yield* (yield* CampaignSessionStore).get(input.sessionId);
    const pending = yield* (yield* PendingTurnStore).load(record.saveDir);
    if (pending === null) {
      return refuse("NO_PENDING_TURN", `No pending turn for session ${input.sessionId}`);
    }
    if (
      pending.outstanding?.kind !== "battle" ||
      pending.outstanding.subjectKey !== input.battleId
    ) {
      return refuse(
        "NO_OUTSTANDING_BATTLE",
        `Session ${input.sessionId} is not awaiting battle ${input.battleId}`,
      );
    }

    const decisions = yield* DecisionSource;
    const outcome = yield* runTurnTransaction({
      sessionId: input.sessionId,
      expectedRevision: pending.startingRevision,
      recordedInputs: pending.recordedInputs,
      pendingDecisions: yield* decisions.pendingDecisions(input.sessionId),
      allowInterruptions: true,
    });
    if (outcome.kind !== "suspended" || outcome.request?.kind !== "battle") {
      return refuse(
        "PLAYER_BATTLE_UNAVAILABLE",
        "The suspended turn did not reproduce the battle request",
      );
    }

    const projected = projectSession(
      outcome.snapshot,
      input.battleId,
      `${record.campaignSeed}:month:${String(pending.startingRevision)}`,
      pending,
    );
    if (isRefusal(projected)) return projected;

    const battleSaves = yield* PlayerBattleStore;
    const loaded = yield* battleSaves.load(record.saveDir, {
      turnId: pending.turnId,
      battleId: input.battleId,
    });
    let session = projected;
    let steps: readonly PlayerBattleStep[] = [];
    let resume: ResumeOutcome = loaded.kind === "corrupt" ? "save-corrupt" : "fresh";
    if (loaded.kind === "found" && loaded.save.steps.length > 0) {
      const replay = replaySteps(projected, loaded.save.steps);
      if (replay.kind === "replayed") {
        session = replay.session;
        steps = loaded.save.steps;
        resume = "resumed";
      } else {
        resume = "resume-failed";
        yield* battleSaves.clear(record.saveDir);
      }
    }

    yield* (yield* PlayerBattleRegistry).put(input.sessionId, input.battleId, { session, steps });
    const value: StartPlayerBattleResult = {
      sessionHash: playerBattleSessionHash(session),
      view: playerBattleView(session),
      resumed: resume === "resumed",
      lastOrders: [...(steps.at(-1)?.divisions ?? [])],
    };
    return { kind: "started" as const, resume, value };
  });

export const stepPlayerBattle = (input: {
  readonly sessionId: string;
  readonly battleId: string;
  readonly step: PlayerBattleStep;
}) =>
  Effect.gen(function* () {
    const record = yield* (yield* CampaignSessionStore).get(input.sessionId);
    const registry = yield* PlayerBattleRegistry;
    const live = yield* registry.get(input.sessionId, input.battleId);
    if (live === null) {
      return refuse("PLAYER_BATTLE_NOT_STARTED", "Start the player battle before advancing it");
    }
    const next = applyStep(live.session, input.step);
    const steps = [...live.steps, input.step];
    yield* registry.put(input.sessionId, input.battleId, { session: next, steps });
    const pending = yield* (yield* PendingTurnStore).load(record.saveDir);
    if (pending !== null) {
      yield* (yield* PlayerBattleStore).save(record.saveDir, {
        schemaVersion: "1.0.0",
        turnId: pending.turnId,
        battleId: input.battleId,
        steps,
      });
    }
    const value: AdvancePlayerBattleResult = {
      sessionHash: playerBattleSessionHash(next),
      view: playerBattleView(next),
      result: next.ended ? toResultDto(next) : null,
    };
    return { kind: "stepped" as const, value };
  });

export const finishPlayerBattle = (input: {
  readonly sessionId: string;
  readonly battleId: string;
}) =>
  Effect.gen(function* () {
    const record = yield* (yield* CampaignSessionStore).get(input.sessionId);
    const registry = yield* PlayerBattleRegistry;
    const live = yield* registry.get(input.sessionId, input.battleId);
    if (live === null) {
      return refuse("PLAYER_BATTLE_NOT_STARTED", "Start the player battle before finishing it");
    }
    if (!live.session.ended) {
      return refuse(
        "PLAYER_BATTLE_NOT_FINISHED",
        "The battle has not reached a battle-end decision",
      );
    }
    const value: FinishPlayerBattleResult = { result: toResultDto(live.session) };
    yield* registry.remove(input.sessionId, input.battleId);
    yield* (yield* PlayerBattleStore).clear(record.saveDir);
    return { kind: "finished" as const, value };
  });
