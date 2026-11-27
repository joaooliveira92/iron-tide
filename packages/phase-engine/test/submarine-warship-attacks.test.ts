import type { Ship } from "@bluewave/campaign";
import type { TradeProtectionRules } from "@bluewave/content-schema";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import {
  TRADE_RULES,
  gbrShips,
  runTrade,
  tradeDesign,
  tradeShip,
  tradeSnapshot,
  type TradeScenario,
} from "./fixtures/trade-protection.js";

const WARSHIP = {
  attackBp: 10_000,
  policyMultiplierBp: { FLEET_SUPPORT: 10_000, PRIZE_RULES: 10_000, UNRESTRICTED: 10_000 },
  screenReductionBp: 7000,
  sunkBp: 0,
  maxDamageBp: 4000,
  heavyHullTypes: ["dreadnought"],
  screenHullTypes: ["destroyer"],
};

const rulesWith = (
  warship: Partial<typeof WARSHIP> | undefined,
  threat: Partial<NonNullable<TradeProtectionRules["submarineThreat"]>> = {},
): TradeProtectionRules => ({
  ...TRADE_RULES,
  submarineThreat: {
    hullType: "submarine",
    quotaPerBoatBp: 5000,
    attackBp: 1,
    lossPerHitBp: 100,
    blockadeReductionBp: 9999,
    ...threat,
    ...(warship === undefined ? {} : { warshipAttack: { ...WARSHIP, ...warship } }),
  },
});

const DESIGNS = [
  tradeDesign("d-dd", "destroyer"),
  tradeDesign("d-dn", "dreadnought"),
  tradeDesign("d-ss", "submarine"),
  tradeDesign("d-amc", "armed_merchant_cruiser"),
  tradeDesign("d-dd-asw", "destroyer", { capabilities: [{ kind: "asw_attack", level: 2 }] }),
];

const boat = (id: string, over: Partial<Ship> = {}) => tradeShip(id, "d-ss", over, "FRA");
const heavy = (id: string, over: Partial<Ship> = {}) => tradeShip(id, "d-dn", over);

const scenario = (gbr: Ship[], fra: Ship[], extra: Partial<TradeScenario> = {}): TradeScenario => ({
  gbrShips: gbr,
  frashipsRaiders: fra,
  designs: DESIGNS,
  ...extra,
});

const run = (s: TradeScenario, rules: TradeProtectionRules | null) =>
  runTrade(tradeSnapshot(s), [], rules);

const warshipDraws = (result: ReturnType<typeof run>) =>
  result.randomLedger.all.filter((d) => d.streamId.startsWith("trade/submarine_warship"));

const attacks = (result: ReturnType<typeof run>) =>
  result.eventLedger.all.filter((e) => e.body.kind === "SubmarineWarshipAttacked");

const hitHash = (entityKey: string, chanceBp: number) =>
  sha256Hex(canonicalSerialize({ entityKey, chanceBp }));

const KEY = (boatId: string, victimId = "GBR") => `subw/w1/${boatId}/${victimId}/1880-06`;

describe("submarine warship attacks (#1158)", () => {
  describe("dormancy", () => {
    it("draws nothing without the block, with no boat, or with no eligible target", () => {
      const fleet = scenario([heavy("h1")], [boat("s1")]);
      expect(warshipDraws(run(fleet, rulesWith(undefined)))).toEqual([]);
      expect(warshipDraws(run(fleet, null))).toEqual([]);
      expect(warshipDraws(run(scenario([heavy("h1")], []), rulesWith({})))).toEqual([]);
      expect(
        warshipDraws(
          run(scenario([heavy("h1")], [boat("s1", { readiness: "MOTHBALLED" })]), rulesWith({})),
        ),
      ).toEqual([]);
      expect(
        warshipDraws(run(scenario([tradeShip("d1", "d-dd")], [boat("s1")]), rulesWith({}))),
      ).toEqual([]);
    });

    it("leaves the snapshot hash of a dormant month identical to a run without the block", () => {
      const withBlock = run(scenario([tradeShip("d1", "d-dd")], [boat("s1")]), rulesWith({}));
      const without = run(scenario([tradeShip("d1", "d-dd")], [boat("s1")]), rulesWith(undefined));
      expect(withBlock.finalSnapshot.nations.get("GBR")).toEqual(
        without.finalSnapshot.nations.get("GBR"),
      );
      expect(attacks(withBlock)).toEqual([]);
    });

    it("targets only active, operational, non-battle, non-interned heavy ships", () => {
      const ineligible = [
        heavy("h1", { readiness: "MOTHBALLED" }),
        heavy("h2", { isUnderConstruction: true }),
        heavy("h3", { inBattleId: "b1" }),
        heavy("h4", { availability: "UNAVAILABLE" }),
        heavy("h5", {
          internment: { sinceMonth: "1880-05", cause: "DAMAGE", readinessBefore: "ACTIVE" },
        }),
        tradeShip("h6", "d-dd"),
      ];
      expect(warshipDraws(run(scenario(ineligible, [boat("s1")]), rulesWith({})))).toEqual([]);
      const mixed = run(scenario([...ineligible, heavy("h7")], [boat("s1")]), rulesWith({}));
      expect(warshipDraws(mixed)[0]).toMatchObject({ outcome: "h7" });
    });
  });

  describe("draws", () => {
    it("takes the target and hit draws at chance 0 and no outcome draw without a hit", () => {
      const result = run(scenario([heavy("h1")], [boat("s1")]), rulesWith({ attackBp: 0 }));
      expect(warshipDraws(result).map((d) => [d.streamId, d.reasonCode, d.outcome])).toEqual([
        ["trade/submarine_warship_target", "SUBMARINE_WARSHIP_TARGET", "h1"],
        ["trade/submarine_warship_hit", "SUBMARINE_WARSHIP_HIT", "MISS"],
      ]);
      expect(warshipDraws(result)[0]!.entityKey).toBe(KEY("s1"));
      expect(warshipDraws(result).every((d) => d.phase === "resolve_diplomacy")).toBe(true);
      expect(attacks(result)).toEqual([]);
      expect(gbrShips(result.finalSnapshot).map((s) => s.hitPoints)).toEqual([100]);
    });

    it("draws the outcome only on a hit and damages the ship within the cap", () => {
      const result = run(
        scenario([heavy("h1")], [boat("s1")]),
        rulesWith({ screenReductionBp: 0 }),
      );
      expect(warshipDraws(result).map((d) => d.reasonCode)).toEqual([
        "SUBMARINE_WARSHIP_TARGET",
        "SUBMARINE_WARSHIP_HIT",
        "SUBMARINE_WARSHIP_OUTCOME",
      ]);
      const [event] = attacks(result);
      expect(event!.body).toMatchObject({
        kind: "SubmarineWarshipAttacked",
        nationId: "FRA",
        boatId: "s1",
        victimNationId: "GBR",
        victimShipId: "h1",
        month: "1880-06",
        chanceBp: 10_000,
        outcome: "DAMAGED",
      });
      const hp = gbrShips(result.finalSnapshot)[0]!.hitPoints;
      expect(hp).toBeLessThanOrEqual(100);
      expect(hp).toBeGreaterThanOrEqual(60);
    });

    it("removes a sunk ship from the fleet and emits a SUNK event", () => {
      const result = run(
        scenario([heavy("h1")], [boat("s1")]),
        rulesWith({ sunkBp: 10_000, screenReductionBp: 0 }),
      );
      expect(gbrShips(result.finalSnapshot)).toEqual([]);
      expect(attacks(result).map((e) => e.body)).toEqual([
        expect.objectContaining({ outcome: "SUNK", victimShipId: "h1", damageBp: 10_000 }),
      ]);
    });

    it("cannot target a ship sunk earlier that month, and boats damage one ship cumulatively", () => {
      const sunk = run(
        scenario([heavy("h1")], [boat("s1"), boat("s2")]),
        rulesWith({ sunkBp: 10_000, screenReductionBp: 0 }),
      );
      expect(warshipDraws(sunk).map((d) => d.entityKey)).toEqual([KEY("s1"), KEY("s1"), KEY("s1")]);

      const one = run(
        scenario([heavy("h1")], [boat("s1")]),
        rulesWith({ screenReductionBp: 0, maxDamageBp: 3000 }),
      );
      const two = run(
        scenario([heavy("h1")], [boat("s1"), boat("s2")]),
        rulesWith({ screenReductionBp: 0, maxDamageBp: 3000 }),
      );
      expect(attacks(two)).toHaveLength(2);
      expect(gbrShips(two.finalSnapshot)[0]!.hitPoints).toBeLessThan(
        gbrShips(one.finalSnapshot)[0]!.hitPoints,
      );
    });

    it("is identical for identical inputs and seed", () => {
      const s = scenario([heavy("h1"), heavy("h2")], [boat("s2"), boat("s1")]);
      const a = run(s, rulesWith({ screenReductionBp: 0 }));
      const b = run(s, rulesWith({ screenReductionBp: 0 }));
      expect(a.randomLedger.all).toEqual(b.randomLedger.all);
      expect(a.eventLedger.all).toEqual(b.eventLedger.all);
      expect(warshipDraws(a).map((d) => d.entityKey.split("/")[2])).toEqual([
        "s1",
        "s1",
        "s1",
        "s2",
        "s2",
        "s2",
      ]);
    });

    it("runs after the trade protection draws", () => {
      const result = run(
        scenario([heavy("h1"), tradeShip("p1", "d-dd")], [boat("s1")]),
        rulesWith({}, { attackBp: 10_000 }),
      );
      const streams = result.randomLedger.all.map((d) => d.streamId);
      const lastTrade = streams.lastIndexOf("trade/loss");
      const firstWarship = streams.findIndex((id) => id.startsWith("trade/submarine_warship"));
      expect(lastTrade).toBeGreaterThanOrEqual(0);
      expect(firstWarship).toBeGreaterThan(lastTrade);
    });
  });

  describe("chance inputs", () => {
    const chanceOf = (s: TradeScenario, rules = rulesWith({})) => {
      const [, hit] = warshipDraws(run(s, rules));
      return hit!.inputHash;
    };

    it("rises when a free destroyer moves onto trade protection", () => {
      const free = scenario([heavy("h1"), tradeShip("d1", "d-dd")], [boat("s1")]);
      const posted = scenario(
        [heavy("h1"), tradeShip("d1", "d-dd", { stationAssignment: "TRADE_PROTECTION" })],
        [boat("s1")],
      );
      expect(chanceOf(free)).toBe(hitHash(KEY("s1"), 3000));
      expect(chanceOf(posted)).toBe(hitHash(KEY("s1"), 10_000));
    });

    it("ignores blockade, anti-submarine capability and Q-ships", () => {
      const base = scenario([heavy("h1"), tradeShip("d1", "d-dd")], [boat("s1")]);
      const rules = rulesWith(
        {},
        { aswEscortReductionBp: 5000, qShipReductionBp: 5000, blockadeReductionBp: 9000 },
      );
      const expected = hitHash(KEY("s1"), 3000);
      expect(chanceOf(base, rules)).toBe(expected);
      expect(chanceOf({ ...base, blockade: "FRA_BLOCKADES_GBR" }, rules)).toBe(expected);
      const asw = scenario(
        [
          heavy("h1"),
          tradeShip("d1", "d-dd"),
          tradeShip("a1", "d-dd-asw", { stationAssignment: "TRADE_PROTECTION" }),
        ],
        [boat("s1")],
      );
      const plain = scenario(
        [
          heavy("h1"),
          tradeShip("d1", "d-dd"),
          tradeShip("a1", "d-dd", { stationAssignment: "TRADE_PROTECTION" }),
        ],
        [boat("s1")],
      );
      expect(chanceOf(asw, rules)).toBe(chanceOf(plain, rules));
      const qShip = scenario(
        [
          heavy("h1"),
          tradeShip("d1", "d-dd"),
          tradeShip("q1", "d-amc", { stationAssignment: "TRADE_PROTECTION" }),
        ],
        [boat("s1")],
      );
      expect(chanceOf(qShip, rules)).toBe(expected);
    });
  });
});
