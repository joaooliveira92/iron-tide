import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { battleOffersFromRulesets } from "@bluewave/content-compiler";
import type { BattleOfferRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { makeRecordedInput, type OfferRequest, type OfferResponse } from "@bluewave/messages";
import { unifiedSnapshotHash, MonthExecutor, type MonthResult } from "@bluewave/phase-engine";

import { compileProductionCampaign } from "./production-pack.js";

const PLAYER = "uk";
const ENEMY = "france";
const ALLY = "italy";
const AREA = "eng_home_coast";
const TURN = "t-1-10-acceptance-turn";

const SEED = "production-offer-seed";
const ENEMY_WITHDRAWS_SEED = "seed-0";
const ENEMY_PROCEEDS_SEED = "seed-2";
const SUPPORT_PRESENT_SEED = "seed-0";
const SUPPORT_ABSENT_SEED = "seed-1";

export interface RunHashes {
  readonly snapshot: string;
  readonly events: string;
  readonly random: string;
}

export interface T1Observation {
  readonly section: {
    readonly estimateKind: string;
    readonly errorBoundBp: number;
    readonly showComposition: boolean;
    readonly pointsByMission: Readonly<Record<string, number>>;
    readonly opponentCredit: string;
    readonly threshold: number;
    readonly scope: string;
    readonly reset: string;
    readonly enemyThresholdBp: number;
    readonly enemyProbabilityBp: number;
    readonly supportChanceBp: number;
    readonly supportShareOfCapBp: number;
    readonly supportSource: string;
    readonly prestigeRule: string;
    readonly prestigeBasisPoints: number;
    readonly prestigeRepeat: string;
    readonly provenanceStatus: string;
    readonly provenanceKind: string;
  };
  readonly offer: {
    readonly missionType: string;
    readonly acceptanceClass: string;
    readonly areaId: string;
    readonly estimateModel: string;
    readonly hasComposition: boolean;
    readonly estimateDraws: number;
    readonly supportForcePresent: boolean;
    readonly leaksEnemyIdentity: boolean;
    readonly reExecutionIdentical: boolean;
  };
  readonly accept: {
    readonly outcome: string | undefined;
    readonly battleRequested: boolean;
    readonly scores: readonly (readonly number[])[];
    readonly hashes: RunHashes;
  };
  readonly delegate: {
    readonly outcome: string | undefined;
    readonly scores: readonly (readonly number[])[];
    readonly sameAsAccept: boolean;
  };
  readonly decline: {
    readonly outcome: string | undefined;
    readonly scores: readonly (readonly number[])[];
    readonly declinedRecords: number;
    readonly declinedEvents: number;
    readonly battlesResolved: number;
    readonly hashes: RunHashes;
  };
  readonly unavoidable: {
    readonly outcome: string | undefined;
    readonly refusalTag: string;
    readonly scores: readonly (readonly number[])[];
    readonly declinedRecords: number;
  };
  readonly enemyDecline: {
    readonly withdrewOutcome: string | undefined;
    readonly withdrewEvents: number;
    readonly withdrewDraws: number;
    readonly withdrewBattles: number;
    readonly withdrewScores: readonly (readonly number[])[];
    readonly proceedsOffer: boolean;
    readonly proceedsEvents: number;
    readonly evenMatchDraws: number;
    readonly hashes: RunHashes;
  };
  readonly support: {
    readonly presentNations: readonly string[];
    readonly presentFlag: boolean;
    readonly absentFlag: boolean;
    readonly presentDraws: number;
    readonly noAllyDraws: number;
    readonly hashes: RunHashes;
  };
  readonly threshold: {
    readonly thresholdEvents: readonly number[];
    readonly counts: readonly number[];
    readonly prestigeStart: number;
    readonly prestigeAfter: readonly number[];
    readonly prestigeEvents: readonly number[];
    readonly finalHash: string;
  };
  readonly peacetime: {
    readonly identicalWithAndWithoutSection: boolean;
    readonly hashes: RunHashes;
  };
}

function armed(
  snapshot: CampaignSnapshot,
  nationId: string,
  firepower: number,
): readonly NationState["fleets"][number][] {
  const nation = snapshot.nations.get(nationId)!;
  const ships = nation.fleets
    .flatMap((fleet) => fleet.ships)
    .slice(0, 2)
    .map((ship) => ({
      ...ship,
      locationAreaId: AREA,
      firepower: SafeInt(firepower),
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

function warSnapshot(
  base: CampaignSnapshot,
  firepower: { readonly player: number; readonly enemy: number } = { player: 200, enemy: 200 },
): CampaignSnapshot {
  const nations = new Map<string, NationState>(base.nations);
  for (const [id, power] of [
    [PLAYER, firepower.player],
    [ENEMY, firepower.enemy],
  ] as const) {
    nations.set(id, { ...nations.get(id)!, fleets: [...armed(base, id, power)] });
  }
  return {
    ...base,
    nations,
    wars: {
      ...base.wars,
      wars: [
        {
          id: "war_offer",
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

function withAlly(snapshot: CampaignSnapshot): CampaignSnapshot {
  const nations = new Map<string, NationState>(snapshot.nations);
  nations.set(ALLY, { ...nations.get(ALLY)!, fleets: [...armed(snapshot, ALLY, 100)] });
  return {
    ...snapshot,
    nations,
    politics: {
      ...snapshot.politics,
      relations: [
        ...snapshot.politics.relations.filter(
          (r) =>
            !(
              (r.nationA === PLAYER && r.nationB === ALLY) ||
              (r.nationA === ALLY && r.nationB === PLAYER)
            ),
        ),
        {
          nationA: PLAYER,
          nationB: ALLY,
          relation: "allied" as const,
          tension: 0,
          nap: false,
          since: "1880-01",
        },
      ],
    },
  };
}

function offerOf(result: MonthResult): OfferRequest {
  const request = result.suspended?.request;
  if (request?.kind !== "offer") throw new Error(`expected an offer, got ${request?.kind}`);
  return request;
}

const hashesOf = (result: MonthResult): RunHashes => ({
  snapshot: unifiedSnapshotHash(result.finalSnapshot),
  events: result.eventLedger.hash(),
  random: result.randomLedger.hash(),
});
function leaks(text: string, result: MonthResult): boolean {
  const manifest = result.finalSnapshot.wars.battleManifests?.[0];
  if (manifest === undefined) throw new Error("expected a generated manifest");
  const enemyShips = result.finalSnapshot.nations
    .get(ENEMY)!
    .fleets.flatMap((fleet) => fleet.ships.map((ship) => ship.id));
  return [manifest.battleSeed, manifest.manifestHash, "inputHash", ...enemyShips].some((secret) =>
    text.includes(secret),
  );
}
const bodies = (result: MonthResult, kind: string) =>
  result.eventLedger.all.filter((e) => e.body.kind === kind).map((e) => e.body);
const scores = (result: MonthResult) =>
  result.finalSnapshot.wars.wars.map((w) => [w.attackerWarScore, w.defenderWarScore]);
const draws = (result: MonthResult, streamId: string) =>
  result.randomLedger.all.filter((d) => d.streamId === streamId).length;

export function runT1Acceptance(): T1Observation {
  const { state, bundle } = compileProductionCampaign();
  const rules = battleOffersFromRulesets(bundle.rulesets) as BattleOfferRules;

  const answer = (request: OfferRequest, response: OfferResponse) =>
    makeRecordedInput({
      ordinal: request.ordinal,
      kind: "offer",
      interruptionId: request.interruptionId,
      payload: { interruptionId: request.interruptionId, battleId: request.battleId, response },
    });
  const run = (
    snapshot: CampaignSnapshot,
    seed: string,
    request?: OfferRequest,
    response?: OfferResponse,
  ): MonthResult =>
    new MonthExecutor().execute(snapshot, [], seed, new DiagnosticCollector(), undefined, {
      battleOffers: rules,
      playerNationId: PLAYER,
      interruptions: {
        turnId: TURN,
        recordedInputs: request && response ? [answer(request, response)] : [],
      },
    });

  const snapshot = warSnapshot(state.snapshot);
  const first = run(snapshot, SEED);
  const request = offerOf(first);
  const again = offerOf(run(snapshot, SEED));
  const serialized = JSON.stringify(request);

  const accepted = run(snapshot, SEED, request, "accept");
  const delegated = run(snapshot, SEED, request, "delegate");
  const declined = run(snapshot, SEED, request, "decline");

  const suspended = first.finalSnapshot;
  const unavoidableSnapshot: CampaignSnapshot = {
    ...suspended,
    wars: {
      ...suspended.wars,
      battleManifests: (suspended.wars.battleManifests ?? []).map((m) => ({
        ...m,
        acceptanceClass: "OPERATIONALLY_UNAVOIDABLE",
      })),
    },
  };
  const unavoidableRequest = offerOf(run(unavoidableSnapshot, SEED));
  const refused = run(unavoidableSnapshot, SEED, unavoidableRequest, "decline");

  const lopsided = warSnapshot(state.snapshot, { player: 400, enemy: 155 });
  const withdrew = run(lopsided, ENEMY_WITHDRAWS_SEED);
  const proceeds = run(lopsided, ENEMY_PROCEEDS_SEED);

  const supported = withAlly(snapshot);
  const present = run(supported, SUPPORT_PRESENT_SEED);
  const presentRequest = offerOf(present);
  const absentRequest = offerOf(run(supported, SUPPORT_ABSENT_SEED));
  const supportedAccepted = run(supported, SUPPORT_PRESENT_SEED, presentRequest, "accept");

  let current = snapshot;
  const thresholdEvents: number[] = [];
  const counts: number[] = [];
  const prestigeAfter: number[] = [];
  const prestigeEvents: number[] = [];
  let finalHash = "";
  for (let month = 1; month <= 4; month += 1) {
    const monthRequest = offerOf(run(current, SEED));
    const result = run(current, SEED, monthRequest, "decline");
    thresholdEvents.push(bodies(result, "DeclineThresholdReached").length);
    prestigeEvents.push(bodies(result, "PrestigeChanged").length);
    const after = result.finalSnapshot.wars.declineCounters ?? [];
    counts.push(after.reduce((sum, entry) => sum + (entry.count as number), 0));
    prestigeAfter.push(result.finalSnapshot.nations.get(PLAYER)!.prestige as number);
    finalHash = unifiedSnapshotHash(result.finalSnapshot);
    const nations = new Map(current.nations);
    nations.set(PLAYER, {
      ...nations.get(PLAYER)!,
      prestige: result.finalSnapshot.nations.get(PLAYER)!.prestige,
    });
    current = { ...current, nations, wars: { ...current.wars, declineCounters: after } };
  }

  const peace = state.snapshot;
  const peaceWith = new MonthExecutor().execute(
    peace,
    [],
    "peace-seed",
    new DiagnosticCollector(),
    undefined,
    {
      battleOffers: rules,
      playerNationId: PLAYER,
    },
  );
  const peaceWithout = new MonthExecutor().execute(
    peace,
    [],
    "peace-seed",
    new DiagnosticCollector(),
  );

  const prestige = rules.declinedBattlePrestige;
  return {
    section: {
      estimateKind: rules.estimateModel.kind,
      errorBoundBp: (rules.estimateModel as { errorBoundBp: number }).errorBoundBp,
      showComposition: (rules.estimateModel as { showComposition: boolean }).showComposition,
      pointsByMission: { ...rules.declineVictoryPoints.pointsByMission },
      opponentCredit: rules.declineVictoryPoints.opponentCredit.kind,
      threshold: rules.declineCounter.threshold,
      scope: rules.declineCounter.scope,
      reset: rules.declineCounter.reset.kind,
      enemyThresholdBp: rules.enemyDecline.thresholdBp,
      enemyProbabilityBp: rules.enemyDecline.probabilityBp,
      supportChanceBp: rules.supportForce.presenceChanceBp,
      supportShareOfCapBp: rules.supportForce.shareOfCapBp,
      supportSource: rules.supportForce.source,
      prestigeRule: prestige?.rule.kind ?? "ABSENT",
      prestigeBasisPoints:
        prestige?.rule.kind === "PROPORTIONAL_LOSS" ? prestige.rule.basisPoints : 0,
      prestigeRepeat: prestige?.repeat ?? "ABSENT",
      provenanceStatus: rules.provenance.sourceStatus,
      provenanceKind: rules.provenance.kind,
    },
    offer: {
      missionType: request.missionType,
      acceptanceClass: request.acceptanceClass,
      areaId: request.areaId,
      estimateModel: request.estimate.model,
      hasComposition: "composition" in request.estimate,
      estimateDraws: draws(first, "battle-offer/estimate"),
      supportForcePresent: request.supportForcePresent,
      leaksEnemyIdentity: leaks(serialized, first),
      reExecutionIdentical: JSON.stringify(again) === serialized,
    },
    accept: {
      outcome: accepted.outcome,
      battleRequested: accepted.suspended?.request?.kind === "battle",
      scores: scores(accepted),
      hashes: hashesOf(accepted),
    },
    delegate: {
      outcome: delegated.outcome,
      scores: scores(delegated),
      sameAsAccept:
        unifiedSnapshotHash(delegated.finalSnapshot) ===
        unifiedSnapshotHash(accepted.finalSnapshot),
    },
    decline: {
      outcome: declined.outcome,
      scores: scores(declined),
      declinedRecords: declined.finalSnapshot.wars.declinedBattles?.length ?? 0,
      declinedEvents: bodies(declined, "BattleDeclined").length,
      battlesResolved: bodies(declined, "BattleResolved").length,
      hashes: hashesOf(declined),
    },
    unavoidable: {
      outcome: refused.outcome,
      refusalTag: refused.suspended?.refusalTag ?? "NONE",
      scores: scores(refused),
      declinedRecords: refused.finalSnapshot.wars.declinedBattles?.length ?? 0,
    },
    enemyDecline: {
      withdrewOutcome: withdrew.outcome,
      withdrewEvents: bodies(withdrew, "EnemyDeclinedBattle").length,
      withdrewDraws: draws(withdrew, "battle-offer/enemy-decline"),
      withdrewBattles: withdrew.finalSnapshot.wars.battles.length,
      withdrewScores: scores(withdrew),
      proceedsOffer: proceeds.suspended?.request?.kind === "offer",
      proceedsEvents: bodies(proceeds, "EnemyDeclinedBattle").length,
      evenMatchDraws: draws(first, "battle-offer/enemy-decline"),
      hashes: hashesOf(withdrew),
    },
    support: {
      presentNations: [...(presentRequest.supportNationIds ?? [])],
      presentFlag: presentRequest.supportForcePresent,
      absentFlag: absentRequest.supportForcePresent,
      presentDraws: draws(present, "battle-offer/support-force"),
      noAllyDraws: draws(run(snapshot, SUPPORT_PRESENT_SEED), "battle-offer/support-force"),
      hashes: hashesOf(supportedAccepted),
    },
    threshold: {
      thresholdEvents,
      counts,
      prestigeStart: snapshot.nations.get(PLAYER)!.prestige as number,
      prestigeAfter,
      prestigeEvents,
      finalHash,
    },
    peacetime: {
      identicalWithAndWithoutSection:
        unifiedSnapshotHash(peaceWith.finalSnapshot) ===
          unifiedSnapshotHash(peaceWithout.finalSnapshot) &&
        peaceWith.eventLedger.hash() === peaceWithout.eventLedger.hash() &&
        peaceWith.randomLedger.hash() === peaceWithout.randomLedger.hash(),
      hashes: hashesOf(peaceWith),
    },
  };
}
