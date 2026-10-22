import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { battleOffersFromRulesets } from "@bluewave/content-compiler";
import type { BattleOfferRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  makeRecordedInput,
  type BattleRequest,
  type BattleResultInput,
  type OfferRequest,
  type OfferResponse,
} from "@bluewave/messages";
import { hashSnapshot, MonthExecutor, type MonthResult } from "@bluewave/phase-engine";
import { describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign } from "../src/production-pack.js";

const PLAYER = "uk";
const ENEMY = "france";
const ALLY = "italy";
const AREA = "eng_home_coast";
const TURN = "t-1-09-turn";

const { state, bundle } = compileProductionCampaign();
const rules = battleOffersFromRulesets(bundle.rulesets) as BattleOfferRules;

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

function warSnapshot(firepower = { player: 200, enemy: 200 }): CampaignSnapshot {
  const base = state.snapshot;
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

function answer(request: OfferRequest, response: OfferResponse) {
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "offer",
    interruptionId: request.interruptionId,
    payload: { interruptionId: request.interruptionId, battleId: request.battleId, response },
  });
}

function run(
  snapshot: CampaignSnapshot,
  seed: string,
  request?: OfferRequest,
  response?: OfferResponse,
): MonthResult {
  return new MonthExecutor().execute(snapshot, [], seed, new DiagnosticCollector(), undefined, {
    battleOffers: rules,
    playerNationId: PLAYER,
    interruptions: {
      turnId: TURN,
      recordedInputs: request && response ? [answer(request, response)] : [],
    },
  });
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

function battleResult(request: BattleRequest): ReturnType<typeof makeRecordedInput> {
  const payload: BattleResultInput = {
    interruptionId: request.interruptionId,
    battleId: request.battleId,
    winnerId: PLAYER,
    loserId: ENEMY,
    attackerLosses: [],
    defenderLosses: [],
    damageReport: {},
  };
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "battle",
    interruptionId: request.interruptionId,
    payload,
  });
}

const bodies = (result: MonthResult, kind: string) =>
  result.eventLedger.all.filter((e) => e.body.kind === kind).map((e) => e.body);
const scores = (result: MonthResult) =>
  result.finalSnapshot.wars.wars.map((w) => [w.attackerWarScore, w.defenderWarScore]);
const streamDraws = (result: MonthResult, streamId: string) =>
  result.randomLedger.all.filter((d) => d.streamId === streamId);

const SEED = "production-offer-seed";
const ENEMY_WITHDRAWS_SEED = "seed-0";
const ENEMY_PROCEEDS_SEED = "seed-2";
const SUPPORT_PRESENT_SEED = "seed-0";
const SUPPORT_ABSENT_SEED = "seed-1";

describe("scripted production war months (ADR-0254 section)", () => {
  const snapshot = warSnapshot();

  it("raises an offer with a strength-only estimate within the authorized error bound", () => {
    const request = offerOf(run(snapshot, SEED));
    expect(request.missionType).toBe("FLEET_BATTLE");
    expect(request.estimate.model).toBe("PERTURBED");
    expect(request.estimate).not.toHaveProperty("composition");
    const draws = streamDraws(run(snapshot, SEED), "battle-offer/estimate");
    expect(draws.length).toBeGreaterThan(0);
  });

  it("accept hands the battle to the player, and a recorded result resolves it", () => {
    const request = offerOf(run(snapshot, SEED));
    const accepted = run(snapshot, SEED, request, "accept");
    expect(accepted.outcome).toBe("suspended");
    const battle = battleOf(accepted);
    expect(battle.battleId).toBe(request.battleId);

    const resumed = new MonthExecutor().execute(
      snapshot,
      [],
      SEED,
      new DiagnosticCollector(),
      undefined,
      {
        battleOffers: rules,
        playerNationId: PLAYER,
        interruptions: {
          turnId: TURN,
          recordedInputs: [answer(request, "accept"), battleResult(battle)],
        },
      },
    );
    expect(resumed.outcome).toBe("completed");
    const resolved = resumed.finalSnapshot.wars.battles.find((b) => b.id === battle.battleId);
    expect(resolved?.phase).toBe("resolved");
    expect(resolved?.result?.explanation).toContain("player-resolved");

    const delegated = run(snapshot, SEED, request, "delegate");
    expect(delegated.outcome).toBe("completed");
  });

  it("declines at the authorized fleet-battle cost to the decliner only", () => {
    const request = offerOf(run(snapshot, SEED));
    const declined = run(snapshot, SEED, request, "decline");
    expect(declined.outcome).toBe("completed");
    expect(scores(declined)).toEqual([[-5, 0]]);
    expect(declined.finalSnapshot.wars.declinedBattles).toHaveLength(1);
    expect(hashSnapshot(declined.finalSnapshot)).toBe(
      hashSnapshot(run(snapshot, SEED, request, "decline").finalSnapshot),
    );
  });

  it("refuses to decline an operationally unavoidable battle, leaving the offer pending and unscored", () => {
    const suspended = run(snapshot, SEED).finalSnapshot;
    const unavoidable: CampaignSnapshot = {
      ...suspended,
      wars: {
        ...suspended.wars,
        battleManifests: (suspended.wars.battleManifests ?? []).map((m) => ({
          ...m,
          acceptanceClass: "OPERATIONALLY_UNAVOIDABLE",
        })),
      },
    };
    const request = offerOf(run(unavoidable, SEED));
    const refused = run(unavoidable, SEED, request, "decline");
    expect(refused.outcome).toBe("suspended");
    expect(refused.suspended?.refusalTag).toBe("BATTLE_DECLINE_NOT_ALLOWED");
    expect(scores(refused)).toEqual([[0, 0]]);
  });

  it("reaches the threshold on the third decline, raises the event and costs 3 percent of prestige each time after", () => {
    let current = snapshot;
    const prestigeAfter: number[] = [];
    const thresholdCounts: number[] = [];
    for (let month = 1; month <= 4; month += 1) {
      const request = offerOf(run(current, SEED));
      const declined = run(current, SEED, request, "decline");
      prestigeAfter.push(declined.finalSnapshot.nations.get(PLAYER)!.prestige as number);
      thresholdCounts.push(bodies(declined, "DeclineThresholdReached").length);
      const nations = new Map(current.nations);
      nations.set(PLAYER, {
        ...nations.get(PLAYER)!,
        prestige: declined.finalSnapshot.nations.get(PLAYER)!.prestige,
      });
      current = {
        ...current,
        nations,
        wars: {
          ...current.wars,
          declineCounters: declined.finalSnapshot.wars.declineCounters ?? [],
        },
      };
    }
    const start = snapshot.nations.get(PLAYER)!.prestige as number;
    expect(thresholdCounts).toEqual([0, 0, 1, 1]);
    expect(prestigeAfter[0]).toBe(start);
    expect(prestigeAfter[1]).toBe(start);
    expect(prestigeAfter[2]).toBe(start - Math.max(1, Math.ceil((start * 300) / 10_000)));
    expect(prestigeAfter[3]).toBe(
      prestigeAfter[2]! - Math.max(1, Math.ceil((prestigeAfter[2]! * 300) / 10_000)),
    );
  });

  it("lets an outmatched enemy withdraw on its recorded draw, with no offer, no battle and no cost to the enemy", () => {
    const lopsided = warSnapshot({ player: 400, enemy: 155 });
    const withdrew = run(lopsided, ENEMY_WITHDRAWS_SEED);
    expect(withdrew.outcome).toBe("completed");
    expect(bodies(withdrew, "EnemyDeclinedBattle")).toHaveLength(1);
    expect(streamDraws(withdrew, "battle-offer/enemy-decline")).toHaveLength(1);
    expect(withdrew.finalSnapshot.wars.battles).toHaveLength(0);
    expect(scores(withdrew)).toEqual([[0, 0]]);

    const proceeds = run(lopsided, ENEMY_PROCEEDS_SEED);
    expect(offerOf(proceeds).kind).toBe("offer");
    expect(bodies(proceeds, "EnemyDeclinedBattle")).toHaveLength(0);
  });

  it("never draws for an even match: the force-balance predicate gates the enemy decline", () => {
    expect(streamDraws(run(snapshot, SEED), "battle-offer/enemy-decline")).toHaveLength(0);
  });

  it("joins a friendly allied support force on its recorded draw and names only its nations", () => {
    const supported = withAlly(snapshot);
    const present = offerOf(run(supported, SUPPORT_PRESENT_SEED));
    expect(present.supportForcePresent).toBe(true);
    expect(present.supportNationIds).toEqual([ALLY]);
    expect(offerOf(run(supported, SUPPORT_ABSENT_SEED)).supportForcePresent).toBe(false);
    expect(
      streamDraws(run(supported, SUPPORT_PRESENT_SEED), "battle-offer/support-force"),
    ).toHaveLength(1);
    expect(
      streamDraws(run(snapshot, SUPPORT_PRESENT_SEED), "battle-offer/support-force"),
    ).toHaveLength(0);
  });

  it("is byte-identical across two runs of the same scripted months", () => {
    const supported = withAlly(snapshot);
    const request = offerOf(run(supported, SUPPORT_PRESENT_SEED));
    const a = run(supported, SUPPORT_PRESENT_SEED, request, "accept");
    const b = run(supported, SUPPORT_PRESENT_SEED, request, "accept");
    expect(hashSnapshot(a.finalSnapshot)).toBe(hashSnapshot(b.finalSnapshot));
    expect(a.eventLedger.hash()).toBe(b.eventLedger.hash());
    expect(a.randomLedger.hash()).toBe(b.randomLedger.hash());
  });
});

describe("peacetime production months (R1, R15)", () => {
  it("are byte-identical with the section configured and without it", () => {
    const peace = state.snapshot;
    const execute = (options?: { battleOffers: BattleOfferRules; playerNationId: string }) =>
      new MonthExecutor().execute(
        peace,
        [],
        "peace-seed",
        new DiagnosticCollector(),
        undefined,
        options,
      );
    const configured = execute({ battleOffers: rules, playerNationId: PLAYER });
    const dormant = execute();
    expect(hashSnapshot(configured.finalSnapshot)).toBe(hashSnapshot(dormant.finalSnapshot));
    expect(configured.eventLedger.hash()).toBe(dormant.eventLedger.hash());
    expect(configured.randomLedger.hash()).toBe(dormant.randomLedger.hash());
  });
});
