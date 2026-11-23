import { tradeDutyDesigns, type Ship, type SubmarinePolicy } from "@bluewave/campaign";
import { explainSubmarineTrade, submarineTradeAttackers } from "@bluewave/campaign-engine";
import type { TradeProtectionRules } from "@bluewave/content-schema";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import {
  TRADE_RULES,
  runTrade,
  tradeDesign,
  tradeShip,
  tradeSnapshot,
} from "./fixtures/trade-protection.js";

const RULES: TradeProtectionRules = {
  ...TRADE_RULES,
  submarineThreat: {
    hullType: "submarine",
    quotaPerBoatBp: 5000,
    attackBp: 1000,
    lossPerHitBp: 700,
    blockadeReductionBp: 5000,
    aswEscortReductionBp: 2000,
    qShipReductionBp: 3000,
    unrestricted: { chanceMultiplierBp: 15_000, incidentBp: 200 },
    fleetSupport: { chanceMultiplierBp: 5000, quotaMultiplierBp: 5000 },
  },
};

const DESIGNS = [
  tradeDesign("d-dd", "destroyer"),
  tradeDesign("d-dd-asw", "destroyer", { capabilities: [{ kind: "asw_attack", level: 2 }] }),
  tradeDesign("d-ss", "submarine"),
  tradeDesign("d-amc", "armed_merchant_cruiser"),
];

const onDuty = (id: string, design: string): Ship =>
  tradeShip(id, design, { stationAssignment: "TRADE_PROTECTION" });

const SUBMARINE_DRAW_REASON = "SUBMARINE_ATTACK";

describe("#1143: the submarine trade explanation equals the chance the monthly draw used", () => {
  const policies: readonly SubmarinePolicy[] = ["PRIZE_RULES", "UNRESTRICTED", "FLEET_SUPPORT"];
  const blockades = [undefined, "FRA_BLOCKADES_GBR"] as const;

  for (const policy of policies) {
    for (const blockade of blockades) {
      it(`${policy} ${blockade === undefined ? "unblockaded" : "blockaded"}`, () => {
        const from = tradeSnapshot({
          gbrShips: [
            onDuty("e1", "d-dd-asw"),
            onDuty("e2", "d-dd-asw"),
            onDuty("q1", "d-amc"),
            tradeShip("e3", "d-dd"),
          ],
          frashipsRaiders: [tradeShip("s1", "d-ss", {}, "FRA"), tradeShip("s2", "d-ss", {}, "FRA")],
          designs: DESIGNS,
          ...(blockade === undefined ? {} : { blockade }),
          fra: { submarinePolicy: policy },
        });
        const result = runTrade(from, [], RULES);
        const final = result.finalSnapshot;
        const gbr = final.nations.get("GBR")!;
        const explained = explainSubmarineTrade({
          rules: RULES,
          victimId: "GBR",
          victimShortfallBp: Number(gbr.tradeProtection!.shortfallBp),
          victimShips: gbr.fleets.flatMap((fleet) => fleet.ships),
          attackers: submarineTradeAttackers(final.wars.wars, final.nations, "GBR"),
          blockades: final.wars.blockadeState,
          designs: tradeDutyDesigns(final.designs),
        });

        const chanceBp = explained!.chancesBp.get("FRA")!;
        const draws = result.randomLedger.all.filter((d) => d.reasonCode === SUBMARINE_DRAW_REASON);
        expect(draws).toHaveLength(2);
        for (const draw of draws) {
          expect(draw.inputHash).toBe(
            sha256Hex(canonicalSerialize({ entityKey: draw.entityKey, chanceBp })),
          );
        }
        expect(gbr.tradeProtection!.quota).toBeGreaterThan(0);
      });
    }
  }
});
