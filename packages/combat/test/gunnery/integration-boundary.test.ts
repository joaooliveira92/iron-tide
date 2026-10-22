import { describe, it, expect } from "vite-plus/test";
import { RandomEngine } from "@bluewave/random";
import { BattleLedger, canonicalEventOrder } from "@bluewave/combat/battleResolution";
import { BattleResolver } from "@bluewave/combat/battleResolution";
import { StrengthCalculator } from "@bluewave/combat/battleResolution";
import {
  resolveGunnery,
  neutralAccuracyFactors,
  neutralRateFactors,
  withGunneryStateHash,
  type GunneryBattery,
} from "@bluewave/combat/gunnery";
import { advanceMinutes } from "@bluewave/combat/simulation";
import { buildGunneryState } from "./ledger-order.test.js";

const BATTLE_ID = "battle-9";

function battery(): GunneryBattery {
  return {
    id: "BAT-1",
    ownerShipId: "a1",
    sideId: "ATTACKER",
    mountOrdinal: 1,
    commandSource: "CENTRAL",
    baseReloadMs: 2_000,
    salvoCount: 2,
    preferredType: "ARMOR_PIERCING",
    rateFactors: neutralRateFactors(),
    accuracyFactors: neutralAccuracyFactors(5_000),
    state: withGunneryStateHash({
      batteryId: "BAT-1",
      ownerShipId: "a1",
      gunDefinitionId: "GUN-305-45",
      mountDefinitionId: "MNT-305-TWIN",
      targetContactId: `${BATTLE_ID}:d1`,
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

describe("AC-11 integration boundary (INC-4)", () => {
  it("BattleResolver and StrengthCalculator remain exported and unmodified", () => {
    expect(typeof BattleResolver).toBe("function");
    expect(typeof StrengthCalculator).toBe("function");
  });

  it("gunnery events flow through BattleLedger + canonicalEventOrder into a deterministic minute hash", () => {
    const res = advanceMinutes({
      state: buildGunneryState(),
      minutes: 1,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
      engine: new RandomEngine("ib"),
      gunnery: [battery()],
    });
    const events = res.results[0]!.events;
    const gunneryEvents = events.filter((e) => e.eventType === "gunnery_salvo");
    expect(gunneryEvents).toHaveLength(1);
    expect(events).toEqual([...events].sort(canonicalEventOrder));
    expect(res.hashes[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("resolveGunnery returns ledger-ready BattleEvents that BattleLedger appends with a hash", () => {
    const out = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 2,
      batteries: [battery()],
      contacts: [{ contactId: `${BATTLE_ID}:d1`, confidence: 10_000 }] as any,
      engine: new RandomEngine("ib2"),
    });
    expect(out.events).toHaveLength(1);
    const ledger = new BattleLedger();
    for (const e of out.events) ledger.append(e);
    const sorted = ledger.sorted();
    expect(sorted[0]!.eventType).toBe("gunnery_salvo");
    expect(sorted[0]!.eventHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
