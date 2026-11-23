import type { CampaignSnapshot, DiplomaticRelation } from "@bluewave/campaign";
import type { TradeProtectionRules } from "@bluewave/content-schema";
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
    attackBp: 5000,
    lossPerHitBp: 700,
    blockadeReductionBp: 9999,
    unrestricted: { chanceMultiplierBp: 20_000, incidentBp: 10_000 },
  },
};

const neutral: DiplomaticRelation = {
  nationA: "FRA",
  nationB: "GBR",
  relation: "neutral",
  tension: 3,
  nap: false,
  since: "1880-01",
};

const snapshot = (policy: "UNRESTRICTED" | undefined, atWar: boolean): CampaignSnapshot => {
  const from = tradeSnapshot({
    gbrShips: [tradeShip("a", "d-dd")],
    designs: [tradeDesign("d-dd", "destroyer"), tradeDesign("d-ss", "submarine")],
    frashipsRaiders: [tradeShip("s1", "d-ss", {}, "FRA"), tradeShip("s2", "d-ss", {}, "FRA")],
    atWar,
  });
  const nations = new Map(from.nations);
  if (policy !== undefined) {
    nations.set("FRA", { ...nations.get("FRA")!, submarinePolicy: policy });
  }
  return {
    ...from,
    nations,
    politics: { relations: atWar ? [] : [neutral], shells: {} },
  };
};

const prestigeEvents = (result: ReturnType<typeof runTrade>, nationId: string) =>
  result.eventLedger.all.flatMap((e) =>
    e.body.kind === "PrestigeChanged" && e.body.nationId === nationId ? [e.body] : [],
  );

describe("#1101: unrestricted submarine warfare costs its owner no prestige", () => {
  it.each([
    ["incidents with neutrals", false],
    ["sinkings at war", true],
  ])("leaves the owner's prestige and ledger as under prize rules: %s", (_label, atWar) => {
    const prize = runTrade(snapshot(undefined, atWar), [], RULES);
    const unrestricted = runTrade(snapshot("UNRESTRICTED", atWar), [], RULES);

    const drew = unrestricted.randomLedger.all.filter(
      (d) => d.reasonCode === "SUBMARINE_INCIDENT" || d.streamId.startsWith("trade"),
    );
    expect(drew.length).toBeGreaterThan(0);
    if (!atWar) {
      expect(unrestricted.finalSnapshot.politics.relations[0]!.tension).toBe(4);
    }

    expect(unrestricted.finalSnapshot.nations.get("FRA")!.prestige).toBe(
      prize.finalSnapshot.nations.get("FRA")!.prestige,
    );
    expect(prestigeEvents(unrestricted, "FRA")).toEqual(prestigeEvents(prize, "FRA"));
    expect(prestigeEvents(unrestricted, "FRA")).toEqual([]);
  });
});
