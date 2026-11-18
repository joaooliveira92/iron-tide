import { describe, expect, it } from "vite-plus/test";
import { RandomEngine, RandomLedger } from "@bluewave/random";
import { advanceMinutes, type AdvanceMinutesResult } from "@bluewave/combat/simulation";
import type {
  NavigationContext,
  NavigationRules,
  SeparationState,
} from "@bluewave/combat/navigation";
import {
  BASE_RULES,
  FORMATION,
  navigationContext,
  OBSERVATION,
  scenarioOrders,
  scenarioState,
  SEPARATION_BLOCK,
  type ScenarioOptions,
} from "./separationScenario.js";

const NEVER = {
  ...SEPARATION_BLOCK,
  formationBaseBp: { LINE_ABREAST: 0, SEARCH_LINE: 0, SCREEN: 0 },
};
const ALWAYS = {
  ...SEPARATION_BLOCK,
  formationBaseBp: { LINE_ABREAST: 10_000, SEARCH_LINE: 10_000, SCREEN: 10_000 },
};

function rulesWith(separation: NavigationRules["separation"]): NavigationRules {
  return { ...BASE_RULES, ...(separation === undefined ? {} : { separation }) };
}

function run(
  scenario: ScenarioOptions,
  navigation: NavigationContext,
  minutes: number,
  extra: { engine?: RandomEngine; orders?: ReturnType<typeof scenarioOrders> } = {},
): AdvanceMinutesResult {
  return advanceMinutes({
    state: scenarioState(scenario),
    minutes,
    observationTime: OBSERVATION,
    orders: extra.orders ?? scenarioOrders(),
    formation: FORMATION,
    navigation,
    ...(extra.engine === undefined ? {} : { engine: extra.engine }),
  });
}

const abreast: ScenarioOptions = { divisionOverrides: { formation: "LINE_ABREAST" } };

const SEPARATED_STATE: SeparationState = {
  formation: "LINE_ABREAST",
  separated: true,
  heldHeading: 0,
  heldSpeedBp: 15_000,
  driftMinutes: 0,
  disordered: false,
};

function stateOf(result: AdvanceMinutesResult, minuteIndex: number, shipId: string) {
  return result.results[minuteIndex]!.navigation!.separation?.[shipId];
}

describe("separation draw (#941)", () => {
  it("separates followers, never the flagship, and records each draw with a reason code", () => {
    const ledger = new RandomLedger();
    const result = run(abreast, navigationContext(rulesWith(ALWAYS), { randomLedger: ledger }), 1, {
      engine: new RandomEngine("seed"),
    });
    expect(stateOf(result, 0, "f2")?.separated).toBe(true);
    expect(stateOf(result, 0, "f3")?.separated).toBe(true);
    expect(stateOf(result, 0, "f1")).toBeUndefined();
    const draws = ledger.all.filter((d) => d.streamId.startsWith("navigation.separation:"));
    expect(draws.map((d) => d.streamId)).toEqual([
      "navigation.separation:f2:1",
      "navigation.separation:f3:1",
    ]);
    for (const draw of draws) {
      expect(draw.reasonCode).toBe("SEPARATION");
      expect(draw.inputHash).toMatch(/^[0-9a-f]{64}$/);
      expect(draw.outcome).toBe("SEPARATED");
    }
    expect(result.results[0]!.navigation!.separationRecords).toEqual([
      { shipId: "f2", minute: 1, kind: "SEPARATED", reasonCode: "SEPARATION" },
      { shipId: "f3", minute: 1, kind: "SEPARATED", reasonCode: "SEPARATION" },
    ]);
    expect(result.results[0]!.events.map((e) => e.eventType)).toContain("ship_separated");
  });

  it("is reproducible from the seed", () => {
    const go = () =>
      run(
        abreast,
        navigationContext(
          rulesWith({
            ...ALWAYS,
            formationBaseBp: { ...ALWAYS.formationBaseBp, LINE_ABREAST: 3_000 },
          }),
        ),
        20,
        {
          engine: new RandomEngine("seed-b"),
        },
      ).hashes;
    expect(go()).toEqual(go());
  });

  it("draws for search lines and screens, and never for a line ahead", () => {
    for (const formation of ["SEARCH_LINE", "SCREEN"] as const) {
      const result = run(
        { divisionOverrides: { formation } },
        navigationContext(rulesWith(ALWAYS)),
        1,
        { engine: new RandomEngine("seed") },
      );
      expect(stateOf(result, 0, "f2")?.separated).toBe(true);
    }
    const ahead = run(
      { divisionOverrides: { formation: "LINE_AHEAD" } },
      navigationContext(rulesWith(ALWAYS)),
      3,
      { engine: new RandomEngine("seed") },
    );
    expect(ahead.results.every((r) => r.navigation!.separationRecords === undefined)).toBe(true);
  });

  it("draws nothing without an engine, with a zero chance, or without the block", () => {
    const noEngine = run(abreast, navigationContext(rulesWith(ALWAYS)), 2);
    expect(stateOf(noEngine, 1, "f2")?.separated ?? false).toBe(false);
    const ledger = new RandomLedger();
    const never = run(abreast, navigationContext(rulesWith(NEVER), { randomLedger: ledger }), 2, {
      engine: new RandomEngine("seed"),
    });
    expect(ledger.all).toHaveLength(0);
    expect(stateOf(never, 1, "f2")?.separated ?? false).toBe(false);
    const dormant = run(abreast, navigationContext(rulesWith(undefined)), 2, {
      engine: new RandomEngine("seed"),
    });
    expect(dormant.results.every((r) => r.navigation!.separation === undefined)).toBe(true);
  });

  it("holds the last heading and speed of a separated ship while the division turns away", () => {
    const orders = scenarioOrders(20_000);
    for (const id of ["f1", "f2", "f3"]) orders[id] = { ...orders[id]!, orderedHeading: 90 };
    const far: ScenarioOptions = {
      ...abreast,
      positions: { f2: [0, 400_000_000_000], f3: [0, 500_000_000_000] },
    };
    const result = run(
      far,
      navigationContext(rulesWith(NEVER), {
        separation: { f2: SEPARATED_STATE, f3: SEPARATED_STATE },
      }),
      3,
      { engine: new RandomEngine("seed"), orders },
    );
    for (const minute of result.results) {
      for (const id of ["f2", "f3"]) {
        expect(minute.movementStates[id]!.heading).toBe(0);
        expect(minute.movementStates[id]!.currentSpeed).toBe(15_000);
      }
    }
    expect(result.results[2]!.movementStates["f1"]!.heading).toBeGreaterThan(0);
  });

  it("no longer limits the division speed by a separated ship", () => {
    const orders = scenarioOrders(15_000);
    orders["f2"] = { ...orders["f2"]!, attainableMaxBp: 5_000 };
    const result = run(
      { ...abreast, positions: { f2: [0, 400_000_000_000] } },
      navigationContext(rulesWith(NEVER), { separation: { f2: SEPARATED_STATE } }),
      1,
      { engine: new RandomEngine("seed"), orders },
    );
    expect(result.results[0]!.movementStates["f1"]!.currentSpeed).toBeGreaterThan(5_000);
    expect(result.results[0]!.movementStates["f2"]!.currentSpeed).toBeLessThanOrEqual(5_000);
  });
});

describe("rejoin on flagship sighting (#941)", () => {
  const seeded = (scenario: ScenarioOptions) =>
    run(scenario, navigationContext(rulesWith(NEVER), { separation: { f2: SEPARATED_STATE } }), 1, {
      engine: new RandomEngine("seed"),
    });

  it("rejoins once the flagship is within own-side visual sighting", () => {
    const result = seeded(abreast);
    expect(stateOf(result, 0, "f2")?.separated ?? false).toBe(false);
    expect(result.results[0]!.navigation!.separationRecords).toEqual([
      { shipId: "f2", minute: 1, kind: "REJOINED", reasonCode: "SEPARATION_REJOIN" },
    ]);
    expect(result.results[0]!.events.map((e) => e.eventType)).toContain("ship_rejoined");
  });

  it("never rejoins by magic: stays separated while the flagship is out of sight", () => {
    const result = seeded({
      ...abreast,
      positions: { f2: [0, 400_000_000_000] },
    });
    expect(stateOf(result, 0, "f2")?.separated).toBe(true);
    expect(result.results[0]!.navigation!.separationRecords).toBeUndefined();
  });
});

describe("heavy line-abreast drift (#941)", () => {
  const heavy: ScenarioOptions = {
    ...abreast,
    shipTypes: { f1: "BB", f2: "BB", f3: "DD" },
  };

  it("accumulates deterministically and disorders a ship past the threshold", () => {
    const result = run(heavy, navigationContext(rulesWith(NEVER)), 4);
    expect(
      result.results.map((r) => stateOf(result, result.results.indexOf(r), "f2")?.driftMinutes),
    ).toEqual([1, 2, 3, 4]);
    expect(stateOf(result, 1, "f2")?.disordered).toBe(false);
    expect(stateOf(result, 2, "f2")?.disordered).toBe(true);
    expect(result.results[2]!.navigation!.separationRecords).toEqual([
      { shipId: "f2", minute: 3, kind: "DISORDERED", reasonCode: "STATION_DRIFT" },
    ]);
    expect(stateOf(result, 3, "f3")).toBeUndefined();
    expect(stateOf(result, 3, "f1")).toBeUndefined();
  });

  it("needs no engine and ignores other formations", () => {
    for (const formation of ["SEARCH_LINE", "SCREEN", "LINE_AHEAD"] as const) {
      const result = run(
        { ...heavy, divisionOverrides: { formation } },
        navigationContext(rulesWith(NEVER)),
        4,
      );
      expect(stateOf(result, 3, "f2")?.disordered ?? false).toBe(false);
    }
  });

  it("widens the station tolerance and applies a steering error to a disordered ship", () => {
    const disordered: SeparationState = {
      formation: "LINE_ABREAST",
      separated: false,
      heldHeading: 0,
      heldSpeedBp: 15_000,
      driftMinutes: 3,
      disordered: true,
    };
    const offset = { f2: [0, 400_000_000 + 80_000_000] as [number, number] };
    const base = run({ ...heavy, positions: offset }, navigationContext(rulesWith(NEVER)), 1);
    const result = run(
      { ...heavy, positions: offset },
      navigationContext(rulesWith(NEVER), { separation: { f2: disordered } }),
      1,
    );
    expect(base.results[0]!.movementStates["f2"]!.heading).not.toBe(
      result.results[0]!.movementStates["f2"]!.heading,
    );
    expect(result.results[0]!.movementStates["f3"]!.heading).toBe(
      base.results[0]!.movementStates["f3"]!.heading,
    );
  });

  it("clears the drift when the division changes formation", () => {
    const first = run(heavy, navigationContext(rulesWith(NEVER)), 3);
    const carried = first.results[2]!.navigation!.separation!;
    const next = run(
      { ...heavy, divisionOverrides: { formation: "LINE_AHEAD" } },
      navigationContext(rulesWith(NEVER), { separation: carried }),
      1,
    );
    expect(stateOf(next, 0, "f2")).toBeUndefined();
  });

  it("carries the state across minutes in advanceMinutes", () => {
    const result = run(heavy, navigationContext(rulesWith(NEVER)), 5);
    expect(stateOf(result, 4, "f2")?.driftMinutes).toBe(5);
    expect(stateOf(result, 4, "f2")?.disordered).toBe(true);
  });
});
