import { describe, it, expect } from "vite-plus/test";
import { RandomEngine } from "@bluewave/random";
import { canonicalEventOrder } from "@bluewave/combat/battleResolution";
import {
  neutralAccuracyFactors,
  neutralRateFactors,
  withGunneryStateHash,
  type GunneryBattery,
} from "@bluewave/combat/gunnery";
import { advanceMinutes } from "@bluewave/combat/simulation";
import { buildGunneryState } from "./ledger-order.test.js";

const BATTLE_ID = "battle-9";

function battery(targetAsset: string): GunneryBattery {
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

describe("AC-11 resolveGunnery pipeline order (INC-4)", () => {
  it("gunnery_salvo events sort after the spotting phase within each minute (§31 / step 8.5)", () => {
    const res = advanceMinutes({
      state: buildGunneryState(),
      minutes: 2,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
      engine: new RandomEngine("pipe"),
      gunnery: [battery("d1")],
    });
    for (const minute of res.results) {
      const gunneryIdx = minute.events.findIndex((e) => e.eventType === "gunnery_salvo");
      const spottingIdx = minute.events.findIndex(
        (e) => e.eventType === "resolve_sensors_spotting",
      );
      expect(gunneryIdx).toBeGreaterThan(spottingIdx);
      expect(minute.events).toEqual([...minute.events].sort(canonicalEventOrder));
    }
  });

  it("each enabled battery yields exactly one salvo event per minute (atomic per-minute firing)", () => {
    const res = advanceMinutes({
      state: buildGunneryState(),
      minutes: 1,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
      engine: new RandomEngine("pipe2"),
      gunnery: [battery("d1"), battery("d1")],
    });
    const gunneryEvents = res.results[0]!.events.filter((e) => e.eventType === "gunnery_salvo");
    expect(gunneryEvents).toHaveLength(2);
    expect(res.results[0]!.events).toEqual([...res.results[0]!.events].sort(canonicalEventOrder));
  });

  it("gunnery events carry the post-spotting substep (2) and priority (9)", () => {
    const res = advanceMinutes({
      state: buildGunneryState(),
      minutes: 1,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
      engine: new RandomEngine("pipe3"),
      gunnery: [battery("d1")],
    });
    const ge = res.results[0]!.events.find((e) => e.eventType === "gunnery_salvo")!;
    expect(ge.substep).toBe(2);
    expect(ge.eventPriority).toBe(9);
  });
});
