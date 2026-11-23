import type { RaiderInterceptionRules } from "@bluewave/campaign";
import type { TradeProtectionRules } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { makeRecordedInput, type OfferRequest, type RecordedInput } from "@bluewave/messages";
import { FIXTURE_BATTLE_OFFER_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, type MonthResult } from "../src/index.js";
import { TRADE_RULES, tradeDesign, tradeShip, tradeSnapshot } from "./fixtures/trade-protection.js";

const BASE: RaiderInterceptionRules = {
  interceptBaseBp: 10_000,
  interceptPatrolBp: 1,
  breakoutInterceptBp: 10_000,
  raiderSunkBp: 1,
  maxEngagementDamageBp: 1,
  scuttleThresholdBp: 1,
  scuttleShareBp: 1,
  fuelInternBp: 1,
  breakdownInternBp: 1,
};

const withRules = (over: Partial<RaiderInterceptionRules>): TradeProtectionRules => ({
  ...TRADE_RULES,
  raiderInterception: { ...BASE, ...over },
});

const SURPRISE = { chanceBp: 10_000, startRangeM: 4_000 };
const TURN = "turn-surprise";

const DESIGNS = [
  tradeDesign("d-dd", "destroyer"),
  tradeDesign("d-cp", "protected_cruiser"),
  tradeDesign("d-amc", "armed_merchant_cruiser"),
];

const patrol = (id: string) => tradeShip(id, "d-dd", { stationAssignment: "TRADE_PROTECTION" });
const fraRaider = (id: string, design: string) =>
  tradeShip(id, design, { stationAssignment: "RAIDER" }, "FRA");
const gbrRaider = (id: string, design: string) =>
  tradeShip(id, design, { stationAssignment: "RAIDER" });
const fraPatrol = (id: string) => tradeShip(id, "d-dd", {}, "FRA");

function run(
  snapshot: ReturnType<typeof tradeSnapshot>,
  rules: TradeProtectionRules,
  inputs: readonly RecordedInput[] = [],
): MonthResult {
  return new MonthExecutor().execute(
    snapshot,
    [],
    "surprise-seed",
    new DiagnosticCollector(),
    undefined,
    {
      playerNationId: "GBR",
      tradeProtection: rules,
      battleOffers: FIXTURE_BATTLE_OFFER_RULES,
      interruptions: { turnId: TURN, recordedInputs: inputs },
    },
  );
}

function delegated(
  snapshot: ReturnType<typeof tradeSnapshot>,
  rules: TradeProtectionRules,
): MonthResult {
  const first = run(snapshot, rules);
  const request = first.suspended?.request;
  if (request?.kind !== "offer") throw new Error(`expected an offer, got ${request?.kind}`);
  const offer: OfferRequest = request;
  const answered = makeRecordedInput({
    ordinal: offer.ordinal,
    kind: "offer",
    interruptionId: offer.interruptionId,
    payload: {
      interruptionId: offer.interruptionId,
      battleId: offer.battleId,
      response: "delegate",
    },
  });
  return run(snapshot, rules, [answered]);
}

const surpriseDraws = (result: MonthResult) =>
  result.randomLedger.all.filter((d) => d.streamId === "trade/surprise");

const manifestsOf = (result: MonthResult) => result.finalSnapshot.wars.battleManifests ?? [];

const interceptedByPatrols = (design: string) =>
  tradeSnapshot({
    gbrShips: [patrol("p1"), patrol("p2")],
    frashipsRaiders: [fraRaider("r1", design)],
    designs: DESIGNS,
  });

describe("#1110: AMC deception and surprise start", () => {
  it("starts an intercepted AMC raider's battle at the authored short range", () => {
    const result = delegated(interceptedByPatrols("d-amc"), withRules({ amcSurprise: SURPRISE }));
    expect(surpriseDraws(result)).toHaveLength(1);
    expect(surpriseDraws(result)[0]?.outcome).toBe("SURPRISED");
    const manifest = manifestsOf(result).find((m) => m.missionType === "RAIDER_INTERCEPTION");
    expect(manifest?.shortRangeStartUm).toBe(4_000_000_000);
  });

  it("starts the battle of an AMC the player runs against enemy patrols at short range too", () => {
    const snapshot = tradeSnapshot({
      gbrShips: [gbrRaider("g-r", "d-amc")],
      frashipsRaiders: [fraPatrol("f1"), fraPatrol("f2")],
      designs: DESIGNS,
    });
    const result = delegated(snapshot, withRules({ amcSurprise: SURPRISE }));
    expect(manifestsOf(result)[0]?.shortRangeStartUm).toBe(4_000_000_000);
  });

  it("draws nothing and leaves the manifest unchanged for a non-AMC raider", () => {
    const result = delegated(interceptedByPatrols("d-cp"), withRules({ amcSurprise: SURPRISE }));
    expect(surpriseDraws(result)).toEqual([]);
    expect("shortRangeStartUm" in manifestsOf(result)[0]!).toBe(false);
  });

  it("draws nothing without an authored surprise block", () => {
    const result = delegated(interceptedByPatrols("d-amc"), withRules({}));
    expect(surpriseDraws(result)).toEqual([]);
    expect("shortRangeStartUm" in manifestsOf(result)[0]!).toBe(false);
  });

  it("draws nothing when the encounter stays abstract", () => {
    const snapshot = tradeSnapshot({
      gbrShips: [],
      frashipsRaiders: [fraRaider("r1", "d-amc")],
      designs: DESIGNS,
    });
    const result = run(snapshot, withRules({ amcSurprise: SURPRISE }));
    expect(surpriseDraws(result)).toEqual([]);
  });

  it("caps the interceptor force at the authored maxInterceptors", () => {
    const first = run(interceptedByPatrols("d-cp"), withRules({ maxInterceptors: 1 }));
    const request = first.suspended?.request;
    if (request?.kind !== "offer") throw new Error(`expected an offer, got ${request?.kind}`);
    expect(request.playerForce.map((s) => s.shipId)).toEqual(["p1"]);
  });

  it("is deterministic", () => {
    const rules = withRules({ amcSurprise: SURPRISE });
    const a = delegated(interceptedByPatrols("d-amc"), rules);
    const b = delegated(interceptedByPatrols("d-amc"), rules);
    expect(surpriseDraws(a)).toEqual(surpriseDraws(b));
  });
});
