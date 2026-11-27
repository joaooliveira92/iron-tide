import type { Ship, SubmarinePolicy, SubmarineThreatRules } from "@bluewave/campaign";
import type { TradeProtectionRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import type { WarshipAttackRules } from "../src/submarineWarshipRules.js";
import {
  TRADE_RULES,
  gbrShips,
  runTrade,
  tradeDesign,
  tradeShip,
  tradeSnapshot,
  type TradeScenario,
} from "./fixtures/trade-protection.js";

const BASE_THREAT: SubmarineThreatRules = {
  hullType: "submarine",
  quotaPerBoatBp: 0,
  attackBp: 0,
  lossPerHitBp: 0,
  blockadeReductionBp: 9999,
};

const WARSHIP: WarshipAttackRules = {
  attackBp: 10_000,
  policyMultiplierBp: { FLEET_SUPPORT: 16_000, PRIZE_RULES: 10_000, UNRESTRICTED: 5000 },
  screenReductionBp: 0,
  sunkBp: 0,
  maxDamageBp: 4000,
  heavyHullTypes: ["dreadnought"],
  screenHullTypes: ["destroyer"],
};

function rulesWith(warship?: Partial<WarshipAttackRules>): TradeProtectionRules {
  const threat: SubmarineThreatRules & { readonly warshipAttack?: WarshipAttackRules } =
    warship === undefined
      ? BASE_THREAT
      : { ...BASE_THREAT, warshipAttack: { ...WARSHIP, ...warship } };
  return { ...TRADE_RULES, submarineThreat: threat };
}

const DESIGNS = [
  tradeDesign("d-dd", "destroyer"),
  tradeDesign("d-dn", "dreadnought"),
  tradeDesign("d-ss", "submarine"),
];

const heavy = (id: string, over: Partial<Ship> = {}) => tradeShip(id, "d-dn", over);
const boat = (id: string) => tradeShip(id, "d-ss", {}, "FRA");
const destroyer = (id: string, over: Partial<Ship> = {}) => tradeShip(id, "d-dd", over);

const scenario = (extra: Partial<TradeScenario> = {}): TradeScenario => ({
  gbrShips: [heavy("h1")],
  frashipsRaiders: [boat("s1")],
  designs: DESIGNS,
  ...extra,
});

type Run = ReturnType<typeof runTrade>;
const warshipDraws = (result: Run, family?: string) =>
  result.randomLedger.all.filter((d) => d.streamId.startsWith(family ?? "trade/submarine_warship"));
const warshipEvents = (result: Run) =>
  result.eventLedger.all
    .filter((e) => e.body.kind === "SubmarineWarshipAttacked")
    .map((e) => e.body as never as Record<string, unknown>);

const run = (s: TradeScenario, rules: TradeProtectionRules, seed?: string): Run =>
  runTrade(tradeSnapshot(s), [], rules, seed);

function chanceOf(result: Run): number {
  const entry = warshipDraws(result, "trade/submarine_warship_hit")[0]!;
  for (let chance = 0; chance <= 10_000; chance += 1) {
    for (const policy of ["FLEET_SUPPORT", "PRIZE_RULES", "UNRESTRICTED"] as const) {
      for (const screenRatioBp of [0, 2500, 5000, 7500, 10_000]) {
        const hash = sha256Hex(
          canonicalSerialize({
            entityKey: entry.entityKey,
            chanceBp: chance,
            policy,
            screenRatioBp,
            areaId: "a-1",
          }),
        );
        if (hash === entry.inputHash) return chance;
      }
    }
  }
  return -1;
}

describe("#1137: submarine warship attacks", () => {
  describe("dormancy", () => {
    it("takes no draw and writes nothing without the block", () => {
      const result = run(scenario(), rulesWith());
      expect(warshipDraws(result)).toEqual([]);
      expect(warshipEvents(result)).toEqual([]);
    });

    it("takes no draw without an active boat", () => {
      const result = run(scenario({ frashipsRaiders: [] }), rulesWith({}));
      expect(warshipDraws(result)).toEqual([]);
    });

    it("takes no draw when a boat is not active", () => {
      const sleeping = tradeShip("s1", "d-ss", { readiness: "MOTHBALLED" }, "FRA");
      const result = run(scenario({ frashipsRaiders: [sleeping] }), rulesWith({}));
      expect(warshipDraws(result)).toEqual([]);
    });

    it("takes no draw at peace", () => {
      const result = run(scenario({ atWar: false }), rulesWith({}));
      expect(warshipDraws(result)).toEqual([]);
    });

    it.each([
      ["mothballed", { readiness: "MOTHBALLED" as const }],
      ["under construction", { isUnderConstruction: true }],
      ["in battle", { inBattleId: "b1" }],
      ["unavailable", { availability: "UNAVAILABLE" as const }],
    ])("does not target a %s ship", (_label, over) => {
      const result = run(scenario({ gbrShips: [heavy("h1", over)] }), rulesWith({}));
      expect(warshipDraws(result)).toEqual([]);
    });

    it("does not target a non-heavy hull", () => {
      const result = run(scenario({ gbrShips: [destroyer("d1")] }), rulesWith({}));
      expect(warshipDraws(result)).toEqual([]);
    });
  });

  describe("draws", () => {
    it("takes target and hit draws at chance 0 and no outcome draw", () => {
      const result = run(scenario(), rulesWith({ attackBp: 0 }));
      expect(warshipDraws(result, "trade/submarine_warship_target")).toHaveLength(1);
      expect(warshipDraws(result, "trade/submarine_warship_hit")).toHaveLength(1);
      expect(warshipDraws(result, "trade/submarine_warship_outcome")).toHaveLength(0);
      expect(warshipEvents(result)).toEqual([]);
    });

    it("uses the documented key and reason codes", () => {
      const result = run(scenario(), rulesWith({}));
      const hit = warshipDraws(result, "trade/submarine_warship_hit")[0]!;
      expect(hit.entityKey).toMatch(/^subw\/w1\/s1\/GBR\/\d{4}-\d{2}$/);
      expect(hit.reasonCode).toBe("SUBMARINE_WARSHIP_HIT");
      expect(hit.phase).toBe("resolve_diplomacy");
      expect(warshipDraws(result, "trade/submarine_warship_target")[0]!.reasonCode).toBe(
        "SUBMARINE_WARSHIP_TARGET",
      );
      expect(warshipDraws(result, "trade/submarine_warship_outcome")[0]!.reasonCode).toBe(
        "SUBMARINE_WARSHIP_OUTCOME",
      );
    });

    it("damages the target and emits one event per hit", () => {
      const result = run(scenario(), rulesWith({ sunkBp: 0, maxDamageBp: 4000 }));
      const events = warshipEvents(result);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        nationId: "GBR",
        attackerNationId: "FRA",
        shipId: "h1",
        areaId: "a-1",
        policy: "PRIZE_RULES",
        chanceBp: 10_000,
        outcome: "DAMAGED",
      });
      const after = gbrShips(result.finalSnapshot).find((s) => s.id === "h1")!;
      expect(after.hitPoints).toBe(events[0]!.hitPointsAfter);
      expect(after.hitPoints).toBeLessThanOrEqual(100);
    });

    it("is identical for the same inputs and seed", () => {
      const a = run(scenario(), rulesWith({ attackBp: 5000 }), "seed-x");
      const b = run(scenario(), rulesWith({ attackBp: 5000 }), "seed-x");
      expect(b.randomLedger.all).toEqual(a.randomLedger.all);
      expect(b.eventLedger.all).toEqual(a.eventLedger.all);
      expect(canonicalSerialize(b.finalSnapshot)).toBe(canonicalSerialize(a.finalSnapshot));
    });
  });

  describe("chance", () => {
    const screened = (stations: boolean): TradeScenario =>
      scenario({
        gbrShips: [
          heavy("h1"),
          destroyer("d1", stations ? { stationAssignment: "TRADE_PROTECTION" } : {}),
        ],
      });

    it("rises when a free destroyer moves onto trade protection", () => {
      const rules = rulesWith({ attackBp: 5000, screenReductionBp: 8000 });
      const free = chanceOf(run(screened(false), rules));
      const posted = chanceOf(run(screened(true), rules));
      expect(free).toBe(1000);
      expect(posted).toBe(5000);
    });

    it("is not changed by blockade", () => {
      const rules = rulesWith({ attackBp: 5000 });
      const plain = chanceOf(run(scenario(), rules));
      const blockaded = chanceOf(run(scenario({ blockade: "FRA_BLOCKADES_GBR" }), rules));
      expect(blockaded).toBe(plain);
    });

    it("is not changed by trade protection escorts", () => {
      const rules = rulesWith({ attackBp: 5000 });
      const plain = chanceOf(run(scenario(), rules));
      const escorted = chanceOf(
        run(
          scenario({
            gbrShips: [
              heavy("h1"),
              destroyer("e1", { stationAssignment: "TRADE_PROTECTION" }),
              destroyer("e2", { stationAssignment: "TRADE_PROTECTION" }),
            ],
          }),
          rules,
        ),
      );
      expect(escorted).toBe(plain);
    });

    it("follows the policy ladder", () => {
      const rules = rulesWith({ attackBp: 1000 });
      const chance = (policy: SubmarinePolicy) =>
        chanceOf(run(scenario({ fra: { submarinePolicy: policy } }), rules));
      expect(chance("FLEET_SUPPORT")).toBe(1600);
      expect(chance("PRIZE_RULES")).toBe(1000);
      expect(chance("UNRESTRICTED")).toBe(500);
    });
  });

  describe("consequences", () => {
    it("removes a sunk ship and does not target it again", () => {
      const result = run(
        scenario({ frashipsRaiders: [boat("s1"), boat("s2")] }),
        rulesWith({ sunkBp: 10_000 }),
      );
      expect(gbrShips(result.finalSnapshot).some((s) => s.id === "h1")).toBe(false);
      expect(warshipDraws(result, "trade/submarine_warship_hit")).toHaveLength(1);
      expect(warshipEvents(result).map((e) => e.outcome)).toEqual(["SUNK"]);
    });

    it("lets two boats wear one ship down cumulatively", () => {
      const result = run(
        scenario({ frashipsRaiders: [boat("s1"), boat("s2")] }),
        rulesWith({ sunkBp: 0, maxDamageBp: 10_000 }),
      );
      const events = warshipEvents(result);
      expect(events).toHaveLength(2);
      expect(events[1]!.hitPointsAfter as number).toBeLessThan(events[0]!.hitPointsAfter as number);
    });

    it("removes a ship damaged to zero hit points", () => {
      const result = run(
        scenario({ gbrShips: [heavy("h1", { hitPoints: SafeInt(1) })] }),
        rulesWith({ sunkBp: 0, maxDamageBp: 10_000 }),
      );
      const [event] = warshipEvents(result);
      const present = gbrShips(result.finalSnapshot).some((s) => s.id === "h1");
      expect(present).toBe(event!.hitPointsAfter !== 0);
      expect(event!.outcome).toBe(present ? "DAMAGED" : "SUNK");
    });
  });
});
