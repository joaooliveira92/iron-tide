import {
  tradeProtectionRevenueBp,
  type CampaignSnapshot,
  type Ship,
  type WarDeclaration,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor, type MonthResult } from "@bluewave/phase-engine";
import { describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign } from "../src/production-pack.js";
import { fleetManagementOptions } from "../src/replay-corpus/corpus.js";

const PLAYER = "germany";
const RAIDER_NATION = "france";
const MONTHS = 24;

const { state } = compileProductionCampaign();
const options = fleetManagementOptions(PLAYER);
const { tradeProtection: rules, ...withoutTrade } = options;

const war: WarDeclaration = {
  id: "war-trade-1",
  attackerSideId: "side-a",
  defenderSideId: "side-d",
  attackerSideMembers: [RAIDER_NATION],
  defenderSideMembers: [PLAYER],
  attackerWarScore: 0,
  defenderWarScore: 0,
  attackerId: RAIDER_NATION,
  defenderId: PLAYER,
  startDate: "1880-01",
  status: "ACTIVE",
};

const atWar: CampaignSnapshot = {
  ...state.snapshot,
  wars: { ...state.snapshot.wars, wars: [war] },
};

function run(from: CampaignSnapshot, trade: boolean, seed: string): MonthResult {
  return new MonthExecutor().execute(from, [], seed, new DiagnosticCollector(), undefined, {
    ...(trade ? options : withoutTrade),
    playerNationId: PLAYER,
  });
}

const bodies = (result: MonthResult, kind: string) =>
  result.eventLedger.all.filter((e) => e.eventType === kind).map((e) => e.body);

const revenueCredit = (result: MonthResult): number =>
  result.financialLedger.all
    .filter((entry) => entry.phaseId === "monthly_revenue" && entry.nationId === PLAYER)
    .reduce((sum, entry) => sum + entry.credit, 0);

const withPool = (from: CampaignSnapshot, merchantPoolBp: number): CampaignSnapshot => {
  const nations = new Map(from.nations);
  nations.set(PLAYER, {
    ...from.nations.get(PLAYER)!,
    tradeProtection: {
      month: "1879-12",
      quota: 5,
      assigned: 0,
      shortfall: 5,
      shortfallBp: 10_000,
      merchantPoolBp,
    },
  });
  return { ...from, nations };
};

describe("1880 production trade protection (#1037)", () => {
  it("has the production pack carry trade-protection rules", () => {
    expect(rules).toBeDefined();
  });

  it("assesses the at-war player with no escorts as fully short in the first month", () => {
    const result = run(atWar, true, "production-trade-1");
    expect(bodies(result, "TradeProtectionAssessed")).toEqual([
      {
        kind: "TradeProtectionAssessed",
        nationId: PLAYER,
        month: "1880-01",
        quota: 5,
        assigned: 0,
        shortfall: 5,
        shortfallBp: 10_000,
      },
    ]);
    expect(result.finalSnapshot.nations.get(PLAYER)?.tradeProtection?.merchantPoolBp).toBe(10_000);
  });

  it("loses and recovers merchant pool over a war, recording each loss and assessment", () => {
    let snapshot = atWar;
    const losses: Array<{ poolBefore: number; poolAfter: number }> = [];
    let assessments = 0;
    for (let month = 1; month <= MONTHS; month += 1) {
      const result = run(snapshot, true, `production-trade-${String(month)}`);
      assessments += bodies(result, "TradeProtectionAssessed").length;
      for (const body of bodies(result, "MerchantLossSuffered")) {
        const loss = body as { poolBefore: number; poolAfter: number };
        losses.push({ poolBefore: loss.poolBefore, poolAfter: loss.poolAfter });
      }
      snapshot = {
        ...result.finalSnapshot,
        turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt.ONE),
      };
    }
    expect(assessments).toBe(MONTHS);
    expect(losses.length).toBeGreaterThan(0);
    for (const loss of losses) expect(loss.poolAfter).toBeLessThan(loss.poolBefore);
  });

  it("scales monthly revenue by the merchant pool through the authored sensitivity", () => {
    const damaged = withPool(atWar, 5000);
    const scaled = revenueCredit(run(damaged, true, "production-trade-rev"));
    const unscaled = revenueCredit(run(damaged, false, "production-trade-rev"));
    const bp = tradeProtectionRevenueBp(rules!, 5000);
    expect(bp).toBeLessThan(10_000);
    expect(scaled).toBe(Math.floor((unscaled * bp) / 10_000));
    expect(scaled).toBeLessThan(unscaled);
  });

  it("authors the raider interception block for 1880", () => {
    expect(rules!.raiderInterception).toBeDefined();
  });

  it("interdicts, engages and resolves a player raider with authored chances", () => {
    const cruiser = [...state.snapshot.designs.values()].find(
      (design) =>
        design.hullType !== rules!.amcHullType &&
        rules!.raiderHullTypes.includes(design.hullType) &&
        design.shortRange !== true,
    );
    expect(cruiser).toBeDefined();
    const german = state.snapshot.nations.get(PLAYER)!;
    const raider: Ship = {
      ...german.fleets.flatMap((fleet) => fleet.ships).find((ship) => ship.readiness === "ACTIVE")!,
      designVersionId: cruiser!.designVersionId,
      stationAssignment: "RAIDER",
    };
    const nations = new Map(state.snapshot.nations);
    nations.set(PLAYER, {
      ...german,
      fleets: german.fleets.map((fleet) => ({
        ...fleet,
        ships: fleet.ships.map((ship) => (ship.id === raider.id ? raider : ship)),
      })),
    });
    const raiding: CampaignSnapshot = {
      ...atWar,
      nations,
      wars: {
        ...atWar.wars,
        wars: [
          {
            ...war,
            attackerSideMembers: [PLAYER],
            defenderSideMembers: [RAIDER_NATION],
            attackerId: PLAYER,
            defenderId: RAIDER_NATION,
          },
        ],
      },
    };

    const engaged: unknown[] = [];
    const interned: unknown[] = [];
    const draws = new Set<string>();
    for (let seed = 1; seed <= 200 && interned.length === 0; seed += 1) {
      const result = run(raiding, true, `production-raider-${String(seed)}`);
      engaged.push(...bodies(result, "RaiderEngaged"));
      interned.push(...bodies(result, "RaiderInterned"));
      for (const entry of result.randomLedger.all) {
        if (entry.streamId.startsWith("trade/") && entry.entityKey.includes(raider.id)) {
          draws.add(entry.streamId);
        }
      }
    }
    expect(draws.has("trade/interception")).toBe(true);
    expect(draws.has("trade/internment")).toBe(true);
    expect(draws.has("trade/engagement")).toBe(true);
    expect(engaged.length).toBeGreaterThan(0);
    for (const body of engaged as Array<{
      nationId: string;
      encounter: string;
      chanceBp: number;
    }>) {
      expect(body.nationId).toBe(PLAYER);
      expect(body.encounter).toBe("INTERCEPTION");
      expect(body.chanceBp).toBeGreaterThanOrEqual(rules!.raiderInterception!.interceptBaseBp);
      expect(body.chanceBp).toBeLessThanOrEqual(10_000);
    }
    expect(interned.length).toBeGreaterThan(0);
  }, 240_000);

  it("leaves revenue untouched while the merchant pool is full", () => {
    const full = withPool(atWar, 10_000);
    expect(revenueCredit(run(full, true, "production-trade-rev"))).toBe(
      revenueCredit(run(full, false, "production-trade-rev")),
    );
  });
});
