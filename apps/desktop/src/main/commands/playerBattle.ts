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
  type PlayerBattleOrders,
  type PlayerBattleSession,
  type PlayerBattleStance,
} from "@bluewave/combat/battleResolution";
import { Effect } from "effect";
import type {
  AdvancePlayerBattleResult,
  FinishPlayerBattleResult,
  PlayerBattleResultDto,
  StartPlayerBattleResult,
} from "../../shared/player-battle-contract.js";
import { loadPendingTurn } from "../pendingTurn.js";
import {
  clearPlayerBattleSave,
  loadPlayerBattleSave,
  savePlayerBattle,
  type PlayerBattleStep,
} from "../playerBattleSidecar.js";
import type { CommandHandler } from "../runtime/commandProgram.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { DecisionSource } from "../runtime/decisionSource.js";
import { runTurnTransaction } from "./turnTransaction.js";

const sessions = new Map<string, PlayerBattleSession>();
const stepLogs = new Map<string, readonly PlayerBattleStep[]>();

export function dropPlayerBattleSessionsForTest(): void {
  sessions.clear();
  stepLogs.clear();
}

function applyStep(session: PlayerBattleSession, step: PlayerBattleStep): PlayerBattleSession {
  const orders = ordersOf(step.divisions);
  return step.mode === "to_end"
    ? runPlayerBattleToEnd(session, orders)
    : advancePlayerBattleMinute(session, orders);
}

function keyOf(sessionId: string, battleId: string): string {
  return `${sessionId}::${battleId}`;
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

function ordersOf(
  divisions: readonly {
    readonly divisionId: string;
    readonly stance: PlayerBattleStance;
    readonly speedPercent: number;
  }[],
): PlayerBattleOrders {
  const out: Record<string, { stance: PlayerBattleStance; speedPercent: number }> = {};
  for (const order of divisions) {
    out[order.divisionId] = {
      stance: order.stance,
      speedPercent: order.speedPercent,
    };
  }
  return { divisions: out };
}

export const startPlayerBattleProgram: CommandHandler<"startPlayerBattle"> = (payload) =>
  Effect.gen(function* () {
    const store = yield* CampaignSessionStore;
    const record = yield* store.get(payload.sessionId);
    const pending = loadPendingTurn(record.saveDir);
    if (pending === null) {
      return {
        outcome: "error" as const,
        reason: "NO_PENDING_TURN",
        diagnostics: [`No pending turn for session ${payload.sessionId}`],
      };
    }
    if (
      pending.outstanding?.kind !== "battle" ||
      pending.outstanding.subjectKey !== payload.battleId
    ) {
      return {
        outcome: "error" as const,
        reason: "NO_OUTSTANDING_BATTLE",
        diagnostics: [`Session ${payload.sessionId} is not awaiting battle ${payload.battleId}`],
      };
    }

    const decisions = yield* DecisionSource;
    const pendingDecisions = yield* decisions.pendingDecisions(payload.sessionId);
    const outcome = yield* runTurnTransaction({
      sessionId: payload.sessionId,
      expectedRevision: pending.startingRevision,
      recordedInputs: pending.recordedInputs,
      pendingDecisions,
      allowInterruptions: true,
    });
    if (outcome.kind !== "suspended" || outcome.request?.kind !== "battle") {
      return {
        outcome: "error" as const,
        reason: "PLAYER_BATTLE_UNAVAILABLE",
        diagnostics: ["The suspended turn did not reproduce the battle request"],
      };
    }

    const snapshot = outcome.snapshot;
    const manifest = (snapshot.wars.battleManifests ?? []).find(
      (candidate) => candidate.battleId === payload.battleId,
    );
    if (manifest === undefined) {
      return {
        outcome: "error" as const,
        reason: "BATTLE_MANIFEST_MISSING",
        diagnostics: [`No committed manifest for battle ${payload.battleId}`],
      };
    }
    const strategicWeather = snapshot.strategicWeather.find(
      (candidate) => candidate.areaId === manifest.areaId,
    );
    if (strategicWeather === undefined) {
      return {
        outcome: "error" as const,
        reason: "BATTLE_WEATHER_MISSING",
        diagnostics: [`No committed strategic weather for area ${manifest.areaId}`],
      };
    }

    let session: PlayerBattleSession;
    try {
      session = createPlayerBattleSession({
        manifest: manifest as BattleManifest,
        areaId: manifest.areaId,
        campaignMonth: pending.createdAt,
        attacker: nationOf(snapshot, manifest.attackerId, snapshot.designs),
        defender: nationOf(snapshot, manifest.defenderId, snapshot.designs),
        playerNationId: pending.playerNationId,
        strategicWeather,
        campaignSeed: `${record.campaignSeed}:month:${String(pending.startingRevision)}`,
        rulesetVersion: snapshot.rulesetVersion,
        formulaVersion: manifest.formulaVersion,
        rngVersion: manifest.rngVersion,
      });
    } catch (error) {
      return {
        outcome: "error" as const,
        reason: "PLAYER_BATTLE_PROJECTION_FAILED",
        diagnostics: [error instanceof Error ? error.message : String(error)],
      };
    }

    const saved = loadPlayerBattleSave(record.saveDir, {
      turnId: pending.turnId,
      battleId: payload.battleId,
    });
    let steps: readonly PlayerBattleStep[] = [];
    let resumed = false;
    if (saved !== null && saved.steps.length > 0) {
      try {
        let replayed = session;
        for (const step of saved.steps) replayed = applyStep(replayed, step);
        session = replayed;
        steps = saved.steps;
        resumed = true;
      } catch {
        clearPlayerBattleSave(record.saveDir);
      }
    }
    const key = keyOf(payload.sessionId, payload.battleId);
    sessions.set(key, session);
    stepLogs.set(key, steps);
    const lastOrders = steps.at(-1)?.divisions ?? [];
    const value: StartPlayerBattleResult = {
      sessionHash: playerBattleSessionHash(session),
      view: playerBattleView(session),
      resumed,
      lastOrders: [...lastOrders],
    };
    return { outcome: "success" as const, value, diagnostics: [] };
  });

export const advancePlayerBattleProgram: CommandHandler<"advancePlayerBattle"> = (payload) =>
  Effect.gen(function* () {
    const store = yield* CampaignSessionStore;
    const record = yield* store.get(payload.sessionId);
    const session = sessions.get(keyOf(payload.sessionId, payload.battleId));
    if (session === undefined) {
      return {
        outcome: "error" as const,
        reason: "PLAYER_BATTLE_NOT_STARTED",
        diagnostics: ["Start the player battle before advancing it"],
      };
    }
    const step: PlayerBattleStep = {
      mode: payload.mode,
      divisions: payload.divisions,
    };
    const next = applyStep(session, step);
    const key = keyOf(payload.sessionId, payload.battleId);
    sessions.set(key, next);
    const steps = [...(stepLogs.get(key) ?? []), step];
    stepLogs.set(key, steps);
    const pending = loadPendingTurn(record.saveDir);
    if (pending !== null) {
      savePlayerBattle(record.saveDir, {
        schemaVersion: "1.0.0",
        turnId: pending.turnId,
        battleId: payload.battleId,
        steps,
      });
    }
    const value: AdvancePlayerBattleResult = {
      sessionHash: playerBattleSessionHash(next),
      view: playerBattleView(next),
      result: next.ended ? toResultDto(next) : null,
    };
    return { outcome: "success" as const, value, diagnostics: [] };
  });

export const finishPlayerBattleProgram: CommandHandler<"finishPlayerBattle"> = (payload) =>
  Effect.gen(function* () {
    const store = yield* CampaignSessionStore;
    const record = yield* store.get(payload.sessionId);
    const session = sessions.get(keyOf(payload.sessionId, payload.battleId));
    if (session === undefined) {
      return {
        outcome: "error" as const,
        reason: "PLAYER_BATTLE_NOT_STARTED",
        diagnostics: ["Start the player battle before finishing it"],
      };
    }
    if (!session.ended) {
      return {
        outcome: "error" as const,
        reason: "PLAYER_BATTLE_NOT_FINISHED",
        diagnostics: ["The battle has not reached a battle-end decision"],
      };
    }
    const value: FinishPlayerBattleResult = { result: toResultDto(session) };
    sessions.delete(keyOf(payload.sessionId, payload.battleId));
    stepLogs.delete(keyOf(payload.sessionId, payload.battleId));
    clearPlayerBattleSave(record.saveDir);
    return { outcome: "success" as const, value, diagnostics: [] };
  });
