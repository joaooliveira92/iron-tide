import type { SubmarinePolicy, TradeProtectionRules } from "@bluewave/campaign";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import {
  submarineTradeExplanation,
  type SubmarineTradeReportInput,
} from "./submarineTradeReport.js";

const rules: TradeProtectionRules = {
  fleetShareBp: 2500,
  resourcesPerRequiredShip: 100,
  contributingHullTypes: ["destroyer"],
  raiderHullTypes: ["protected_cruiser"],
  amcHullType: "armed_merchant_cruiser",
  amcMinSpeedUms: 4_115_552,
  raiderHitBp: 1500,
  shortfallAmplifyBp: 5000,
  lossPerHitBp: 300,
  pressureChanceBp: 3000,
  pressureLossBp: 200,
  recoveryBpPerMonth: 100,
  revenueSensitivityBp: 5000,
  unrestThresholdBp: 1000,
  unrestCadenceMonths: 3,
  unrestStep: 1,
  submarineThreat: {
    hullType: "submarine",
    quotaPerBoatBp: 5000,
    attackBp: 1000,
    lossPerHitBp: 700,
    blockadeReductionBp: 5000,
  },
};

const ship = (id: string, designVersionId: string, stationAssignment?: string) => ({
  id,
  designVersionId,
  readiness: "ACTIVE",
  isUnderConstruction: false,
  ...(stationAssignment === undefined ? {} : { stationAssignment }),
});

const chanceBp = 1000 + 2500;
const drawFor = (shipId: string, chance = chanceBp, victim = "GBR") => {
  const entityKey = `sub/w1/${shipId}/${victim}/1880-03`;
  return {
    entityKey,
    reasonCode: "SUBMARINE_ATTACK",
    inputHash: sha256Hex(canonicalSerialize({ entityKey, chanceBp: chance })),
  };
};

const input = (over: Partial<SubmarineTradeReportInput> = {}): SubmarineTradeReportInput => ({
  rules,
  playerNationId: "GBR",
  shortfallBp: 5000,
  nations: new Map<
    string,
    {
      fleets: { ships: ReturnType<typeof ship>[] }[];
      submarinePolicy?: SubmarinePolicy;
    }
  >([
    ["GBR", { fleets: [{ ships: [ship("e1", "dd", "TRADE_PROTECTION")] }] }],
    ["FRA", { fleets: [{ ships: [ship("s1", "ss"), ship("s2", "ss")] }] }],
  ]),
  wars: [
    { id: "w1", status: "ACTIVE", attackerSideMembers: ["FRA"], defenderSideMembers: ["GBR"] },
  ],
  blockades: [],
  designs: new Map([
    ["dd", { hullType: "destroyer", normalizedSpeedUms: 1 }],
    ["ss", { hullType: "submarine", normalizedSpeedUms: 1 }],
  ]),
  randomDecisions: [drawFor("s1"), drawFor("s2")],
  ...over,
});

describe("submarine trade report explanation", () => {
  it("returns the tree when every draw used the recomputed chance", () => {
    const tree = submarineTradeExplanation(input());
    expect(tree?.formulaId).toBe("submarine_trade");
    expect(tree?.children?.map((child) => child.result)).toEqual([1, 3500]);
  });

  it("returns nothing when a draw used a different chance than the recomputed one", () => {
    expect(
      submarineTradeExplanation(
        input({ randomDecisions: [drawFor("s1"), drawFor("s2", chanceBp + 1)] }),
      ),
    ).toBeUndefined();
  });

  it("returns nothing when a recorded draw has no recomputed counterpart", () => {
    expect(submarineTradeExplanation(input({ randomDecisions: [drawFor("s1")] }))).toBeUndefined();
  });

  it("ignores draws against other victims", () => {
    const tree = submarineTradeExplanation(
      input({ randomDecisions: [drawFor("s1"), drawFor("s2"), drawFor("s9", 1, "FRA")] }),
    );
    expect(tree).toBeDefined();
  });

  describe("with a second attacker whose chance differs", () => {
    const blockadedChanceBp = 1750;
    const twoAttackers = (randomDecisions: SubmarineTradeReportInput["randomDecisions"]) =>
      input({
        wars: [
          {
            id: "w1",
            status: "ACTIVE",
            attackerSideMembers: ["FRA", "ITA"],
            defenderSideMembers: ["GBR"],
          },
        ],
        nations: new Map([
          ["GBR", { fleets: [{ ships: [ship("e1", "dd", "TRADE_PROTECTION")] }] }],
          ["FRA", { fleets: [{ ships: [ship("s1", "ss"), ship("s2", "ss")] }] }],
          ["ITA", { fleets: [{ ships: [ship("t1", "ss")] }] }],
        ]),
        blockades: [{ blockaderId: "ITA", blockadedNationId: "GBR" }],
        randomDecisions,
      });

    it("returns nothing when a draw matches another attacker's chance but not its own", () => {
      expect(
        submarineTradeExplanation(
          twoAttackers([
            drawFor("s1", blockadedChanceBp),
            drawFor("s2"),
            drawFor("t1", blockadedChanceBp),
          ]),
        ),
      ).toBeUndefined();
    });

    it("returns the tree when each draw matches its own attacker's chance", () => {
      expect(
        submarineTradeExplanation(
          twoAttackers([drawFor("s1"), drawFor("s2"), drawFor("t1", blockadedChanceBp)]),
        ),
      ).toBeDefined();
    });
  });

  it("returns nothing without rules, without the submarine block or without draws", () => {
    expect(submarineTradeExplanation(input({ rules: undefined }))).toBeUndefined();
    expect(
      submarineTradeExplanation(input({ rules: { ...rules, submarineThreat: undefined } })),
    ).toBeUndefined();
    expect(submarineTradeExplanation(input({ randomDecisions: [] }))).toBeUndefined();
  });
});
