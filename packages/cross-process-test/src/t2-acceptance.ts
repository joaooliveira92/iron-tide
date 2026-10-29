import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { BattleManifest } from "@bluewave/combat";
import {
  createPlayerBattleSession,
  playerBattleResult,
  playerBattleSessionHash,
  playerBattleView,
  runPlayerBattleToEnd,
  type AutoResolverNation,
} from "@bluewave/combat/battleResolution";
import { battleOffersFromRulesets } from "@bluewave/content-compiler";
import type { BattleOfferRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  makeRecordedInput,
  type BattleRequest,
  type BattleResultInput,
  type OfferRequest,
  type RecordedInput,
  type SuspendedTurn,
} from "@bluewave/messages";
import { unifiedSnapshotHash, MonthExecutor, type MonthResult } from "@bluewave/phase-engine";

import { compileProductionCampaign } from "./production-pack.js";

const PLAYER = "uk";
const ENEMY = "france";
const AREA = "eng_home_coast";
const TURN = "t2-acceptance-turn";
const SEED = "t2-acceptance-seed";

export interface T2Observation {
  readonly battle: {
    readonly endReason: string | null;
    readonly minutes: number;
    readonly winnerId: string | null;
    readonly loserId: string | null;
    readonly attackerLosses: readonly string[];
    readonly defenderLosses: readonly string[];
    readonly damageReport: Readonly<Record<string, number>>;
    readonly objectives: readonly string[];
    readonly playerDivisions: number;
    readonly enemyDivisions: number;
    readonly sessionHash: string;
  };
  readonly submitted: {
    readonly outcome: string;
    readonly snapshotHash: string;
    readonly eventsHash: string;
    readonly randomHash: string;
    readonly battlePhase: string;
    readonly explanation: string[];
    readonly warScores: readonly (readonly number[])[];
  };
}

function armed(snapshot: CampaignSnapshot, nationId: string): NationState["fleets"] {
  const nation = snapshot.nations.get(nationId)!;
  const ships = nation.fleets
    .flatMap((fleet) => fleet.ships)
    .slice(0, 2)
    .map((ship) => ({
      ...ship,
      locationAreaId: AREA,
      firepower: SafeInt(200),
      hitPoints: ship.maxHitPoints,
      isUnderConstruction: false,
      readiness: "ACTIVE" as const,
      crewQuality: SafeInt(100),
      inBattleId: undefined,
    }));
  return [
    { id: `fleet-${nationId}`, nationId, name: `${nationId} fleet`, ships, locationAreaId: AREA },
  ];
}

function warSnapshot(base: CampaignSnapshot): CampaignSnapshot {
  const nations = new Map<string, NationState>(base.nations);
  for (const id of [PLAYER, ENEMY]) {
    nations.set(id, { ...nations.get(id)!, fleets: [...armed(base, id)] });
  }
  return {
    ...base,
    nations,
    wars: {
      ...base.wars,
      wars: [
        {
          id: "war_t2",
          attackerSideId: "side_a",
          defenderSideId: "side_d",
          attackerSideMembers: [PLAYER],
          defenderSideMembers: [ENEMY],
          attackerWarScore: 0,
          defenderWarScore: 0,
          attackerId: PLAYER,
          defenderId: ENEMY,
          startDate: "1880-01",
          status: "ACTIVE",
        },
      ],
      battles: [],
    },
  };
}

function offerOf(result: MonthResult): OfferRequest {
  const request = result.suspended?.request;
  if (request?.kind !== "offer") throw new Error(`expected an offer, got ${request?.kind}`);
  return request;
}

function battleOf(result: MonthResult): BattleRequest {
  const request = result.suspended?.request;
  if (request?.kind !== "battle") throw new Error(`expected a battle, got ${request?.kind}`);
  return request;
}

function answerOffer(request: OfferRequest): RecordedInput {
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "offer",
    interruptionId: request.interruptionId,
    payload: {
      interruptionId: request.interruptionId,
      battleId: request.battleId,
      response: "accept",
    },
  });
}

function answerBattle(request: BattleRequest, result: BattleResultInput): RecordedInput {
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "battle",
    interruptionId: request.interruptionId,
    payload: result,
  });
}

function nationOf(snapshot: CampaignSnapshot, nationId: string): AutoResolverNation {
  const nation = snapshot.nations.get(nationId);
  if (nation === undefined) throw new Error(`missing nation ${nationId}`);
  return {
    nationId,
    ships: nation.fleets.flatMap((fleet) => fleet.ships),
    designs: snapshot.designs,
    divisions: nation.divisions,
    officers: nation.officers,
  };
}

export function runT2Acceptance(): T2Observation {
  const { state, bundle } = compileProductionCampaign();
  const rules = battleOffersFromRulesets(bundle.rulesets) as BattleOfferRules;
  const execute = (snapshot: CampaignSnapshot, inputs: readonly RecordedInput[]): MonthResult =>
    new MonthExecutor().execute(snapshot, [], SEED, new DiagnosticCollector(), undefined, {
      battleOffers: rules,
      playerNationId: PLAYER,
      interruptions: { turnId: TURN, recordedInputs: inputs },
    });

  const snapshot = warSnapshot(state.snapshot);
  const offer = offerOf(execute(snapshot, []));
  const accepted = execute(snapshot, [answerOffer(offer)]);
  const battle = battleOf(accepted);
  const suspended: CampaignSnapshot = accepted.finalSnapshot;
  const manifest = (suspended.wars.battleManifests ?? []).find(
    (candidate) => candidate.battleId === battle.battleId,
  );
  if (manifest === undefined) throw new Error("missing manifest at the battle suspension");
  const strategicWeather = suspended.strategicWeather.find(
    (candidate) => candidate.areaId === manifest.areaId,
  );
  if (strategicWeather === undefined) throw new Error("missing strategic weather");

  const session = createPlayerBattleSession({
    manifest: manifest as BattleManifest,
    areaId: manifest.areaId,
    campaignMonth: "1880-01",
    attacker: nationOf(suspended, manifest.attackerId),
    defender: nationOf(suspended, manifest.defenderId),
    playerNationId: PLAYER,
    strategicWeather,
    campaignSeed: `${SEED}:month:0`,
    rulesetVersion: suspended.rulesetVersion,
    formulaVersion: manifest.formulaVersion,
    rngVersion: manifest.rngVersion,
  });
  const finished = runPlayerBattleToEnd(session, { divisions: {} });
  const result = playerBattleResult(finished);
  const view = playerBattleView(finished);

  const payload: BattleResultInput = {
    interruptionId: battle.interruptionId,
    battleId: session.battleId,
    winnerId: result.winnerId,
    loserId: result.loserId,
    attackerLosses: [...result.attackerLosses],
    defenderLosses: [...result.defenderLosses],
    damageReport: { ...result.damageReport },
  };
  const submitted = execute(snapshot, [answerOffer(offer), answerBattle(battle, payload)]);
  if (submitted.outcome !== "completed") {
    throw new Error(`player battle submission did not complete: ${submitted.outcome}`);
  }
  const resolved = submitted.finalSnapshot.wars.battles.find((b) => b.id === session.battleId);

  return {
    battle: {
      endReason: finished.endReason,
      minutes: finished.minute,
      winnerId: result.winnerId,
      loserId: result.loserId,
      attackerLosses: [...result.attackerLosses],
      defenderLosses: [...result.defenderLosses],
      damageReport: { ...result.damageReport },
      objectives: [...view.objectives],
      playerDivisions: view.divisions.filter((d) => d.sideId === "ATTACKER").length,
      enemyDivisions: view.divisions.filter((d) => d.sideId === "DEFENDER").length,
      sessionHash: playerBattleSessionHash(finished),
    },
    submitted: {
      outcome: submitted.outcome,
      snapshotHash: unifiedSnapshotHash(submitted.finalSnapshot),
      eventsHash: submitted.eventLedger.hash(),
      randomHash: submitted.randomLedger.hash(),
      battlePhase: resolved?.phase ?? "missing",
      explanation: resolved?.result?.explanation ?? [],
      warScores: submitted.finalSnapshot.wars.wars.map((w) => [
        w.attackerWarScore,
        w.defenderWarScore,
      ]),
    },
  };
}

export type { SuspendedTurn };
