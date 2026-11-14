import type { CampaignSnapshot } from "@bluewave/campaign";
import { battleOffersFromRulesets } from "@bluewave/content-compiler";
import type { BattleOfferRules } from "@bluewave/content-schema";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import {
  makeRecordedInput,
  type BattleRequest,
  type BattleResultInput,
  type OfferRequest,
  type OfferResponse,
} from "@bluewave/messages";
import { MonthExecutor, type MonthResult } from "@bluewave/phase-engine";
import { describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign } from "../src/production-pack.js";
import { fleetManagementOptions } from "../src/replay-corpus/corpus.js";

const PLAYER = "austria_hungary";
const ENEMY = "italy";
const SEED = "production-battle-route";
const TURN = "battle-route-turn";

const { state, bundle } = compileProductionCampaign();
const rules = battleOffersFromRulesets(bundle.rulesets) as BattleOfferRules;
const { engagementMinimumStrength: _authored, ...rulesWithoutEngagement } = rules;

const start: CampaignSnapshot = {
  ...state.snapshot,
  slots: [...state.snapshot.slots]
    .sort((a, b) => Number(b.nationId === PLAYER) - Number(a.nationId === PLAYER))
    .map((slot) => ({ ...slot, type: slot.nationId === PLAYER ? "playable" : "ai" })),
};

function envelopes(
  snapshot: CampaignSnapshot,
  month: number,
  bodies: readonly CommandBody[],
): CommandEnvelope<CommandBody>[] {
  return bodies.map((body, index) => ({
    commandId: `route-m${String(month)}-${String(index)}`,
    version: "0.1.0",
    expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
    idempotencyKey: `route-ik-m${String(month)}-${String(index)}`,
    timestamp: "route",
    body,
  }));
}

const MONTH_ONE: readonly CommandBody[] = [
  { type: "DeclareWar", nationId: PLAYER, targetNationId: ENEMY },
  {
    type: "MoveFleet",
    nationId: PLAYER,
    fleetId: "fleet_aut_adriatic",
    toAreaId: "sea_mediterranean_c",
  },
];
const MONTH_TWO: readonly CommandBody[] = [
  {
    type: "MoveFleet",
    nationId: PLAYER,
    fleetId: "fleet_aut_adriatic",
    toAreaId: "ita_tyrrhenian_coast",
  },
];

function execute(
  snapshot: CampaignSnapshot,
  month: number,
  bodies: readonly CommandBody[],
  offers: BattleOfferRules,
  recordedInputs: ReturnType<typeof makeRecordedInput>[] = [],
): MonthResult {
  return new MonthExecutor().execute(
    snapshot,
    envelopes(snapshot, month, bodies),
    `${SEED}-${String(month)}`,
    new DiagnosticCollector(),
    undefined,
    {
      ...fleetManagementOptions(PLAYER),
      playerNationId: PLAYER,
      battleOffers: offers,
      interruptions: { turnId: `${TURN}-${String(month)}`, recordedInputs },
    },
  );
}

function nextMonth(result: MonthResult): CampaignSnapshot {
  return {
    ...result.finalSnapshot,
    turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt.ONE),
  };
}

function offerOf(result: MonthResult): OfferRequest {
  const request = result.suspended?.request;
  if (request?.kind !== "offer") throw new Error(`expected an offer, got ${String(request?.kind)}`);
  return request;
}

function answer(request: OfferRequest, response: OfferResponse) {
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "offer",
    interruptionId: request.interruptionId,
    payload: { interruptionId: request.interruptionId, battleId: request.battleId, response },
  });
}

function playerWins(request: BattleRequest) {
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

describe("player route to a battle offer from the 1880 start (#422)", () => {
  const monthOne = execute(start, 1, MONTH_ONE, rules);
  const atArrival = nextMonth(monthOne);

  it("declares the war and moves one hop without raising an offer in month one", () => {
    expect(monthOne.outcome).toBe("completed");
    expect(monthOne.finalSnapshot.wars.wars.map((w) => w.status)).toEqual(["DECLARED_NOT_ACTIVE"]);
  });

  it("raises a fleet-battle offer when the fleet reaches the enemy home squadron", () => {
    const monthTwo = execute(atArrival, 2, MONTH_TWO, rules);
    expect(monthTwo.outcome).toBe("suspended");
    expect(offerOf(monthTwo).missionType).toBe("FLEET_BATTLE");
  });

  it("raises no offer from the same orders when the pack authors no engagement strength", () => {
    const dormant = execute(atArrival, 2, MONTH_TWO, rulesWithoutEngagement);
    expect(dormant.outcome).toBe("completed");
    expect(dormant.finalSnapshot.wars.battles).toEqual([]);
  });

  it("makes the war ACTIVE once the accepted battle is fought to a recorded result", () => {
    const offer = offerOf(execute(atArrival, 2, MONTH_TWO, rules));
    const accepted = execute(atArrival, 2, MONTH_TWO, rules, [answer(offer, "accept")]);
    const request = accepted.suspended?.request;
    if (request?.kind !== "battle")
      throw new Error(`expected a battle, got ${String(request?.kind)}`);
    const fought = execute(atArrival, 2, MONTH_TWO, rules, [
      answer(offer, "accept"),
      playerWins(request),
    ]);
    expect(fought.outcome).toBe("completed");
    expect(fought.finalSnapshot.wars.wars.map((w) => w.status)).toEqual(["ACTIVE"]);
    expect(fought.finalSnapshot.wars.battles.find((b) => b.id === request.battleId)?.phase).toBe(
      "resolved",
    );
  });

  it("is reproducible: the same orders give the same offer and snapshot hash", () => {
    const again = execute(start, 1, MONTH_ONE, rules);
    expect(sha256Hex(canonicalSerialize(again.finalSnapshot))).toBe(
      sha256Hex(canonicalSerialize(monthOne.finalSnapshot)),
    );
    expect(offerOf(execute(nextMonth(again), 2, MONTH_TWO, rules)).battleId).toBe(
      offerOf(execute(atArrival, 2, MONTH_TWO, rules)).battleId,
    );
  });
});
