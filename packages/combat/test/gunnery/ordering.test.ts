import { describe, it, expect } from "vite-plus/test";
import { RandomEngine } from "@bluewave/random";
import {
  resolveGunnery,
  gunneryEventOrder,
  neutralAccuracyFactors,
  neutralRateFactors,
  withGunneryStateHash,
  type GunneryBattery,
} from "../../src/gunnery/index.js";
import type { TacticalContact } from "../../src/contact/lifecycle.js";

const BATTLE_ID = "battlex";

function contact(assetId: string): TacticalContact {
  return {
    contactId: `${BATTLE_ID}:${assetId}`,
    battleId: BATTLE_ID,
    assetId,
    sideId: "DEFENDER",
    estimatedIdentity: "Battleship",
    position: [0, 0],
    course: 270,
    speed: 10_000,
    confidence: 10_000,
    observationTime: "1900-01-01T00:00:00.000Z",
    source: "visual",
    uncertainty: 0,
    lastUpdateMinute: 1,
    stale: false,
    sources: ["visual"],
  };
}

function battery(id: string, ship: string, targetAsset: string): GunneryBattery {
  return {
    id,
    ownerShipId: ship,
    sideId: "ATTACKER",
    mountOrdinal: 1,
    commandSource: "CENTRAL",
    baseReloadMs: 2_000,
    salvoCount: 2,
    preferredType: "ARMOR_PIERCING",
    rateFactors: neutralRateFactors(),
    accuracyFactors: neutralAccuracyFactors(5_000),
    state: withGunneryStateHash({
      batteryId: id,
      ownerShipId: ship,
      gunDefinitionId: "GUN-305-45",
      mountDefinitionId: "MNT-305-TWIN",
      targetContactId: `${BATTLE_ID}:${targetAsset}`,
      acquisitionProgressBp: 8_000,
      rangeEstimateUm: 10_000_000_000,
      rangeUncertaintyUm: 150_000_000,
      fireControlSolutionQualityBp: 8_000,
      ammunition: { ARMOR_PIERCING: 120, COMMON: 80, HIGH_EXPLOSIVE: 40 },
      fireMode: "NORMAL",
      reloadProgressMs: 2_000,
      straddleState: null,
      damageState: null,
      aaEligibilityState: null,
      lastSalvoMinute: -1,
      lastSalvoSubstep: 0,
      rulesetVersion: "gunnery_ruleset_v1",
      formulaVersion: "gunnery_formula_v1",
    }),
  };
}

describe("AC-9 gunnery canonical ordering (DESIGN-39 §31, INC-4)", () => {
  it("sorts by shooting ship id, then battery id, then target contact (§31 2-5)", () => {
    // Declared in a deliberately scrambled order to prove insertion order is irrelevant.
    const batteries = [
      battery("BAT-B", "SHIP-ZULU", "d1"),
      battery("BAT-A", "SHIP-ALPHA", "d2"),
      battery("BAT-C", "SHIP-ALPHA", "d1"),
      battery("BAT-D", "SHIP-MIKE", "d0"),
    ];
    const out = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 5,
      batteries,
      contacts: [contact("d0"), contact("d1"), contact("d2")],
      engine: new RandomEngine("seed-order"),
    });
    expect(out.salvos).toHaveLength(4);
    const sorted = [...out.salvos].sort(gunneryEventOrder);
    const keys = sorted.map((r) => [r.shooterId, r.batteryId, r.targetContactId]);
    // SHIP-ALPHA (BAT-A, BAT-C) < SHIP-MIKE (BAT-D) < SHIP-ZULU (BAT-B)
    expect(keys[0]).toEqual(["SHIP-ALPHA", "BAT-A", `${BATTLE_ID}:d2`]);
    expect(keys[1]).toEqual(["SHIP-ALPHA", "BAT-C", `${BATTLE_ID}:d1`]);
    expect(keys[2]).toEqual(["SHIP-MIKE", "BAT-D", `${BATTLE_ID}:d0`]);
    expect(keys[3]).toEqual(["SHIP-ZULU", "BAT-B", `${BATTLE_ID}:d1`]);
  });

  it("gunneryEventOrder is a strict total order (antisymmetric)", () => {
    const a = battery("BAT-1", "SHIP-A", "d1");
    const b = battery("BAT-1", "SHIP-A", "d1");
    const ra = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 1,
      batteries: [a],
      contacts: [contact("d1")],
      engine: new RandomEngine("s1"),
    }).salvos[0]!;
    const rb = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 1,
      batteries: [b],
      contacts: [contact("d1")],
      engine: new RandomEngine("s1"),
    }).salvos[0]!;
    expect(gunneryEventOrder(ra, rb)).toBe(0);
  });

  it("orders by minute/substep first", () => {
    const a = battery("BAT-1", "SHIP-A", "d1");
    const b = battery("BAT-2", "SHIP-A", "d1");
    const ra = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 2,
      batteries: [a],
      contacts: [contact("d1")],
      engine: new RandomEngine("ss"),
    }).salvos[0]!;
    const rb = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 1,
      batteries: [b],
      contacts: [contact("d1")],
      engine: new RandomEngine("ss"),
    }).salvos[0]!;
    expect(gunneryEventOrder(ra, rb)).toBeGreaterThan(0); // minute 2 sorts after minute 1
  });
});
