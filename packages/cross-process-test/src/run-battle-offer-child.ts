// T-1 03 (#112, spec #109 R15): cross-process determinism child for the player battle offer. Compiles the production
// pack, puts the player's nation at war in one area, and runs the month with a FIXTURE-CLASS battleOffers section and a
// scripted interruption channel: suspend at the offer, answer it, resume. It prints the offer, the hashes and the
// non-offered control as JSON for byte-for-byte comparison across two clean processes.
//
// EVERY RULESET NUMBER COMES FROM @bluewave/test-support AND IS FIXTURE-CLASS: it exercises the mechanics and never
// reaches the production pack, which authors no battleOffers section until ticket #118.
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

function warSnapshot(base: CampaignSnapshot): CampaignSnapshot {
  const nations = new Map<string, NationState>(base.nations);
  for (const id of [PLAYER, ENEMY]) {
    const nation = nations.get(id)!;
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
    // T-1 04 (#113): the declined month, twice in-process; the war score and the declined record are observed.
    const declined = run(snapshot, { offers: true, channel: true, response: request }, "decline");
    const declinedAgain = run(
      snapshot,
      { offers: true, channel: true, response: request },
      "decline",
    );

    // T-1 05 (#114): the scripted second decline. The next month starts from the tally the first decline saved, so the
    // fixture threshold (2) is reached and exactly one typed event is raised; a third pass proves in-process equality.
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

    const enemyShipIds = snapshot.nations
      .get(ENEMY)!
      .fleets.flatMap((f) => f.ships)
      .map((ship) => ship.id);
    const requestText = JSON.stringify(request);
    const draws = accepted.randomLedger.all.filter((d) => d.streamId.startsWith("battle-offer"));

    const output = {
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
