import type { RaiderInterceptionRules, Ship } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import type { TradeProtectionRules } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  makeRecordedInput,
  type BattleRequest,
  type BattleResultInput,
  type OfferRequest,
  type RecordedInput,
} from "@bluewave/messages";
import { FIXTURE_BATTLE_OFFER_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, type MonthResult } from "../src/index.js";
import { TRADE_RULES, tradeShip, tradeSnapshot } from "./fixtures/trade-protection.js";

const BASE: RaiderInterceptionRules = {
  interceptBaseBp: 10_000,
  interceptPatrolBp: 1,
  breakoutInterceptBp: 10_000,
  raiderSunkBp: 1,
  maxEngagementDamageBp: 1,
  scuttleThresholdBp: 10_000,
  scuttleShareBp: 10_000,
  fuelInternBp: 1,
  breakdownInternBp: 1,
};

const rules = (over: Partial<RaiderInterceptionRules>): TradeProtectionRules => ({
  ...TRADE_RULES,
  raiderInterception: { ...BASE, ...over },
});

const TURN = "turn-raider-disposition";

function run(
  snapshot: ReturnType<typeof tradeSnapshot>,
  tradeProtection: TradeProtectionRules,
  inputs: readonly RecordedInput[] = [],
): MonthResult {
  return new MonthExecutor().execute(
    snapshot,
    [],
    "raider-disposition-seed",
    new DiagnosticCollector(),
    undefined,
    {
      playerNationId: "GBR",
      tradeProtection,
      battleOffers: FIXTURE_BATTLE_OFFER_RULES,
      interruptions: { turnId: TURN, recordedInputs: inputs },
    },
  );
}

const kinds = (result: MonthResult, kind: string) =>
  result.eventLedger.all.filter((e) => e.body.kind === kind);

const draws = (result: MonthResult, stream: string) =>
  result.randomLedger.all.filter((d) => d.streamId === stream);

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

const accept = (offer: OfferRequest): RecordedInput =>
  makeRecordedInput({
    ordinal: offer.ordinal,
    kind: "offer",
    interruptionId: offer.interruptionId,
    payload: {
      interruptionId: offer.interruptionId,
      battleId: offer.battleId,
      response: "accept",
    },
  });

const delegate = (offer: OfferRequest): RecordedInput =>
  makeRecordedInput({
    ordinal: offer.ordinal,
    kind: "offer",
    interruptionId: offer.interruptionId,
    payload: {
      interruptionId: offer.interruptionId,
      battleId: offer.battleId,
      response: "delegate",
    },
  });

function outcome(
  request: BattleRequest,
  winnerId: string,
  loserId: string,
  damageReport: Readonly<Record<string, number>>,
  losses: { readonly attacker?: readonly string[]; readonly defender?: readonly string[] } = {},
): RecordedInput {
  const payload: BattleResultInput = {
    interruptionId: request.interruptionId,
    battleId: request.battleId,
    winnerId,
    loserId,
    attackerLosses: [...(losses.attacker ?? [])],
    defenderLosses: [...(losses.defender ?? [])],
    damageReport: Object.fromEntries(
      Object.entries(damageReport).map(([shipId, loss]) => [shipId, SafeInt(loss)]),
    ),
  };
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "battle",
    interruptionId: request.interruptionId,
    payload,
  });
}

const patrol = (id: string) => tradeShip(id, "d-dd", { stationAssignment: "TRADE_PROTECTION" });
const fraPatrol = (id: string) => tradeShip(id, "d-dd", {}, "FRA");
const fraRaider = (id: string) => tradeShip(id, "d-cp", { stationAssignment: "RAIDER" }, "FRA");
const gbrRaider = (id: string) => tradeShip(id, "d-cp", { stationAssignment: "RAIDER" });

const interception = () =>
  tradeSnapshot({ gbrShips: [patrol("p1"), patrol("p2")], frashipsRaiders: [fraRaider("r1")] });

const breakout = () =>
  tradeSnapshot({
    gbrShips: [gbrRaider("g-r")],
    frashipsRaiders: [fraPatrol("f1")],
    blockade: "FRA_BLOCKADES_GBR",
  });

function resolveInterception(
  tradeProtection: TradeProtectionRules,
  damage: number,
  losses: { readonly defender?: readonly string[] } = {},
): MonthResult {
  const snapshot = interception();
  const offer = offerOf(run(snapshot, tradeProtection));
  const accepted = accept(offer);
  const request = battleOf(run(snapshot, tradeProtection, [accepted]));
  return run(snapshot, tradeProtection, [
    accepted,
    outcome(request, "GBR", "FRA", { r1: damage }, losses),
  ]);
}

const shipOf = (result: MonthResult, nationId: string, shipId: string): Ship | undefined =>
  result.finalSnapshot.nations
    .get(nationId)
    ?.fleets.flatMap((fleet) => fleet.ships)
    .find((ship) => ship.id === shipId);

describe("#1130: tactical raider battles apply the abstract scuttle and internment dispositions", () => {
  it("scuttles a raider that survives the battle below the scuttle threshold when the share draw says so", () => {
    const result = resolveInterception(rules({ scuttleShareBp: 10_000 }), 30);
    expect(result.outcome).toBe("completed");
    expect(shipOf(result, "FRA", "r1")).toBeUndefined();
    expect(draws(result, "trade/disposition")).toHaveLength(1);
    const engaged = kinds(result, "RaiderEngaged");
    expect(engaged).toHaveLength(1);
    expect(engaged[0]?.body).toMatchObject({
      kind: "RaiderEngaged",
      nationId: "FRA",
      shipId: "r1",
      victimNationId: "GBR",
      encounter: "INTERCEPTION",
      outcome: "SCUTTLED",
      damageBp: 3_000,
    });
    expect(kinds(result, "RaiderInterned")).toEqual([]);
  });

  it("interns the damaged raider when the share draw does not scuttle it", () => {
    const result = resolveInterception(rules({ scuttleShareBp: 0 }), 30);
    const raider = shipOf(result, "FRA", "r1");
    expect(raider?.hitPoints).toBe(70);
    expect(raider?.readiness).toBe("MOTHBALLED");
    expect(raider?.inBattleId).toBeUndefined();
    expect(raider?.stationAssignment).toBeUndefined();
    expect(raider?.internment).toMatchObject({ cause: "DAMAGE", readinessBefore: "ACTIVE" });
    expect(kinds(result, "RaiderEngaged")[0]?.body).toMatchObject({ outcome: "INTERNED" });
    expect(kinds(result, "RaiderInterned")).toHaveLength(1);
    expect(kinds(result, "RaiderInterned")[0]?.body).toMatchObject({
      nationId: "FRA",
      shipId: "r1",
      cause: "DAMAGE",
    });
  });

  it("leaves a raider above the scuttle threshold in service and draws nothing", () => {
    const result = resolveInterception(rules({ scuttleThresholdBp: 5_000 }), 30);
    const raider = shipOf(result, "FRA", "r1");
    expect(raider?.hitPoints).toBe(70);
    expect(raider?.internment).toBeUndefined();
    expect(raider?.readiness).toBe("ACTIVE");
    expect(draws(result, "trade/disposition")).toEqual([]);
    expect(kinds(result, "RaiderEngaged")).toEqual([]);
    expect(kinds(result, "RaiderInterned")).toEqual([]);
  });

  it("disposes of a raider that crosses the threshold on this battle's damage", () => {
    const result = resolveInterception(rules({ scuttleThresholdBp: 5_000 }), 60);
    expect(shipOf(result, "FRA", "r1")).toBeUndefined();
    expect(draws(result, "trade/disposition")).toHaveLength(1);
  });

  it("draws no disposition for a raider sunk in the battle", () => {
    const result = resolveInterception(rules({}), 100, { defender: ["r1"] });
    expect(shipOf(result, "FRA", "r1")).toBeUndefined();
    expect(draws(result, "trade/disposition")).toEqual([]);
    expect(kinds(result, "RaiderEngaged")).toEqual([]);
  });

  it("applies the disposition to the player's own raider in a breakout", () => {
    const tradeProtection = rules({ scuttleShareBp: 0 });
    const snapshot = breakout();
    const offer = offerOf(run(snapshot, tradeProtection));
    expect(offer.missionType).toBe("BLOCKADE_BREAKOUT");
    const accepted = accept(offer);
    const request = battleOf(run(snapshot, tradeProtection, [accepted]));
    const result = run(snapshot, tradeProtection, [
      accepted,
      outcome(request, "FRA", "GBR", { "g-r": 40 }),
    ]);
    const raider = shipOf(result, "GBR", "g-r");
    expect(raider?.internment).toMatchObject({ cause: "DAMAGE" });
    expect(kinds(result, "RaiderEngaged")[0]?.body).toMatchObject({
      nationId: "GBR",
      victimNationId: "FRA",
      encounter: "BREAKOUT",
      outcome: "INTERNED",
      damageBp: 4_000,
    });
  });

  it("applies the disposition after an auto-resolved delegated battle", () => {
    const tradeProtection = rules({ scuttleShareBp: 0 });
    const snapshot = interception();
    const offer = offerOf(run(snapshot, tradeProtection));
    const done = run(snapshot, tradeProtection, [delegate(offer)]);
    expect(done.outcome).toBe("completed");
    const raider = shipOf(done, "FRA", "r1");
    const disposed = draws(done, "trade/disposition");
    if (raider === undefined) {
      expect(disposed).toEqual([]);
    } else {
      expect(disposed).toHaveLength(1);
      expect(raider.internment).toMatchObject({ cause: "DAMAGE" });
    }
  });

  it("is deterministic: the same inputs give the same ledgers and snapshot", () => {
    const tradeProtection = rules({ scuttleShareBp: 0 });
    const a = resolveInterception(tradeProtection, 30);
    const b = resolveInterception(tradeProtection, 30);
    expect(b.randomLedger.all).toEqual(a.randomLedger.all);
    expect(b.eventLedger.all).toEqual(a.eventLedger.all);
    expect(b.finalSnapshot).toEqual(a.finalSnapshot);
  });
});
