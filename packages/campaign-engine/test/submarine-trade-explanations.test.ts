import type { SubmarineThreatRules } from "@bluewave/campaign";
import type { ExplanationTree } from "@bluewave/events";
import { describe, expect, it } from "vite-plus/test";
import {
  SUBMARINE_TRADE_FORMULA_VERSION,
  explainSubmarineTrade,
  submarineTradeAttackers,
  type SubmarineTradeAttacker,
  type SubmarineTradeShip,
} from "../src/submarine-trade-explanations.js";

const threat: SubmarineThreatRules = {
  hullType: "submarine",
  quotaPerBoatBp: 2500,
  attackBp: 1000,
  lossPerHitBp: 120,
  blockadeReductionBp: 8000,
  aswEscortReductionBp: 2000,
  qShipReductionBp: 5000,
  unrestricted: { chanceMultiplierBp: 20_000, incidentBp: 300 },
  fleetSupport: { chanceMultiplierBp: 5000, quotaMultiplierBp: 5000 },
};

const rules = {
  shortfallAmplifyBp: 5000,
  contributingHullTypes: ["destroyer", "amc"],
  amcHullType: "amc",
  submarineThreat: threat,
};

const designs = new Map([
  ["ss", { hullType: "submarine", normalizedSpeedUms: 1 }],
  ["dd", { hullType: "destroyer", normalizedSpeedUms: 1, aswLevel: 1 }],
  ["amc", { hullType: "amc", normalizedSpeedUms: 1 }],
]);

const ship = (id: string, designVersionId: string, trade = false): SubmarineTradeShip => ({
  id,
  designVersionId,
  readiness: "ACTIVE",
  isUnderConstruction: false,
  ...(trade ? { stationAssignment: "TRADE_PROTECTION" } : {}),
});

const attacker = (
  nationId: string,
  policy: SubmarineTradeAttacker["policy"],
  boats: number,
): SubmarineTradeAttacker => ({
  nationId,
  policy,
  ships: Array.from({ length: boats }, (_, index) => ship(`${nationId}-${String(index)}`, "ss")),
});

const base = {
  rules,
  victimId: "GBR",
  victimShortfallBp: 4000,
  victimShips: [ship("e1", "dd", true), ship("e2", "dd", true), ship("q1", "amc", true)],
  blockades: [],
  designs,
};

const child = (tree: ExplanationTree, id: string): ExplanationTree => {
  const found = tree.children?.find((entry) => entry.formulaId === id);
  if (found === undefined) throw new Error(`missing child ${id}`);
  return found;
};

describe("submarine trade explanation", () => {
  it("returns nothing without the submarine block or any enemy boat", () => {
    expect(
      explainSubmarineTrade({
        ...base,
        rules: { ...rules, submarineThreat: undefined },
        attackers: [attacker("FRA", "PRIZE_RULES", 1)],
      }),
    ).toBeUndefined();
    expect(explainSubmarineTrade({ ...base, attackers: [attacker("FRA", "PRIZE_RULES", 0)] })).toBe(
      undefined,
    );
  });

  it("lists every stage from base chance to the final chance for one attacker", () => {
    const explained = explainSubmarineTrade({
      ...base,
      attackers: [attacker("FRA", "UNRESTRICTED", 2)],
      blockades: [{ blockaderId: "FRA", blockadedNationId: "GBR" }],
    });
    const root = explained!.tree;
    expect(root.formulaId).toBe("submarine_trade");
    expect(root.formulaVersion).toBe(SUBMARINE_TRADE_FORMULA_VERSION);
    expect(root.result).toBe(2);
    const fra = child(root, "submarine_trade.attacker.FRA");
    expect(fra.inputs).toMatchObject({ nationId: "FRA", policy: "UNRESTRICTED", submarines: 2 });
    expect(fra.children?.map((entry) => [entry.formulaId, entry.result])).toEqual([
      ["submarine_trade.attacker.FRA.base", 1000],
      ["submarine_trade.attacker.FRA.shortfall", 3000],
      ["submarine_trade.attacker.FRA.policy", 6000],
      ["submarine_trade.attacker.FRA.cap", 6000],
      ["submarine_trade.attacker.FRA.blockade", 1200],
      ["submarine_trade.attacker.FRA.asw_escort", 768],
      ["submarine_trade.attacker.FRA.q_ship", 384],
      ["submarine_trade.attacker.FRA.incident", 300],
    ]);
    expect(fra.result).toBe(384);
    expect(explained!.chancesBp.get("FRA")).toBe(384);
  });

  it("records the reduction inputs the engine applied", () => {
    const explained = explainSubmarineTrade({
      ...base,
      attackers: [attacker("FRA", "PRIZE_RULES", 1)],
    });
    const fra = child(explained!.tree, "submarine_trade.attacker.FRA");
    expect(child(fra, "submarine_trade.attacker.FRA.asw_escort").inputs).toEqual({
      escorts: 2,
      reductionBp: 2000,
    });
    expect(child(fra, "submarine_trade.attacker.FRA.q_ship").inputs).toEqual({
      qShips: 1,
      reductionBp: 5000,
    });
    expect(child(fra, "submarine_trade.attacker.FRA.blockade").inputs).toEqual({
      blockaded: 0,
      reductionBp: 0,
    });
    expect(child(fra, "submarine_trade.attacker.FRA.policy").inputs).toEqual({
      policy: "PRIZE_RULES",
      multiplierBp: 10_000,
    });
    expect(fra.children?.map((entry) => entry.formulaId)).not.toContain(
      "submarine_trade.attacker.FRA.incident",
    );
  });

  it("explains the quota term with the fleet support weighting", () => {
    const explained = explainSubmarineTrade({
      ...base,
      attackers: [attacker("FRA", "FLEET_SUPPORT", 2), attacker("GER", "PRIZE_RULES", 2)],
    });
    const quota = child(explained!.tree, "submarine_trade.quota");
    expect(quota.inputs).toEqual({
      enemySubmarines: 4,
      fleetSupportSubmarines: 2,
      quotaPerBoatBp: 2500,
      quotaMultiplierBp: 5000,
    });
    expect(quota.result).toBe(1);
    expect(explained!.tree.children?.map((entry) => entry.formulaId)).toEqual([
      "submarine_trade.quota",
      "submarine_trade.attacker.FRA",
      "submarine_trade.attacker.GER",
    ]);
  });

  it("leaves out attackers without active submarines", () => {
    const explained = explainSubmarineTrade({
      ...base,
      attackers: [attacker("FRA", "PRIZE_RULES", 1), attacker("GER", "PRIZE_RULES", 0)],
    });
    expect([...explained!.chancesBp.keys()]).toEqual(["FRA"]);
  });
});

describe("submarine trade attackers", () => {
  const war = (
    id: string,
    attackers: string[],
    defenders: string[],
    status: "ACTIVE" | "ENDED" = "ACTIVE",
  ) => ({
    id,
    status,
    attackerSideMembers: attackers,
    defenderSideMembers: defenders,
  });
  const nation = (policy?: "UNRESTRICTED") => ({
    fleets: [{ ships: [ship("x", "ss")] }],
    ...(policy === undefined ? {} : { submarinePolicy: policy }),
  });
  const nations = new Map([
    ["FRA", nation("UNRESTRICTED")],
    ["GER", nation()],
    ["ITA", nation()],
  ]);

  it("collects each opponent once in id order, with policy and ships", () => {
    const attackers = submarineTradeAttackers(
      [
        war("w2", ["GBR"], ["GER", "FRA"]),
        war("w1", ["FRA"], ["GBR"]),
        war("w3", ["ITA"], ["GBR"], "ENDED"),
      ],
      nations,
      "GBR",
    );
    expect(attackers.map((entry) => [entry.nationId, entry.policy])).toEqual([
      ["FRA", "UNRESTRICTED"],
      ["GER", "PRIZE_RULES"],
    ]);
    expect(attackers[0]!.ships.map((entry) => entry.id)).toEqual(["x"]);
  });
});
