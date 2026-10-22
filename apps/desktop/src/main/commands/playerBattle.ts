import type { CampaignSnapshot } from "@bluewave/campaign";
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
} from "@bluewave/combat";
import type { TacticalBattleManifest } from "@bluewave/combat";
import { Effect, Schema } from "effect";
import type {
  AdvancePlayerBattleResult,
  FinishPlayerBattleResult,
  PlayerBattleResultDto,
  StartPlayerBattleResult,
} from "../../shared/campaign-command-contract.js";
import { loadPendingTurn } from "../pendingTurn.js";
import { withStrictSchema } from "../runtime/commandProgram.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { DecisionSource } from "../runtime/decisionSource.js";
import { runTurnTransaction } from "./turnTransaction.js";

const nonEmpty = Schema.String.check(Schema.isMinLength(1));

const StartPayloadSchema = Schema.Struct({
  sessionId: nonEmpty,
  battleId: nonEmpty,
});

const DivisionOrderSchema = Schema.Struct({
  divisionId: nonEmpty,
  stance: Schema.Literals(["ENGAGE", "HOLD", "WITHDRAW"]),
  speedPercent: Schema.Finite.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(100),
  ),
});

const AdvancePayloadSchema = Schema.Struct({
  sessionId: nonEmpty,
  battleId: nonEmpty,
  mode: Schema.Literals(["minute", "to_end"]),
  divisions: Schema.Array(DivisionOrderSchema),
});

const FinishPayloadSchema = Schema.Struct({
  sessionId: nonEmpty,
  battleId: nonEmpty,
});

/**
 * Process-local player-battle sessions. They are NOT authoritative and never
 * persisted: the pending turn remains the source of truth, so restarting the app
 * re-creates the battle from the recorded offer answer. Keyed by session+battle.
 */
const sessions = new Map<string, PlayerBattleSession>();

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
    out[order.divisionId] = { stance: order.stance, speedPercent: order.speedPercent };
  }
  return { divisions: out };
}

/**
 * T-2 (issue #221): start the player-fought battle for the outstanding battle
 * request. Re-executes the suspended month (deterministically) to recover the
 * committed manifest/weather/reservations at the suspension point, then projects
 * the same tactical battle the auto-resolver would have fought.
 */
export const startPlayerBattleProgram = withStrictSchema(StartPayloadSchema, (payload) =>
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
        manifest: manifest as TacticalBattleManifest,
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

    sessions.set(keyOf(payload.sessionId, payload.battleId), session);
    const value: StartPlayerBattleResult = {
      sessionHash: playerBattleSessionHash(session),
      view: playerBattleView(session),
    };
    return { outcome: "success" as const, value, diagnostics: [] };
  }),
);

export const advancePlayerBattleProgram = withStrictSchema(AdvancePayloadSchema, (payload) =>
  Effect.sync(() => {
    const session = sessions.get(keyOf(payload.sessionId, payload.battleId));
    if (session === undefined) {
      return {
        outcome: "error" as const,
        reason: "PLAYER_BATTLE_NOT_STARTED",
        diagnostics: ["Start the player battle before advancing it"],
      };
    }
    const orders = ordersOf(payload.divisions);
    const next =
      payload.mode === "to_end"
        ? runPlayerBattleToEnd(session, orders)
        : advancePlayerBattleMinute(session, orders);
    sessions.set(keyOf(payload.sessionId, payload.battleId), next);
    const value: AdvancePlayerBattleResult = {
      sessionHash: playerBattleSessionHash(next),
      view: playerBattleView(next),
      result: next.ended ? toResultDto(next) : null,
    };
    return { outcome: "success" as const, value, diagnostics: [] };
  }),
);

export const finishPlayerBattleProgram = withStrictSchema(FinishPayloadSchema, (payload) =>
  Effect.sync(() => {
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
    return { outcome: "success" as const, value, diagnostics: [] };
  }),
);
