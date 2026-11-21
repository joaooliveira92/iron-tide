import type { CampaignSnapshot, Ship } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import {
  TRADE_RULES,
  runTrade,
  tradeDesign,
  tradeShip,
  tradeSnapshot,
  type TradeScenario,
} from "./fixtures/trade-protection.js";

const POOL = (merchantPoolBp: number) => ({
  month: "1880-04",
  quota: 0,
  assigned: 0,
  shortfall: 0,
  shortfallBp: 0,
  merchantPoolBp,
});

const gbr = (s: CampaignSnapshot) => s.nations.get("GBR")!;
const fra = (s: CampaignSnapshot) => s.nations.get("FRA")!;
const raider = (id: string, over: Partial<Ship> = {}) =>
  tradeShip(id, "d-cp", { stationAssignment: "RAIDER", ...over }, "FRA");
const escort = (id: string) => tradeShip(id, "d-dd", { stationAssignment: "TRADE_PROTECTION" });

const escorted = (extra: Partial<TradeScenario> = {}): TradeScenario => ({
  gbrShips: [
    escort("e1"),
    tradeShip("e2", "d-dd"),
    tradeShip("e3", "d-dd"),
    tradeShip("e4", "d-dd"),
  ],
  ...extra,
});

const kinds = (result: ReturnType<typeof runTrade>, kind: string) =>
  result.eventLedger.all.filter((e) => e.body.kind === kind).map((e) => e.body as never);

const tradeDraws = (result: ReturnType<typeof runTrade>) =>
  result.randomLedger.all.filter((d) => d.streamId.startsWith("trade"));

describe("#997: monthly trade protection", () => {
  it("leaves the snapshot hash and ledgers unchanged when the ruleset section is absent", () => {
    const from = tradeSnapshot(escorted({ frashipsRaiders: [raider("r1")] }));
    const dormant = runTrade(from, [], null);
    expect(gbr(dormant.finalSnapshot).tradeProtection).toBeUndefined();
    expect(kinds(dormant, "TradeProtectionAssessed")).toEqual([]);
    expect(tradeDraws(dormant)).toEqual([]);
    const baseline = new MonthExecutor().execute(from, [], "trade-seed", new DiagnosticCollector());
    const digest = (value: unknown) => sha256Hex(canonicalSerialize(value));
    expect(digest(dormant.finalSnapshot)).toBe(digest(baseline.finalSnapshot));
    expect(digest(dormant.eventLedger.all)).toBe(digest(baseline.eventLedger.all));
    expect(digest(dormant.randomLedger.all)).toBe(digest(baseline.randomLedger.all));
  });

  it("assesses quota, assigned ships and no shortfall when enough escorts are on duty", () => {
    const result = runTrade(tradeSnapshot(escorted()));
    expect(gbr(result.finalSnapshot).tradeProtection).toMatchObject({
      quota: 1,
      assigned: 1,
      shortfall: 0,
      shortfallBp: 0,
      merchantPoolBp: 10_000,
    });
    expect(kinds(result, "TradeProtectionAssessed")).toHaveLength(1);
    expect(tradeDraws(result)).toEqual([]);
  });

  it("does not assess a nation that is not at war", () => {
    const result = runTrade(tradeSnapshot(escorted({ atWar: false })));
    expect(gbr(result.finalSnapshot).tradeProtection).toBeUndefined();
    expect(kinds(result, "TradeProtectionAssessed")).toEqual([]);
  });

  it("counts a shortfall and charges one shortfall-pressure draw when no escort is on duty", () => {
    const result = runTrade(
      tradeSnapshot({
        gbrShips: [tradeShip("e1", "d-dd"), tradeShip("e2", "d-dd")],
      }),
    );
    expect(gbr(result.finalSnapshot).tradeProtection).toMatchObject({
      quota: 1,
      assigned: 0,
      shortfall: 1,
      shortfallBp: 10_000,
      merchantPoolBp: 9_500,
      lastLossMonth: "1880-06",
    });
    const draws = tradeDraws(result);
    expect(draws).toHaveLength(1);
    expect(draws[0]!.phase).toBe("resolve_diplomacy");
    expect(kinds(result, "MerchantLossSuffered")).toEqual([
      expect.objectContaining({
        nationId: "GBR",
        lossBp: 500,
        poolBefore: 10_000,
        poolAfter: 9_500,
      }),
    ]);
  });

  it("loses merchant tonnage to an eligible raider and records a draw per raider", () => {
    const result = runTrade(
      tradeSnapshot(escorted({ frashipsRaiders: [raider("r2"), raider("r1")] })),
    );
    expect(gbr(result.finalSnapshot).tradeProtection!.merchantPoolBp).toBe(8_000);
    const draws = tradeDraws(result);
    expect(draws.map((d) => d.entityKey)).toEqual(draws.map((d) => d.entityKey).sort());
    expect(draws).toHaveLength(2);
    expect(draws.every((d) => d.outcome === "HIT")).toBe(true);
    const [loss] = kinds(result, "MerchantLossSuffered") as {
      raiderHits: number;
      lossBp: number;
    }[];
    expect(loss).toMatchObject({ raiderHits: 2, lossBp: 2_000 });
  });

  it("draws once per raider and victim when two active wars pair the same nations", () => {
    const single = tradeSnapshot(escorted({ frashipsRaiders: [raider("r2"), raider("r1")] }));
    const first = single.wars.wars[0]!;
    const doubled: CampaignSnapshot = {
      ...single,
      wars: { ...single.wars, wars: [{ ...first, id: "w2" }, first] },
    };
    const one = runTrade(single);
    const two = runTrade(doubled);
    const raiderKeys = (result: ReturnType<typeof runTrade>) =>
      tradeDraws(result)
        .filter((d) => d.reasonCode === "RAIDER_HIT")
        .map((d) => d.entityKey);
    expect(raiderKeys(two)).toEqual(["w1/r1/GBR/1880-05", "w1/r2/GBR/1880-05"]);
    expect(raiderKeys(two)).toEqual(raiderKeys(one));
    const loss = (result: ReturnType<typeof runTrade>) =>
      (kinds(result, "MerchantLossSuffered")[0] as { raiderHits: number }).raiderHits;
    expect(loss(two)).toBe(loss(one));
  });

  it("ignores raiders that are short range, ineligible hulls or not ACTIVE", () => {
    const shortRange = tradeDesign("d-sr", "protected_cruiser", { shortRange: true });
    const result = runTrade(
      tradeSnapshot(
        escorted({
          designs: [
            tradeDesign("d-dd", "destroyer"),
            tradeDesign("d-cp", "protected_cruiser"),
            shortRange,
          ],
          frashipsRaiders: [
            tradeShip("r1", "d-sr", { stationAssignment: "RAIDER" }, "FRA"),
            tradeShip("r2", "d-dd", { stationAssignment: "RAIDER" }, "FRA"),
            raider("r3", { readiness: "RESERVE" }),
          ],
        }),
      ),
    );
    expect(gbr(result.finalSnapshot).tradeProtection!.merchantPoolBp).toBe(10_000);
    expect(tradeDraws(result)).toEqual([]);
  });

  it("has no effect while the raider's nation blockades the victim", () => {
    const blockaded = runTrade(
      tradeSnapshot(escorted({ frashipsRaiders: [raider("r1")], blockade: "FRA_BLOCKADES_GBR" })),
    );
    expect(tradeDraws(blockaded)).toEqual([]);
    expect(gbr(blockaded.finalSnapshot).tradeProtection!.merchantPoolBp).toBe(10_000);
    const reverse = runTrade(
      tradeSnapshot(escorted({ frashipsRaiders: [raider("r1")], blockade: "GBR_BLOCKADES_FRA" })),
    );
    expect(gbr(reverse.finalSnapshot).tradeProtection!.merchantPoolBp).toBe(9_000);
  });

  it("raids the enemy too when the player's own raider is eligible", () => {
    const result = runTrade(
      tradeSnapshot(
        escorted({
          gbrShips: [
            escort("e1"),
            tradeShip("g1", "d-cp", { stationAssignment: "RAIDER" }),
            tradeShip("e3", "d-dd"),
            tradeShip("e4", "d-dd"),
          ],
        }),
      ),
    );
    expect(fra(result.finalSnapshot).tradeProtection!.merchantPoolBp).toBe(9_000);
    expect(gbr(result.finalSnapshot).tradeProtection!.merchantPoolBp).toBe(10_000);
  });

  it("recovers the pool in a month without losses and caps it at intact", () => {
    const damaged = runTrade(tradeSnapshot(escorted({ gbr: { tradeProtection: POOL(8_000) } })));
    expect(gbr(damaged.finalSnapshot).tradeProtection!.merchantPoolBp).toBe(8_200);
    const nearly = runTrade(tradeSnapshot(escorted({ gbr: { tradeProtection: POOL(9_900) } })));
    expect(gbr(nearly.finalSnapshot).tradeProtection!.merchantPoolBp).toBe(10_000);
  });

  it("raises unrest once losses reach the threshold, on the cadence", () => {
    const result = runTrade(
      tradeSnapshot(
        escorted({ gbr: { tradeProtection: POOL(8_000), unrest: SafeInt(3) } as never }),
      ),
    );
    expect(gbr(result.finalSnapshot).unrest).toBe(4);
    const calm = runTrade(
      tradeSnapshot(
        escorted({ gbr: { tradeProtection: POOL(10_000), unrest: SafeInt(3) } as never }),
      ),
    );
    expect(gbr(calm.finalSnapshot).unrest).toBe(3);
  });

  it("scales the monthly revenue entry by the merchant pool so the ledger reconciles", () => {
    const revenue = (pool: number | undefined) => {
      const result = runTrade(
        tradeSnapshot(
          escorted({
            gbr: {
              baseResources: SafeInt(4_000),
              ...(pool === undefined ? {} : { tradeProtection: POOL(pool) }),
            },
          }),
        ),
      );
      const entry = result.financialLedger.all.find(
        (e) => e.nationId === "GBR" && e.categoryId === "NAVAL_APPROPRIATION",
      )!;
      return {
        credit: Number(entry.credit),
        balance: Number(entry.newBalance) - Number(entry.previousBalance),
      };
    };
    const full = revenue(undefined);
    const half = revenue(5_000);
    expect(full.credit).toBeGreaterThan(0);
    expect(half.credit).toBe(Math.floor((full.credit * 7_500) / 10_000));
    expect(half.balance).toBe(half.credit);
  });

  it("draws identically for the same seed and differently for another seed", () => {
    const from = tradeSnapshot(
      escorted({
        frashipsRaiders: [raider("r1")],
      }),
    );
    const withRules = (seed: string) =>
      runTrade(from, [], { ...TRADE_RULES, raiderHitBp: 5_000, shortfallAmplifyBp: 1 }, seed);
    const a = tradeDraws(withRules("s1")).map((d) => [d.entityKey, d.draw, d.outcome]);
    const b = tradeDraws(withRules("s1")).map((d) => [d.entityKey, d.draw, d.outcome]);
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
    const draws = new Set(
      ["s1", "s2", "s3", "s4", "s5", "s6"].map((seed) => tradeDraws(withRules(seed))[0]!.draw),
    );
    expect(draws.size).toBeGreaterThan(1);
  });
});
