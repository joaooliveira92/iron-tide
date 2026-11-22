import type { CampaignSnapshot, Ship } from "@bluewave/campaign";
import type { TradeProtectionRules } from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import {
  TRADE_RULES,
  runTrade,
  tradeDesign,
  tradeShip,
  tradeSnapshot,
  type TradeScenario,
} from "./fixtures/trade-protection.js";

const WITH_SUBS: TradeProtectionRules = {
  ...TRADE_RULES,
  submarineThreat: {
    hullType: "submarine",
    quotaPerBoatBp: 5000,
    attackBp: 10_000,
    lossPerHitBp: 700,
    blockadeReductionBp: 9999,
  },
};

const WITH_PRESTIGE: TradeProtectionRules = {
  ...TRADE_RULES,
  shortfallPrestige: { thresholdBp: 5000, lossBp: 2000 },
};

const DESIGNS = [
  tradeDesign("d-dd", "destroyer"),
  tradeDesign("d-cp", "protected_cruiser"),
  tradeDesign("d-ss", "submarine"),
];

const gbr = (s: CampaignSnapshot) => s.nations.get("GBR")!;
const sub = (id: string, over: Partial<Ship> = {}) => tradeShip(id, "d-ss", over, "FRA");
const escort = (id: string) => tradeShip(id, "d-dd", { stationAssignment: "TRADE_PROTECTION" });

const scenario = (extra: Partial<TradeScenario> = {}): TradeScenario => ({
  gbrShips: [
    escort("e1"),
    tradeShip("e2", "d-dd"),
    tradeShip("e3", "d-dd"),
    tradeShip("e4", "d-dd"),
  ],
  designs: DESIGNS,
  ...extra,
});

const kinds = (result: ReturnType<typeof runTrade>, kind: string) =>
  result.eventLedger.all.filter((e) => e.body.kind === kind).map((e) => e.body as never);

const tradeDraws = (result: ReturnType<typeof runTrade>) =>
  result.randomLedger.all.filter((d) => d.streamId.startsWith("trade"));

describe("#1014: submarine threat to trade", () => {
  it("adds the enemy submarine term to the quota", () => {
    const base = runTrade(tradeSnapshot(scenario()), [], WITH_SUBS);
    const raided = runTrade(
      tradeSnapshot(scenario({ frashipsRaiders: [sub("s1"), sub("s2"), sub("s3")] })),
      [],
      WITH_SUBS,
    );
    expect(gbr(base.finalSnapshot).tradeProtection!.quota).toBe(1);
    expect(gbr(raided.finalSnapshot).tradeProtection!.quota).toBe(3);
  });

  it("ignores submarines under construction and not active", () => {
    const result = runTrade(
      tradeSnapshot(
        scenario({
          frashipsRaiders: [
            sub("s1", { isUnderConstruction: true }),
            sub("s2", { readiness: "MOTHBALLED" }),
          ],
        }),
      ),
      [],
      WITH_SUBS,
    );
    expect(gbr(result.finalSnapshot).tradeProtection!.quota).toBe(1);
    expect(tradeDraws(result)).toEqual([]);
  });

  it("does not add the term without the submarineThreat block", () => {
    const result = runTrade(
      tradeSnapshot(scenario({ frashipsRaiders: [sub("s1"), sub("s2"), sub("s3")] })),
    );
    expect(gbr(result.finalSnapshot).tradeProtection!.quota).toBe(1);
  });

  it("draws once per enemy submarine and loses the authored share per hit", () => {
    const result = runTrade(
      tradeSnapshot(scenario({ frashipsRaiders: [sub("s1"), sub("s2")] })),
      [],
      WITH_SUBS,
    );
    const draws = tradeDraws(result);
    expect(draws).toHaveLength(2);
    expect(draws.map((d) => d.reasonCode)).toEqual(["SUBMARINE_ATTACK", "SUBMARINE_ATTACK"]);
    expect(draws.every((d) => d.outcome === "HIT")).toBe(true);
    expect(kinds(result, "MerchantLossSuffered")).toEqual([
      expect.objectContaining({
        nationId: "GBR",
        submarineHits: 2,
        raiderHits: 0,
        pressureHit: false,
        lossBp: 1400,
        poolAfter: 8600,
      }),
    ]);
  });

  it("replaces the shortfall-pressure stand-in once the block is authored", () => {
    const noEscort: TradeScenario = {
      gbrShips: [tradeShip("e1", "d-dd"), tradeShip("e2", "d-dd")],
      designs: DESIGNS,
    };
    const stand = runTrade(tradeSnapshot(noEscort));
    expect(tradeDraws(stand).map((d) => d.reasonCode)).toEqual(["SHORTFALL_PRESSURE"]);
    const replaced = runTrade(tradeSnapshot(noEscort), [], WITH_SUBS);
    expect(tradeDraws(replaced)).toEqual([]);
    expect(gbr(replaced.finalSnapshot).tradeProtection!.shortfall).toBe(1);
  });

  it("sharply reduces the attack when the attacker blockades the victim, and only then", () => {
    const blockaded = runTrade(
      tradeSnapshot(scenario({ frashipsRaiders: [sub("s1")], blockade: "FRA_BLOCKADES_GBR" })),
      [],
      WITH_SUBS,
    );
    expect(tradeDraws(blockaded).map((d) => d.outcome)).toEqual(["MISS"]);
    const reverse = runTrade(
      tradeSnapshot(scenario({ frashipsRaiders: [sub("s1")], blockade: "GBR_BLOCKADES_FRA" })),
      [],
      WITH_SUBS,
    );
    expect(tradeDraws(reverse).map((d) => d.outcome)).toEqual(["HIT"]);
  });

  describe("anti-submarine escorts (#1070)", () => {
    const WITH_ASW: TradeProtectionRules = {
      ...WITH_SUBS,
      submarineThreat: { ...WITH_SUBS.submarineThreat!, aswEscortReductionBp: 10_000 },
    };
    const aswDesigns = [
      ...DESIGNS,
      tradeDesign("d-dd-asw", "destroyer", { capabilities: [{ kind: "asw_attack", level: 2 }] }),
    ];
    const aswEscort = (id: string, over: Partial<Ship> = {}) =>
      tradeShip(id, "d-dd-asw", { stationAssignment: "TRADE_PROTECTION", ...over });
    const attacked = (gbrShips: Ship[], rules: TradeProtectionRules) =>
      tradeDraws(
        runTrade(
          tradeSnapshot({ gbrShips, designs: aswDesigns, frashipsRaiders: [sub("s1")] }),
          [],
          rules,
        ),
      ).map((d) => d.outcome);

    it("negates the attack at a full reduction when a protecting escort is anti-submarine capable", () => {
      expect(attacked([aswEscort("e1")], WITH_ASW)).toEqual(["MISS"]);
    });

    it("leaves the attack unchanged for escorts without anti-submarine capability", () => {
      expect(attacked([escort("e1")], WITH_ASW)).toEqual(["HIT"]);
    });

    it("ignores capable ships that are not on trade protection duty or not active", () => {
      expect(
        attacked(
          [
            aswEscort("e1", { stationAssignment: "EXERCISE" }),
            aswEscort("e2", { readiness: "RESERVE" }),
          ],
          WITH_ASW,
        ),
      ).toEqual(["HIT"]);
    });

    it("changes nothing when the reduction is not authored", () => {
      expect(attacked([aswEscort("e1")], WITH_SUBS)).toEqual(["HIT"]);
    });
  });

  describe("Q-ships (#1071)", () => {
    const WITH_Q: TradeProtectionRules = {
      ...WITH_SUBS,
      submarineThreat: { ...WITH_SUBS.submarineThreat!, qShipReductionBp: 10_000 },
    };
    const qDesigns = [...DESIGNS, tradeDesign("d-amc", "armed_merchant_cruiser")];
    const amc = (id: string, over: Partial<Ship> = {}) =>
      tradeShip(id, "d-amc", { stationAssignment: "TRADE_PROTECTION", ...over });
    const attacked = (gbrShips: Ship[], rules: TradeProtectionRules) =>
      tradeDraws(
        runTrade(
          tradeSnapshot({ gbrShips, designs: qDesigns, frashipsRaiders: [sub("s1")] }),
          [],
          rules,
        ),
      ).map((d) => d.outcome);

    it("negates the attack at a full reduction when an armed merchant cruiser protects trade", () => {
      expect(attacked([amc("q1")], WITH_Q)).toEqual(["MISS"]);
    });

    it("ignores armed merchant cruisers that are not on trade protection duty or not active", () => {
      expect(
        attacked(
          [amc("q1", { stationAssignment: "EXERCISE" }), amc("q2", { readiness: "RESERVE" })],
          WITH_Q,
        ),
      ).toEqual(["HIT"]);
    });

    it("leaves other escorts unchanged and changes nothing when not authored", () => {
      expect(attacked([escort("e1")], WITH_Q)).toEqual(["HIT"]);
      expect(attacked([amc("q1")], WITH_SUBS)).toEqual(["HIT"]);
    });
  });

  it("draws identically for the same seed", () => {
    const run = (seed: string) =>
      runTrade(
        tradeSnapshot(scenario({ frashipsRaiders: [sub("s1")] })),
        [],
        { ...WITH_SUBS, submarineThreat: { ...WITH_SUBS.submarineThreat!, attackBp: 5000 } },
        seed,
      ).randomLedger.all.map((d) => d.draw);
    expect(run("a")).toEqual(run("a"));
  });
});

describe("#1014: prestige for a trade protection shortfall", () => {
  const short: TradeScenario = {
    gbrShips: [tradeShip("e1", "d-dd"), tradeShip("e2", "d-dd")],
    designs: DESIGNS,
  };

  it("charges the authored proportional loss when the shortfall reaches the threshold", () => {
    const result = runTrade(tradeSnapshot(short), [], WITH_PRESTIGE);
    expect(Number(gbr(result.finalSnapshot).prestige)).toBe(40);
    expect(kinds(result, "PrestigeChanged")).toEqual([
      expect.objectContaining({
        nationId: "GBR",
        reasonCode: "TRADE_SHORTFALL",
        ruleKind: "PROPORTIONAL_LOSS",
      }),
    ]);
  });

  it("keeps the trade pool and unrest results of the same month", () => {
    const result = runTrade(tradeSnapshot(short), [], WITH_PRESTIGE);
    expect(gbr(result.finalSnapshot).tradeProtection!.merchantPoolBp).toBe(9_500);
  });

  it("charges nothing with no shortfall, below the threshold or without the block", () => {
    const covered = runTrade(tradeSnapshot(scenario()), [], WITH_PRESTIGE);
    expect(kinds(covered, "PrestigeChanged")).toEqual([]);
    const dormant = runTrade(tradeSnapshot(short));
    expect(kinds(dormant, "PrestigeChanged")).toEqual([]);
  });

  it("compares the shortfall ratio with the threshold", () => {
    const partial: TradeScenario = {
      gbrShips: [
        escort("e0"),
        ...Array.from({ length: 11 }, (_, i) => tradeShip(`x${String(i)}`, "d-dd")),
      ],
      designs: DESIGNS,
    };
    const at = (thresholdBp: number) =>
      runTrade(tradeSnapshot(partial), [], {
        ...WITH_PRESTIGE,
        shortfallPrestige: { thresholdBp, lossBp: 2000 },
      });
    expect(gbr(at(6666).finalSnapshot).tradeProtection!.shortfallBp).toBe(6666);
    expect(Number(gbr(at(6666).finalSnapshot).prestige)).toBe(40);
    expect(Number(gbr(at(6667).finalSnapshot).prestige)).toBe(50);
  });

  it("is not charged to a nation that is not at war", () => {
    const result = runTrade(tradeSnapshot({ ...short, atWar: false }), [], WITH_PRESTIGE);
    expect(kinds(result, "PrestigeChanged")).toEqual([]);
  });
});
