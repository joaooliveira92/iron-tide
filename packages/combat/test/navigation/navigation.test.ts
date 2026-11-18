import { describe, expect, it } from "vite-plus/test";
import { RandomEngine, RandomLedger } from "@bluewave/random";
import type { TacticalBattleState } from "@bluewave/combat/tactical";
import {
  createDefaultDamageControlResource,
  type DamageControlContext,
} from "@bluewave/combat/damage";
import { advanceMinute, advanceMinutes, type UnitOrders } from "@bluewave/combat/simulation";
import {
  applyNavigation,
  INITIAL_MACHINERY_STATE,
  type NavigationContext,
  type NavigationRules,
  type NavigationShipInput,
} from "@bluewave/combat/navigation";
import { buildTestState } from "../simulation/advance.test.js";

const OBSERVATION = "1900-01-01T00:00:00.000Z";
const FULL = 30_000;

const RULES: NavigationRules = {
  sectionVersion: 1,
  fouling: {
    cruiseSpeedPercent: 70,
    classes: {
      OIL: { gratesFouledOnsetMinutes: 9, stokersExhaustedOnsetMinutes: 18, recoveryMinutes: 20 },
      COAL: { gratesFouledOnsetMinutes: 3, stokersExhaustedOnsetMinutes: 6, recoveryMinutes: 8 },
      VTE: { gratesFouledOnsetMinutes: 2, stokersExhaustedOnsetMinutes: 4, recoveryMinutes: 6 },
    },
  },
  breakdown: {
    baseChancePpm: 0,
    priorityChancePpm: 0,
    maxChancePpm: 1_000_000,
    repairMinutes: 4,
    repairSpeedCapPercent: 50,
  },
  vibration: { thresholdKnots: 25, gunneryMultiplierBp: 9_000 },
};

const BREAKS: NavigationRules = {
  ...RULES,
  breakdown: { ...RULES.breakdown, baseChancePpm: 1_000_000 },
};

function ship(overrides: Partial<NavigationShipInput> = {}): NavigationShipInput {
  return { shipId: "a1", machineryClass: "COAL", enginePriorityBp: 0, ...overrides };
}

function context(
  overrides: Partial<NavigationContext> & { rules?: NavigationRules } = {},
): NavigationContext {
  return { rules: RULES, ships: [ship()], ...overrides };
}

function stateAt(speedBp: number): TacticalBattleState {
  const base = buildTestState();
  const a1 = (base.movementStates ?? {})["a1"]!;
  return {
    ...base,
    movementStates: {
      ...base.movementStates,
      a1: { ...a1, currentSpeed: speedBp, orderedSpeed: speedBp },
    },
  };
}

function orders(speedBp: number): Record<string, UnitOrders> {
  return { a1: { orderedHeading: 90, orderedSpeedBp: speedBp } };
}

function run(minutes: number, speedBp: number, nav: NavigationContext, engine?: RandomEngine) {
  return advanceMinutes({
    state: stateAt(speedBp),
    minutes,
    observationTime: OBSERVATION,
    orders: orders(speedBp),
    navigation: nav,
    ...(engine === undefined ? {} : { engine }),
  });
}

describe("navigation machinery (#937)", () => {
  it("is dormant without a navigation context: results carry no navigation output", () => {
    const withoutKey = advanceMinutes({
      state: stateAt(FULL),
      minutes: 3,
      observationTime: OBSERVATION,
      orders: orders(FULL),
    });
    const withUndefined = advanceMinutes({
      state: stateAt(FULL),
      minutes: 3,
      observationTime: OBSERVATION,
      orders: orders(FULL),
      navigation: undefined,
    });
    expect(withUndefined.hashes).toEqual(withoutKey.hashes);
    expect(withoutKey.results.every((r) => r.navigation === undefined)).toBe(true);
  });

  it("fouls the grates then exhausts the stokers: -1 kn then -2 kn total, not additive", () => {
    const result = run(8, FULL, context());
    const speeds = result.results.map((r) => r.movementStates["a1"]!.currentSpeed);
    const fouling = result.results.map((r) => r.navigation!.machinery["a1"]!.fouling);
    expect(fouling[0]).toBe("CLEAN");
    expect(fouling).toContain("GRATES_FOULED");
    expect(fouling.at(-1)).toBe("STOKERS_EXHAUSTED");
    expect(Math.min(...speeds)).toBe(FULL - 2_000);
    expect(speeds.at(-1)).toBe(FULL - 2_000);
    const grates = result.results.find(
      (r) => r.navigation?.machinery["a1"]?.fouling === "GRATES_FOULED",
    )!;
    expect(grates.navigation!.shipRecords[0]!.reasonCodes).toEqual(["GRATES_FOULED"]);
    expect(grates.navigation!.shipRecords[0]!.attainableMaxBp).toBe(FULL - 1_000);
  });

  it("explains each reduction with a reason-coded node", () => {
    const result = run(8, FULL, context());
    const last = result.results.at(-1)!.navigation!;
    const tree = last.explanations["a1"]!;
    expect(tree.result).toBe(FULL - 2_000);
    expect(tree.children?.map((c) => c.inputs["reasonCode"])).toEqual(["STOKERS_EXHAUSTED"]);
  });

  it("senses oil slower than coal slower than VTE", () => {
    const exhaustedAt = (machineryClass: "OIL" | "COAL" | "VTE"): number => {
      const result = run(30, FULL, context({ ships: [ship({ machineryClass })] }));
      return result.results.findIndex(
        (r) => r.navigation!.machinery["a1"]!.fouling === "STOKERS_EXHAUSTED",
      );
    };
    const oil = exhaustedAt("OIL");
    const coal = exhaustedAt("COAL");
    const vte = exhaustedAt("VTE");
    expect(vte).toBeGreaterThanOrEqual(0);
    expect(vte).toBeLessThan(coal);
    expect(coal).toBeLessThan(oil);
  });

  it("recovers one level per recovery interval at cruise speed, slower than onset", () => {
    const worn = {
      a1: {
        ...INITIAL_MACHINERY_STATE,
        fouling: "STOKERS_EXHAUSTED" as const,
        fullSpeedMinutes: 6,
      },
    };
    const result = run(17, 15_000, context({ machinery: worn }));
    const levels = result.results.map((r) => r.navigation!.machinery["a1"]!.fouling);
    expect(levels[6]).toBe("STOKERS_EXHAUSTED");
    expect(levels[7]).toBe("GRATES_FOULED");
    expect(levels[14]).toBe("GRATES_FOULED");
    expect(levels[15]).toBe("CLEAN");
  });

  it("drains accrued full-speed minutes of a clean ship at cruise speed", () => {
    const warm = { a1: { ...INITIAL_MACHINERY_STATE, fullSpeedMinutes: 2 } };
    const result = run(8, 15_000, context({ machinery: warm }));
    const last = result.results.at(-1)!.navigation!.machinery["a1"]!;
    expect(last.fouling).toBe("CLEAN");
    expect(last.fullSpeedMinutes).toBe(0);
    expect(result.results[6]!.navigation!.machinery["a1"]!.fullSpeedMinutes).toBe(2);
  });

  it("holds the counters between cruise and full speed", () => {
    const worn = {
      a1: { ...INITIAL_MACHINERY_STATE, fouling: "GRATES_FOULED" as const, fullSpeedMinutes: 3 },
    };
    const result = run(10, 22_000, context({ machinery: worn }));
    for (const r of result.results) {
      expect(r.navigation!.machinery["a1"]).toEqual(worn["a1"]);
    }
  });

  it("is dormant at slow speed: a clean ship never fouls", () => {
    const result = run(20, 10_000, context());
    expect(result.results.every((r) => r.navigation!.machinery["a1"]!.fouling === "CLEAN")).toBe(
      true,
    );
  });

  it("draws breakdown only at full speed, on stream navigation.breakdown keyed by ship, with a reason code", () => {
    const ledger = new RandomLedger();
    run(2, 10_000, context({ randomLedger: ledger }), new RandomEngine("seed"));
    expect(ledger.all).toHaveLength(0);
    run(2, FULL, context({ randomLedger: ledger }), new RandomEngine("seed"));
    expect(ledger.all.length).toBeGreaterThan(0);
    for (const decision of ledger.all) {
      expect(decision.streamId.startsWith("navigation.breakdown")).toBe(true);
      expect(decision.entityKey).toBe("a1");
      expect(decision.reasonCode).toBe("BREAKDOWN");
    }
  });

  it("caps attainable speed for the repair time after a breakdown, then lifts it", () => {
    const ledger = new RandomLedger();
    const result = run(
      8,
      FULL,
      context({ rules: BREAKS, randomLedger: ledger }),
      new RandomEngine("always-breaks"),
    );
    const caps = result.results.map((r) =>
      r.navigation!.shipRecords.find((s) => s.reasonCodes.includes("BREAKDOWN")),
    );
    expect(caps[0]?.attainableMaxBp).toBe(FULL / 2);
    expect(caps.slice(0, 4).every((c) => c !== undefined)).toBe(true);
    expect(result.results[0]!.movementStates["a1"]!.currentSpeed).toBeLessThan(FULL);
    expect(
      result.results[0]!.navigation!.explanations["a1"]!.children?.map(
        (c) => c.inputs["reasonCode"],
      ),
    ).toContain("BREAKDOWN");
  });

  it("never breaks down when the chance is zero, and never draws without an engine", () => {
    const zero = run(
      10,
      FULL,
      context({ randomLedger: new RandomLedger() }),
      new RandomEngine("seed"),
    );
    const drawn = zero.results.flatMap((r) => r.navigation!.breakdownRecords);
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.every((b) => !b.brokeDown)).toBe(true);
    const noEngine = run(3, FULL, context({ rules: BREAKS }));
    expect(noEngine.results.every((r) => r.navigation!.breakdownRecords.length === 0)).toBe(true);
    expect(
      noEngine.results.every((r) => r.navigation!.machinery["a1"]!.breakdownMinutesLeft === 0),
    ).toBe(true);
  });

  it("scales breakdown probability with engine priority and respects the ceiling", () => {
    const rules: NavigationRules = {
      ...RULES,
      breakdown: {
        ...RULES.breakdown,
        baseChancePpm: 1_000,
        priorityChancePpm: 4_000,
        maxChancePpm: 3_000,
      },
    };
    const chance = (enginePriorityBp: number): number => {
      const result = advanceMinute({
        state: stateAt(FULL),
        minute: 1,
        observationTime: OBSERVATION,
        orders: orders(FULL),
        engine: new RandomEngine("seed"),
        navigation: context({ rules, ships: [ship({ enginePriorityBp })] }),
      });
      return result.navigation!.breakdownRecords[0]!.chancePpm;
    };
    expect(chance(-10_000)).toBe(0);
    expect(chance(0)).toBe(1_000);
    expect(chance(5_000)).toBe(3_000);
    expect(chance(10_000)).toBe(3_000);
  });

  it("reads a damage-derived speed cap as FLOODING_DAMAGE without capping on its own", () => {
    const capped = run(1, FULL, context({ ships: [ship({ damageSpeedCapBp: 18_000 })] }));
    expect(capped.results[0]!.navigation!.shipRecords[0]!.reasonCodes).toEqual(["FLOODING_DAMAGE"]);
    expect(capped.results[0]!.navigation!.shipRecords[0]!.attainableMaxBp).toBe(18_000);
    const free = run(1, FULL, context());
    expect(free.results[0]!.navigation!.shipRecords).toEqual([]);
  });

  it("passes the ship's current speed to the damage-control contexts without capping speed", () => {
    const dc: Record<string, DamageControlContext> = {
      a1: {
        fireRecords: [],
        floodingRecords: [],
        floodedWaterBp: 0,
        designDisplacementKg: 30_000_000,
        shipType: "BB",
        currentSpeedKt: 10,
        resources: createDefaultDamageControlResource(),
        keyedRng: null,
      },
    };
    const staged = applyNavigation({
      state: stateAt(FULL),
      minute: 1,
      observationTime: OBSERVATION,
      orders: orders(FULL),
      damageControl: dc,
      navigation: context(),
    });
    expect(staged.input.damageControl!["a1"]!.currentSpeedKt).toBe(30);
    expect(staged.input.orders!["a1"]!.attainableMaxBp).toBe(FULL);
    expect(dc["a1"]!.currentSpeedKt).toBe(10);
  });

  it("supplies the vibration multiplier only at full speed and 25 kn or more", () => {
    const fast = run(1, FULL, context());
    expect(fast.results[0]!.navigation!.vibrationBp).toEqual({ a1: 9_000 });
    const slow = run(1, 24_000, context());
    expect(slow.results[0]!.navigation!.vibrationBp).toEqual({});
  });

  it("is deterministic: identical inputs give identical hashes, machinery and ledger", () => {
    const once = () => {
      const ledger = new RandomLedger();
      const result = run(
        12,
        FULL,
        context({ rules: BREAKS, randomLedger: ledger }),
        new RandomEngine("determinism"),
      );
      return {
        hashes: result.hashes,
        ledger: ledger.hash(),
        machinery: result.results.map((r) => r.navigation!.machinery),
      };
    };
    expect(once()).toEqual(once());
  });
});
