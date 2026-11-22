import type { CampaignSnapshot } from "@bluewave/campaign";
import type { TradeProtectionRules } from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import {
  TRADE_RULES,
  runTrade,
  tradeDesign,
  tradeEnvelope,
  tradeShip,
  tradeSnapshot,
} from "./fixtures/trade-protection.js";

const WITH_POSTURE: TradeProtectionRules = {
  ...TRADE_RULES,
  submarineThreat: {
    hullType: "submarine",
    quotaPerBoatBp: 5000,
    attackBp: 1000,
    lossPerHitBp: 700,
    blockadeReductionBp: 9999,
    unrestricted: { chanceMultiplierBp: 20_000, incidentBp: 2000 },
  },
};

const setPolicy = (policy: string, nationId = "GBR") =>
  ({ type: "SetSubmarinePolicy", nationId, policy }) as never;

const snapshot = () =>
  tradeSnapshot({
    gbrShips: [tradeShip("a", "d-dd")],
    designs: [tradeDesign("d-dd", "destroyer"), tradeDesign("d-ss", "submarine")],
    frashipsRaiders: [tradeShip("s1", "d-ss", {}, "FRA")],
  });

const policyOf = (s: CampaignSnapshot, id = "GBR") => s.nations.get(id)!.submarinePolicy;

const withFraPolicy = (from: CampaignSnapshot, policy: "UNRESTRICTED"): CampaignSnapshot => {
  const nations = new Map(from.nations);
  nations.set("FRA", { ...nations.get("FRA")!, submarinePolicy: policy });
  return { ...from, nations };
};

const subDraws = (result: ReturnType<typeof runTrade>) =>
  result.randomLedger.all.filter((d) => d.reasonCode === "SUBMARINE_ATTACK");

describe("#1071: SetSubmarinePolicy command", () => {
  it("sets the unrestricted posture and clears it back to prize rules", () => {
    const from = snapshot();
    const set = runTrade(from, [tradeEnvelope(setPolicy("UNRESTRICTED"), from)], WITH_POSTURE);
    expect(policyOf(set.finalSnapshot)).toBe("UNRESTRICTED");
    const armed = set.finalSnapshot;
    const cleared = runTrade(armed, [tradeEnvelope(setPolicy("PRIZE_RULES"), armed)], WITH_POSTURE);
    expect(cleared.finalSnapshot.nations.get("GBR")).not.toHaveProperty("submarinePolicy");
  });

  it("rejects a policy outside the two offered", () => {
    const from = snapshot();
    const result = runTrade(from, [tradeEnvelope(setPolicy("FLEET_SUPPORT"), from)], WITH_POSTURE);
    expect(policyOf(result.finalSnapshot)).toBeUndefined();
    const rejected = result.commandLedger.all.find((o) => o.type === "rejected");
    expect(rejected?.type === "rejected" && rejected.diagnostic.code).toBe(
      "INVALID_COMMAND_PAYLOAD",
    );
  });

  it("rejects an unknown nation", () => {
    const from = snapshot();
    const result = runTrade(
      from,
      [tradeEnvelope(setPolicy("UNRESTRICTED", "XXX"), from)],
      WITH_POSTURE,
    );
    const rejected = result.commandLedger.all.find((o) => o.type === "rejected");
    expect(rejected?.type === "rejected" && rejected.diagnostic.code).toBe("NATION_NOT_FOUND");
  });

  it("refuses when the unrestricted block is not authored", () => {
    const from = snapshot();
    const result = runTrade(from, [tradeEnvelope(setPolicy("UNRESTRICTED"), from)]);
    expect(policyOf(result.finalSnapshot)).toBeUndefined();
    expect(result.collector.all.map((d) => d.code)).toContain("SUBMARINE_POLICY_DORMANT");
  });
});

describe("#1071: unrestricted warfare in the submarine attack draw", () => {
  it("leaves the ledger and the final snapshot byte-identical while the policy is absent", () => {
    const from = snapshot();
    const plain = runTrade(from, [], WITH_POSTURE);
    const authoredOff: TradeProtectionRules = {
      ...WITH_POSTURE,
      submarineThreat: { ...WITH_POSTURE.submarineThreat!, unrestricted: undefined },
    };
    const off = runTrade(from, [], authoredOff);
    expect(off.randomLedger.all).toEqual(plain.randomLedger.all);
    expect(JSON.stringify(off.finalSnapshot.nations.get("GBR"))).toBe(
      JSON.stringify(plain.finalSnapshot.nations.get("GBR")),
    );
  });

  it("scales the attacking nation's chance and turns a miss into a hit on the same draw", () => {
    const from = snapshot();
    const reference = subDraws(runTrade(from, [], WITH_POSTURE))[0]!;
    expect(reference.draw).toBeGreaterThan(5);
    const tuned: TradeProtectionRules = {
      ...WITH_POSTURE,
      shortfallAmplifyBp: 1,
      submarineThreat: { ...WITH_POSTURE.submarineThreat!, attackBp: reference.draw - 1 },
    };
    const prize = subDraws(runTrade(from, [], tuned))[0]!;
    const unrestricted = subDraws(runTrade(withFraPolicy(from, "UNRESTRICTED"), [], tuned))[0]!;
    expect(prize.outcome).toBe("MISS");
    expect(unrestricted.draw).toBe(prize.draw);
    expect(unrestricted.outcome).toBe("HIT");
  });

  it("does not scale an attacker that has not chosen the posture", () => {
    const from = snapshot();
    const reference = subDraws(runTrade(from, [], WITH_POSTURE))[0]!;
    const tuned: TradeProtectionRules = {
      ...WITH_POSTURE,
      shortfallAmplifyBp: 1,
      submarineThreat: { ...WITH_POSTURE.submarineThreat!, attackBp: reference.draw - 1 },
    };
    const gbrUnrestricted = new Map(from.nations);
    gbrUnrestricted.set("GBR", { ...from.nations.get("GBR")!, submarinePolicy: "UNRESTRICTED" });
    const result = runTrade({ ...from, nations: gbrUnrestricted }, [], tuned);
    expect(subDraws(result)[0]!.outcome).toBe("MISS");
  });
});
