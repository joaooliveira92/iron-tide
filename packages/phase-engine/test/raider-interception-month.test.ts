import type { CampaignSnapshot, RaiderInterceptionRules, Ship } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import type { TradeProtectionRules } from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import {
  TRADE_RULES,
  runTrade,
  tradeShip,
  tradeSnapshot,
  type TradeScenario,
} from "./fixtures/trade-protection.js";

const NEVER: RaiderInterceptionRules = {
  interceptBaseBp: 1,
  interceptPatrolBp: 1,
  breakoutInterceptBp: 1,
  raiderSunkBp: 1,
  maxEngagementDamageBp: 1,
  scuttleThresholdBp: 1,
  scuttleShareBp: 1,
  fuelInternBp: 1,
  breakdownInternBp: 1,
};

const withRules = (over: Partial<RaiderInterceptionRules>): TradeProtectionRules => ({
  ...TRADE_RULES,
  raiderInterception: { ...NEVER, ...over },
});

const raider = (id: string, over: Partial<Ship> = {}, nation = "FRA") =>
  tradeShip(id, "d-cp", { stationAssignment: "RAIDER", ...over }, nation);
const escort = (id: string) => tradeShip(id, "d-dd", { stationAssignment: "TRADE_PROTECTION" });

const scenario = (extra: Partial<TradeScenario> = {}): TradeScenario => ({
  gbrShips: [
    escort("e1"),
    tradeShip("e2", "d-dd"),
    tradeShip("e3", "d-dd"),
    tradeShip("e4", "d-dd"),
  ],
  frashipsRaiders: [raider("r1")],
  ...extra,
});

const kinds = (result: ReturnType<typeof runTrade>, kind: string) =>
  result.eventLedger.all.filter((e) => e.body.kind === kind).map((e) => e.body as never);

const draws = (result: ReturnType<typeof runTrade>, stream: string) =>
  result.randomLedger.all.filter((d) => d.streamId === stream);

const fraShips = (s: CampaignSnapshot) => s.nations.get("FRA")!.fleets[0]!.ships;

describe("#1013: raider interception", () => {
  it("draws nothing and changes nothing when the interception section is absent", () => {
    const result = runTrade(tradeSnapshot(scenario()), [], TRADE_RULES);
    expect(draws(result, "trade/interception")).toEqual([]);
    expect(kinds(result, "RaiderEngaged")).toEqual([]);
    expect(fraShips(result.finalSnapshot)).toHaveLength(1);
  });

  it("sinks an intercepted raider, records the draw and skips its loss draw", () => {
    const result = runTrade(
      tradeSnapshot(scenario()),
      [],
      withRules({ interceptBaseBp: 10_000, raiderSunkBp: 10_000 }),
    );
    expect(fraShips(result.finalSnapshot)).toEqual([]);
    expect(draws(result, "trade/interception")).toHaveLength(1);
    expect(draws(result, "trade/interception")[0]).toMatchObject({
      phase: "resolve_diplomacy",
      entityKey: "w1/r1/GBR/1880-06",
    });
    expect(kinds(result, "RaiderEngaged")).toEqual([
      expect.objectContaining({
        nationId: "FRA",
        shipId: "r1",
        victimNationId: "GBR",
        encounter: "INTERCEPTION",
        outcome: "SUNK",
      }),
    ]);
    expect(draws(result, "trade/loss")).toEqual([]);
    expect(kinds(result, "MerchantLossSuffered")).toEqual([]);
  });

  it("lets a surviving raider go on raiding with its damage applied", () => {
    const result = runTrade(
      tradeSnapshot(scenario()),
      [],
      withRules({
        interceptBaseBp: 10_000,
        raiderSunkBp: 1,
        maxEngagementDamageBp: 1,
        scuttleThresholdBp: 1,
      }),
    );
    expect(fraShips(result.finalSnapshot)).toHaveLength(1);
    expect(fraShips(result.finalSnapshot)[0]!.internment).toBeUndefined();
    expect(kinds(result, "RaiderEngaged")).toEqual([
      expect.objectContaining({ outcome: "SURVIVED" }),
    ]);
    expect(draws(result, "trade/loss")).toHaveLength(1);
  });

  it("scuttles a heavily damaged survivor when the disposition draw falls under the share", () => {
    const result = runTrade(
      tradeSnapshot(scenario()),
      [],
      withRules({
        interceptBaseBp: 10_000,
        raiderSunkBp: 1,
        maxEngagementDamageBp: 10_000,
        scuttleThresholdBp: 10_000,
        scuttleShareBp: 10_000,
      }),
    );
    expect(fraShips(result.finalSnapshot)).toEqual([]);
    expect(kinds(result, "RaiderEngaged")).toEqual([
      expect.objectContaining({ outcome: "SCUTTLED" }),
    ]);
    expect(draws(result, "trade/disposition")).toHaveLength(1);
  });

  it("interns a heavily damaged survivor until the war ends and drops it from raiding", () => {
    const result = runTrade(
      tradeSnapshot(scenario()),
      [],
      withRules({
        interceptBaseBp: 10_000,
        raiderSunkBp: 1,
        maxEngagementDamageBp: 10_000,
        scuttleThresholdBp: 10_000,
        scuttleShareBp: 1,
      }),
    );
    const [ship] = fraShips(result.finalSnapshot);
    expect(ship).toMatchObject({
      readiness: "MOTHBALLED",
      internment: { sinceMonth: "1880-06", cause: "DAMAGE", readinessBefore: "ACTIVE" },
    });
    expect(ship!.stationAssignment).toBeUndefined();
    expect(kinds(result, "RaiderInterned")).toEqual([
      expect.objectContaining({ shipId: "r1", cause: "DAMAGE" }),
    ]);
    expect(draws(result, "trade/loss")).toEqual([]);
  });

  it("raises the interception chance with the victim's patrol coverage", () => {
    const covered = runTrade(
      tradeSnapshot(scenario()),
      [],
      withRules({ interceptBaseBp: 1, interceptPatrolBp: 10_000 }),
    );
    const uncovered = runTrade(
      tradeSnapshot(scenario({ gbrShips: [tradeShip("e1", "d-dd"), tradeShip("e2", "d-dd")] })),
      [],
      withRules({ interceptBaseBp: 1, interceptPatrolBp: 10_000 }),
    );
    expect(draws(covered, "trade/interception")[0]!.outcome).toBe("INTERCEPTED");
    expect(draws(uncovered, "trade/interception")[0]!.outcome).toBe("ESCAPED");
  });

  it("treats an AI victim as fully patrolled", () => {
    const result = runTrade(
      tradeSnapshot({
        gbrShips: [raider("g1", {}, "GBR")],
        frashipsRaiders: [tradeShip("f1", "d-dd")],
      }),
      [],
      withRules({ interceptBaseBp: 1, interceptPatrolBp: 10_000 }),
    );
    expect(draws(result, "trade/interception")[0]).toMatchObject({
      entityKey: "w1/g1/FRA/1880-06",
      outcome: "INTERCEPTED",
    });
  });

  it("makes a blockaded nation's raider break out instead of facing patrols", () => {
    const result = runTrade(
      tradeSnapshot(scenario({ blockade: "GBR_BLOCKADES_FRA" })),
      [],
      withRules({ interceptBaseBp: 1, breakoutInterceptBp: 10_000, raiderSunkBp: 10_000 }),
    );
    expect(kinds(result, "RaiderEngaged")).toEqual([
      expect.objectContaining({ encounter: "BREAKOUT", outcome: "SUNK" }),
    ]);
    expect(draws(result, "trade/interception")[0]).toMatchObject({
      entityKey: "w1/r1/BREAKOUT/1880-06",
    });
  });

  it("draws nothing for a raider whose nation blockades the victim", () => {
    const result = runTrade(
      tradeSnapshot(scenario({ blockade: "FRA_BLOCKADES_GBR" })),
      [],
      withRules({ interceptBaseBp: 10_000, raiderSunkBp: 10_000 }),
    );
    expect(draws(result, "trade/interception")).toEqual([]);
    expect(fraShips(result.finalSnapshot)).toHaveLength(1);
  });

  it("interns a raider on fuel exhaustion and records the cause", () => {
    const result = runTrade(
      tradeSnapshot(scenario()),
      [],
      withRules({ fuelInternBp: 10_000, breakdownInternBp: 1 }),
    );
    expect(fraShips(result.finalSnapshot)[0]!.internment).toMatchObject({
      cause: "FUEL_EXHAUSTION",
    });
    expect(kinds(result, "RaiderInterned")).toEqual([
      expect.objectContaining({ cause: "FUEL_EXHAUSTION" }),
    ]);
    expect(draws(result, "trade/internment")).toHaveLength(1);
  });

  it("interns on breakdown when the draw lands past the fuel share", () => {
    const result = runTrade(
      tradeSnapshot(scenario()),
      [],
      withRules({ fuelInternBp: 1, breakdownInternBp: 9999 }),
    );
    const cause =
      draws(result, "trade/internment")[0]!.draw === 0 ? "FUEL_EXHAUSTION" : "BREAKDOWN";
    expect(fraShips(result.finalSnapshot)[0]!.internment?.cause).toBe(cause);
  });

  it("keeps an interned raider out of later months and releases it when the war ends", () => {
    const rules = withRules({ fuelInternBp: 10_000, breakdownInternBp: 1 });
    const first = runTrade(tradeSnapshot(scenario()), [], rules);
    const next = { ...first.finalSnapshot, turnNumber: SafeInt(6) };
    const second = runTrade(next, [], rules);
    expect(draws(second, "trade/interception")).toEqual([]);
    expect(draws(second, "trade/internment")).toEqual([]);
    expect(fraShips(second.finalSnapshot)[0]!.internment).toBeDefined();

    const peace = { ...next, wars: { ...next.wars, wars: [] } };
    const released = runTrade(peace, [], rules);
    expect(fraShips(released.finalSnapshot)[0]!.internment).toBeUndefined();
    expect(fraShips(released.finalSnapshot)[0]!.readiness).toBe("ACTIVE");
    expect(kinds(released, "RaiderReleased")).toEqual([
      expect.objectContaining({ nationId: "FRA", shipId: "r1" }),
    ]);
  });

  it("is deterministic for the same seed", () => {
    const rules = withRules({ interceptBaseBp: 5000, fuelInternBp: 3000 });
    const a = runTrade(tradeSnapshot(scenario()), [], rules);
    const b = runTrade(tradeSnapshot(scenario()), [], rules);
    expect(a.randomLedger.all).toEqual(b.randomLedger.all);
    expect(a.eventLedger.all).toEqual(b.eventLedger.all);
  });
});
