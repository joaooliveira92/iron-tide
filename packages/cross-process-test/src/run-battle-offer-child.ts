import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { makeRecordedInput, type OfferRequest, type OfferResponse } from "@bluewave/messages";
import { hashSnapshot, MonthExecutor, type MonthResult } from "@bluewave/phase-engine";
import { FIXTURE_BATTLE_OFFER_RULES } from "@bluewave/test-support";

import { compileProductionCampaign } from "./production-pack.js";

const PLAYER = "uk";
const ENEMY = "france";
const AREA = "eng_home_coast";
const SEED = "battle-offer-cross-process-seed";
const TURN = "battle-offer-cross-process-turn";

function warSnapshot(
  base: CampaignSnapshot,
  firepower: { readonly player: number; readonly enemy: number } = { player: 200, enemy: 200 },
): CampaignSnapshot {
  const nations = new Map<string, NationState>(base.nations);
  for (const id of [PLAYER, ENEMY]) {
    const nation = nations.get(id)!;
    const ships = nation.fleets
      .flatMap((fleet) => fleet.ships)
      .slice(0, 2)
      .map((ship) => ({
        ...ship,
        locationAreaId: AREA,
        firepower: SafeInt(id === PLAYER ? firepower.player : firepower.enemy),
        hitPoints: ship.maxHitPoints,
        isUnderConstruction: false,
        readiness: "ACTIVE" as const,
        crewQuality: SafeInt(100),
      }));
    nations.set(id, {
      ...nation,
      fleets: [
        { id: `fleet-${id}`, nationId: id, name: `${id} fleet`, ships, locationAreaId: AREA },
      ],
    });
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

function run(
  snapshot: CampaignSnapshot,
  options: { offers: boolean; channel: boolean; response?: OfferRequest },
  answerWith?: OfferResponse,
): MonthResult {
  const inputs =
    options.response === undefined || answerWith === undefined
      ? []
      : [
          makeRecordedInput({
            ordinal: options.response.ordinal,
            kind: "offer",
            interruptionId: options.response.interruptionId,
            payload: {
              interruptionId: options.response.interruptionId,
              battleId: options.response.battleId,
              response: answerWith,
            },
          }),
        ];
  return new MonthExecutor().execute(snapshot, [], SEED, new DiagnosticCollector(), undefined, {
    ...(options.offers ? { battleOffers: FIXTURE_BATTLE_OFFER_RULES, playerNationId: PLAYER } : {}),
    ...(options.channel ? { interruptions: { turnId: TURN, recordedInputs: inputs } } : {}),
  });
}

function offerOf(result: MonthResult): OfferRequest {
  const request = result.suspended?.request;
  if (request?.kind !== "offer") throw new Error("expected the month to suspend at an offer");
  return request;
}

function runChild(): void {
  try {
    const { state } = compileProductionCampaign();
    const snapshot = warSnapshot(state.snapshot);

    const dormant = run(snapshot, { offers: false, channel: false });
    const nonOffered = run(snapshot, { offers: true, channel: false });

    const suspended = run(snapshot, { offers: true, channel: true });
    const request = offerOf(suspended);
    const reExecuted = offerOf(run(snapshot, { offers: true, channel: true }));
    const accepted = run(snapshot, { offers: true, channel: true, response: request }, "accept");
    const delegated = run(snapshot, { offers: true, channel: true, response: request }, "delegate");
    const declined = run(snapshot, { offers: true, channel: true, response: request }, "decline");
    const declinedAgain = run(
      snapshot,
      { offers: true, channel: true, response: request },
      "decline",
    );

    const seeded: typeof snapshot = {
      ...snapshot,
      wars: {
        ...snapshot.wars,
        declineCounters: declined.finalSnapshot.wars.declineCounters ?? [],
      },
    };
    const secondRequest = offerOf(run(seeded, { offers: true, channel: true }));
    const second = run(seeded, { offers: true, channel: true, response: secondRequest }, "decline");
    const secondAgain = run(
      seeded,
      { offers: true, channel: true, response: secondRequest },
      "decline",
    );
    const thresholdEvents = (result: MonthResult) =>
      result.eventLedger.all.filter((e) => e.body.kind === "DeclineThresholdReached");

    const prestigeRules = {
      ...FIXTURE_BATTLE_OFFER_RULES,
      declinedBattlePrestige: {
        rule: { kind: "FIXED_LOSS", amount: 3 },
        repeat: "ONCE_AT_THRESHOLD",
      },
    } as const;
    const withPrestige = (): MonthResult =>
      new MonthExecutor().execute(seeded, [], SEED, new DiagnosticCollector(), undefined, {
        battleOffers: prestigeRules,
        playerNationId: PLAYER,
        interruptions: {
          turnId: TURN,
          recordedInputs: [
            makeRecordedInput({
              ordinal: secondRequest.ordinal,
              kind: "offer",
              interruptionId: secondRequest.interruptionId,
              payload: {
                interruptionId: secondRequest.interruptionId,
                battleId: secondRequest.battleId,
                response: "decline",
              },
            }),
          ],
        },
      });
    const costed = withPrestige();
    const costedAgain = withPrestige();
    const prestigeEvents = (result: MonthResult) =>
      result.eventLedger.all.filter((e) => e.body.kind === "PrestigeChanged").map((e) => e.body);

    const enemyShipIds = snapshot.nations
      .get(ENEMY)!
      .fleets.flatMap((f) => f.ships)
      .map((ship) => ship.id);
    const requestText = JSON.stringify(request);
    const draws = accepted.randomLedger.all.filter((d) => d.streamId.startsWith("battle-offer"));

    const lopsided = warSnapshot(state.snapshot, { player: 400, enemy: 155 });
    const withRules = (probabilityBp: number, snap: typeof snapshot): MonthResult =>
      new MonthExecutor().execute(snap, [], SEED, new DiagnosticCollector(), undefined, {
        battleOffers: {
          ...FIXTURE_BATTLE_OFFER_RULES,
          enemyDecline: { ...FIXTURE_BATTLE_OFFER_RULES.enemyDecline, probabilityBp },
        },
        playerNationId: PLAYER,
        interruptions: { turnId: TURN, recordedInputs: [] },
      });
    const enemyDeclined = withRules(10_000, lopsided);
    const enemyDeclinedAgain = withRules(10_000, lopsided);
    const enemyProceeds = withRules(0, lopsided);
    const enemyStream = (result: MonthResult) =>
      result.randomLedger.all.filter((d) => d.streamId === "battle-offer/enemy-decline");
    const withdrawals = (result: MonthResult) =>
      result.eventLedger.all.filter((e) => e.body.kind === "EnemyDeclinedBattle");

    const ally = "italy";
    const baseNations = new Map<string, NationState>(snapshot.nations);
    const italy = baseNations.get(ally)!;
    baseNations.set(ally, {
      ...italy,
      fleets: [
        {
          id: `fleet-${ally}`,
          nationId: ally,
          name: `${ally} fleet`,
          locationAreaId: AREA,
          ships: italy.fleets
            .flatMap((fleet) => fleet.ships)
            .slice(0, 2)
            .map((ship) => ({
              ...ship,
              locationAreaId: AREA,
              firepower: SafeInt(100),
              hitPoints: ship.maxHitPoints,
              isUnderConstruction: false,
              readiness: "ACTIVE" as const,
              crewQuality: SafeInt(100),
              inBattleId: undefined,
            })),
        },
      ],
    });
    const supported: typeof snapshot = {
      ...snapshot,
      nations: baseNations,
      politics: {
        ...snapshot.politics,
        relations: [
          ...snapshot.politics.relations.filter(
            (r) =>
              !(
                (r.nationA === PLAYER && r.nationB === ally) ||
                (r.nationA === ally && r.nationB === PLAYER)
              ),
          ),
          {
            nationA: PLAYER,
            nationB: ally,
            relation: "allied" as const,
            tension: 0,
            nap: false,
            since: "1880-01",
          },
        ],
      },
    };
    const withSupport = (
      chanceBp: number,
      snap: typeof snapshot,
      response?: OfferRequest,
      answer?: OfferResponse,
    ) =>
      new MonthExecutor().execute(snap, [], SEED, new DiagnosticCollector(), undefined, {
        battleOffers: {
          ...FIXTURE_BATTLE_OFFER_RULES,
          enemyDecline: { comparison: "LESS_THAN", thresholdBp: 0, probabilityBp: 0 },
          supportForce: { ...FIXTURE_BATTLE_OFFER_RULES.supportForce, presenceChanceBp: chanceBp },
        },
        playerNationId: PLAYER,
        interruptions: {
          turnId: TURN,
          recordedInputs:
            response === undefined || answer === undefined
              ? []
              : [
                  makeRecordedInput({
                    ordinal: response.ordinal,
                    kind: "offer",
                    interruptionId: response.interruptionId,
                    payload: {
                      interruptionId: response.interruptionId,
                      battleId: response.battleId,
                      response: answer,
                    },
                  }),
                ],
        },
      });
    const supportStream = (result: MonthResult) =>
      result.randomLedger.all.filter((d) => d.streamId === "battle-offer/support-force");
    const present = withSupport(10_000, supported);
    const presentAgain = withSupport(10_000, supported);
    const presentRequest = offerOf(present);
    const presentDeclined = withSupport(10_000, supported, presentRequest, "decline");
    const presentAccepted = withSupport(10_000, supported, presentRequest, "accept");
    const absent = withSupport(0, supported);
    const noCandidates = withSupport(10_000, snapshot);
    const allyShips = (result: MonthResult) =>
      result.finalSnapshot.nations.get(ally)!.fleets.flatMap((f) => f.ships);
    const supportManifest = present.finalSnapshot.wars.battleManifests?.[0];

    const output = {
      support: {
        outcome: present.outcome,
        requestFlag: presentRequest.supportForcePresent,
        requestNations: presentRequest.supportNationIds ?? null,
        requestLeaksAllyShip: allyShips(present).some((ship) =>
          JSON.stringify(presentRequest).includes(`"${ship.id}"`),
        ),
        draws: supportStream(present),
        temporaryAssets: supportManifest?.temporaryAssets ?? [],
        persistentAssets: supportManifest?.persistentAssets ?? [],
        playerSideParticipants:
          supportManifest?.sides.find((side) => side.sideId === "ATTACKER")?.participantIds ?? [],
        manifestHash: supportManifest?.manifestHash ?? "",
        battleSeed: supportManifest?.battleSeed ?? "",
        inProcessEqual:
          hashSnapshot(present.finalSnapshot) === hashSnapshot(presentAgain.finalSnapshot) &&
          present.randomLedger.hash() === presentAgain.randomLedger.hash(),
        randomLedgerHash: present.randomLedger.hash(),
        declinedAllyReserved: allyShips(presentDeclined).filter((s) => s.inBattleId !== undefined)
          .length,
        declinedAllyUndamaged: allyShips(presentDeclined).every(
          (s) => s.hitPoints === s.maxHitPoints,
        ),
        declinedSnapshotHash: hashSnapshot(presentDeclined.finalSnapshot),
        acceptedOutcome: presentAccepted.outcome,
        acceptedAllyReserved: allyShips(presentAccepted).filter((s) => s.inBattleId !== undefined)
          .length,
        acceptedAllyUndamaged: allyShips(presentAccepted).every(
          (s) => s.hitPoints === s.maxHitPoints,
        ),
        acceptedSnapshotHash: hashSnapshot(presentAccepted.finalSnapshot),
        absentDraws: supportStream(absent),
        absentFlag: offerOf(absent).supportForcePresent,
        noCandidateDraws: supportStream(noCandidates).length,
        noCandidateFlag: offerOf(noCandidates).supportForcePresent,
      },
      enemyDeclined: {
        outcome: enemyDeclined.outcome,
        battles: enemyDeclined.finalSnapshot.wars.battles.length,
        manifests: (enemyDeclined.finalSnapshot.wars.battleManifests ?? []).length,
        reservedShips: [...enemyDeclined.finalSnapshot.nations.values()]
          .flatMap((n) => n.fleets.flatMap((f) => f.ships))
          .filter((ship) => ship.inBattleId !== undefined).length,
        withdrawals: withdrawals(enemyDeclined).length,
        draws: enemyStream(enemyDeclined),
        snapshotHash: hashSnapshot(enemyDeclined.finalSnapshot),
        eventLedgerHash: enemyDeclined.eventLedger.hash(),
        randomLedgerHash: enemyDeclined.randomLedger.hash(),
        inProcessEqual:
          hashSnapshot(enemyDeclined.finalSnapshot) ===
            hashSnapshot(enemyDeclinedAgain.finalSnapshot) &&
          enemyDeclined.randomLedger.hash() === enemyDeclinedAgain.randomLedger.hash(),
        proceedsOutcome: enemyProceeds.outcome,
        proceedsRequestKind: enemyProceeds.suspended?.request?.kind ?? null,
        proceedsDraws: enemyStream(enemyProceeds),
        proceedsWithdrawals: withdrawals(enemyProceeds).length,
        proceedsRandomLedgerHash: enemyProceeds.randomLedger.hash(),
      },
      success:
        dormant.success &&
        nonOffered.success &&
        accepted.success &&
        delegated.success &&
        declined.success,
      request,
      requestReExecutedEqual: canonicalSerialize(reExecuted) === canonicalSerialize(request),
      requestLeaksEnemyShip: enemyShipIds.some((id) => requestText.includes(`"${id}"`)),
      dormantSnapshotHash: hashSnapshot(dormant.finalSnapshot),
      nonOfferedSnapshotHash: hashSnapshot(nonOffered.finalSnapshot),
      acceptedSnapshotHash: hashSnapshot(accepted.finalSnapshot),
      delegatedSnapshotHash: hashSnapshot(delegated.finalSnapshot),
      acceptedOutcome: accepted.outcome,
      acceptedBattleKind: accepted.suspended?.request?.kind ?? null,
      delegatedOutcome: delegated.outcome,
      acceptedWars: sha256Hex(canonicalSerialize(accepted.finalSnapshot.wars.wars)),
      nonOfferedWars: sha256Hex(canonicalSerialize(nonOffered.finalSnapshot.wars.wars)),
      acceptedRandomLedgerHash: accepted.randomLedger.hash(),
      acceptedEventLedgerHash: accepted.eventLedger.hash(),
      delegatedEventLedgerHash: delegated.eventLedger.hash(),
      dormantRandomLedgerHash: dormant.randomLedger.hash(),
      nonOfferedRandomLedgerHash: nonOffered.randomLedger.hash(),
      draws,
      declinedOutcome: declined.outcome,
      declinedSnapshotHash: hashSnapshot(declined.finalSnapshot),
      declinedInProcessEqual:
        hashSnapshot(declined.finalSnapshot) === hashSnapshot(declinedAgain.finalSnapshot) &&
        declined.eventLedger.hash() === declinedAgain.eventLedger.hash() &&
        declined.randomLedger.hash() === declinedAgain.randomLedger.hash(),
      declinedRecords: declined.finalSnapshot.wars.declinedBattles ?? [],
      declinedBattlePhases: declined.finalSnapshot.wars.battles.map((b) => b.phase),
      declinedWarScores: declined.finalSnapshot.wars.wars.map((w) => [
        w.attackerWarScore,
        w.defenderWarScore,
      ]),
      declinedReservedShips: [...declined.finalSnapshot.nations.values()]
        .flatMap((n) => n.fleets.flatMap((f) => f.ships))
        .filter((ship) => ship.inBattleId !== undefined).length,
      declinedEventLedgerHash: declined.eventLedger.hash(),
      firstCounters: declined.finalSnapshot.wars.declineCounters ?? [],
      firstThresholdEvents: thresholdEvents(declined).length,
      dormantCounters: "declineCounters" in dormant.finalSnapshot.wars,
      prestigeBefore: seeded.nations.get(PLAYER)!.prestige,
      prestigeAfter: costed.finalSnapshot.nations.get(PLAYER)!.prestige,
      enemyPrestigeUnchanged:
        costed.finalSnapshot.nations.get(ENEMY)!.prestige === seeded.nations.get(ENEMY)!.prestige,
      prestigeBodies: prestigeEvents(costed),
      prestigeUntouchedWithoutRule:
        second.finalSnapshot.nations.get(PLAYER)!.prestige === seeded.nations.get(PLAYER)!.prestige,
      prestigeSnapshotHash: hashSnapshot(costed.finalSnapshot),
      prestigeEventLedgerHash: costed.eventLedger.hash(),
      prestigeInProcessEqual:
        hashSnapshot(costed.finalSnapshot) === hashSnapshot(costedAgain.finalSnapshot) &&
        costed.eventLedger.hash() === costedAgain.eventLedger.hash(),
      secondOutcome: second.outcome,
      secondCounters: second.finalSnapshot.wars.declineCounters ?? [],
      secondThresholdBodies: thresholdEvents(second).map((e) => e.body),
      secondSnapshotHash: hashSnapshot(second.finalSnapshot),
      secondEventLedgerHash: second.eventLedger.hash(),
      secondInProcessEqual:
        hashSnapshot(second.finalSnapshot) === hashSnapshot(secondAgain.finalSnapshot) &&
        second.eventLedger.hash() === secondAgain.eventLedger.hash(),
    };
    process.stdout.write(JSON.stringify(output) + "\n");
  } catch (err) {
    process.stdout.write(JSON.stringify({ success: false, error: String(err) }) + "\n");
  }
}

runChild();
