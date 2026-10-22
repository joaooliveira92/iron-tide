import { describe, it, expect } from "vite-plus/test";
import { RandomEngine } from "@bluewave/random";
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

const input = {
  state: buildGunneryState(),
  minutes: 1,
  observationTime: "1900-01-01T00:00:00.000Z",
  orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
};

describe("AC-11 gunnery-in-minute-advance (INC-4)", () => {
  it("no-regression: no gunnery batteries -> zero gunnery events and a byte-identical minute hash (absent == empty)", () => {
    const absent = advanceMinutes({ ...input }).hashes;
    const empty = advanceMinutes({ ...input, gunnery: [] }).hashes;
    expect(empty).toEqual(absent);
    const res = advanceMinutes(input);
    const gunneryEvents = res.results[0]!.events.filter((e) => e.eventType === "gunnery_salvo");
    expect(gunneryEvents).toHaveLength(0);
    expect(absent[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("with batteries the minute pipeline yields gunnery events included in the minute hash", () => {
    const res = advanceMinutes({
      ...input,
      engine: new RandomEngine("g1"),
      gunnery: [battery("d1")],
    });
    const minute = res.results[0]!;
    const gunneryEvents = minute.events.filter((e) => e.eventType === "gunnery_salvo");
    expect(gunneryEvents).toHaveLength(1);
    const gunneryEvent = gunneryEvents[0]!;
    expect(gunneryEvent.actorId).toBe("BAT-1");
    expect(gunneryEvent.targetId).toBe(`${BATTLE_ID}:d1`);
    expect(gunneryEvent.substep).toBe(2);

    const noGun = advanceMinutes(input).hashes[0]!;
    const withGun = res.hashes[0]!;
    expect(noGun).not.toBe(withGun);
  });

  it("resolveGunnery runs AFTER spotting in the DESIGN-38 pipeline (substep > spotting)", () => {
    const res = advanceMinutes({
      ...input,
      engine: new RandomEngine("g2"),
      gunnery: [battery("d1")],
    });
    const events = res.results[0]!.events;
    const spottingIdx = events.findIndex((e) => e.eventType === "resolve_sensors_spotting");
    const gunneryIdx = events.findIndex((e) => e.eventType === "gunnery_salvo");
    expect(spottingIdx).toBeGreaterThanOrEqual(0);
    expect(gunneryIdx).toBeGreaterThan(spottingIdx);
  });

  it("ammunition is consumed atomically across the gunnery stage and threaded into the next minute", () => {
    const res = advanceMinutes({
      ...input,
      minutes: 2,
      engine: new RandomEngine("g3"),
      gunnery: [battery("d1")],
    });
    const m1 = res.results[0]!;
    expect(m1.gunneryStates!["BAT-1"]!.ammunition.ARMOR_PIERCING).toBe(118);
    const m2 = res.results[1]!;
    expect(m2.gunneryStates!["BAT-1"]!.ammunition.ARMOR_PIERCING).toBe(116);
  });
});
