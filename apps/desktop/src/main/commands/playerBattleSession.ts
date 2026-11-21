import type { CampaignSnapshot } from "@bluewave/campaign";
import type { FleetManagementRules, GunneryRules, MissilesRules } from "@bluewave/content-schema";
import type { BattleManifest } from "@bluewave/combat";
import {
  advancePlayerBattleMinute,
  createPlayerBattleSession,
  divisionAiCheckpointOf,
  playerBattleResult,
  playerBattleSessionHash,
  restoreDivisionAiCheckpoint,
  runPlayerBattleToEnd,
  type AutoResolverNation,
  type PlayerBattleSession,
} from "@bluewave/combat/battleResolution";
import { isBluewaveError } from "@bluewave/contracts";
import {
  battleMinefieldsOf,
  battleTerrainOf,
  gunQualityRulesForBattle,
  trainingEffectsFor,
} from "@bluewave/phase-engine";
import type { ShipBuildingContent } from "@bluewave/ship-design";
import { Effect } from "effect";
import type {
  AdvancePlayerBattleResult,
  FinishPlayerBattleResult,
  PlayerBattleResultDto,
  StartPlayerBattleResult,
} from "../../shared/player-battle-contract.js";
import { toCombatOrders } from "../../shared/player-battle-orders.js";
import { BATTLE_VIEW_INVALID, boundaryBattleView } from "./battleViewBoundary.js";
import type { BattleMinefieldsByArea } from "../battleMinefields.js";
import type { BattleTerrainByArea } from "../battleTerrain.js";
import type { PlayerBattleSave, PlayerBattleStep } from "../playerBattleSidecar.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";
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

function replaySave(session: PlayerBattleSession, save: PlayerBattleSave): Replay {
  try {
    const replayed = save.steps.reduce(applyStep, session);
    return { kind: "replayed", session: restoreDivisionAiCheckpoint(replayed, save.divisionAi) };
  } catch {
    return { kind: "failed" };
  }
}

function nationOf(
  snapshot: CampaignSnapshot,
  nationId: string,
  designs: CampaignSnapshot["designs"],
  fleetManagement: FleetManagementRules | undefined,
): AutoResolverNation {
  const nation = snapshot.nations.get(nationId);
  if (nation === undefined) throw new Error(`No nation ${nationId} in the battle snapshot`);
  return {
    nationId,
    ships: nation.fleets.flatMap((fleet) => fleet.ships),
    designs,
    divisions: nation.divisions,
    officers: nation.officers,
    trainingEffects: trainingEffectsFor(nation, fleetManagement),
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
  fleetManagement?: FleetManagementRules,
  gunneryRules?: GunneryRules,
  missilesRules?: MissilesRules,
  shipBuilding?: ShipBuildingContent,
  terrain?: BattleTerrainByArea,
  minefields?: BattleMinefieldsByArea,
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
  const gunQuality = gunQualityRulesForBattle(
    shipBuilding,
    [manifest.attackerId, manifest.defenderId],
    pending.createdAt,
  );
  try {
    return createPlayerBattleSession({
      manifest: manifest as BattleManifest,
      areaId: manifest.areaId,
      campaignMonth: pending.createdAt,
      attacker: nationOf(snapshot, manifest.attackerId, snapshot.designs, fleetManagement),
      defender: nationOf(snapshot, manifest.defenderId, snapshot.designs, fleetManagement),
      playerNationId: pending.playerNationId,
      strategicWeather,
      campaignSeed,
      rulesetVersion: snapshot.rulesetVersion,
      formulaVersion: manifest.formulaVersion,
      rngVersion: manifest.rngVersion,
      ...(gunneryRules === undefined ? {} : { gunneryRadar: gunneryRules.radar }),
      ...(gunQuality === undefined ? {} : { gunQuality }),
      ...(missilesRules === undefined ? {} : { missilesRules }),
      ...battleTerrainOf(terrain, manifest.areaId),
      ...battleMinefieldsOf(minefields, manifest.areaId),
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

    const fleetManagement = yield* (yield* ContentArtifact).loadFleetManagementRules();
    const gunneryRules = yield* (yield* ContentArtifact).loadGunneryRules();
    const missilesRules = yield* (yield* ContentArtifact).loadMissilesRules();
    const shipBuilding = yield* (yield* ContentArtifact).loadShipBuildingContent();
    const terrain = yield* (yield* ContentArtifact).loadBattleTerrain();
    const minefields = yield* (yield* ContentArtifact).loadBattleMinefields();
    const projected = projectSession(
      outcome.snapshot,
      input.battleId,
      `${record.campaignSeed}:month:${String(pending.startingRevision)}`,
      pending,
      fleetManagement,
      gunneryRules,
      missilesRules,
      shipBuilding,
      terrain,
      minefields,
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
      const replay = replaySave(projected, loaded.save);
      if (replay.kind === "replayed") {
        session = replay.session;
        steps = loaded.save.steps;
        resume = "resumed";
      } else {
        resume = "resume-failed";
        yield* battleSaves.clear(record.saveDir);
      }
    }

    const boundary = boundaryBattleView(session, steps.at(-1));
    if (boundary.kind === "invalid") {
      return refuse(BATTLE_VIEW_INVALID, ...boundary.diagnostics);
    }
    yield* (yield* PlayerBattleRegistry).put(input.sessionId, input.battleId, { session, steps });
    const value: StartPlayerBattleResult = {
      sessionHash: playerBattleSessionHash(session),
      battleView: boundary.view,
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
    const boundary = boundaryBattleView(next, input.step);
    if (boundary.kind === "invalid") {
      return refuse(BATTLE_VIEW_INVALID, ...boundary.diagnostics);
    }
    const steps = [...live.steps, input.step];
    yield* registry.put(input.sessionId, input.battleId, { session: next, steps });
    const pending = yield* (yield* PendingTurnStore).load(record.saveDir);
    if (pending !== null) {
      yield* (yield* PlayerBattleStore).save(record.saveDir, {
        schemaVersion: "1.1.0",
        turnId: pending.turnId,
        battleId: input.battleId,
        steps,
        divisionAi: divisionAiCheckpointOf(next),
      });
    }
    const value: AdvancePlayerBattleResult = {
      sessionHash: playerBattleSessionHash(next),
      battleView: boundary.view,
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
