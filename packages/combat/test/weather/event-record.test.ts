import { describe, it, expect } from "vite-plus/test";
import { makeWeatherEventRecord, weatherEventId } from "@bluewave/combat/weather";

describe("AC-11: WeatherEventRecord completeness (§28)", () => {
  const record = makeWeatherEventRecord({
    eventId: weatherEventId({
      battleId: "battle-001",
      minute: 30,
      substep: 0,
      eventType: "weather_time_of_day",
    }),
    battleId: "battle-001",
    minute: 30,
    substep: 0,
    eventType: "weather_time_of_day",
    preStateHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    postStateHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    visibilityUm: 45_000_000_000,
    timeOfDay: "TWILIGHT_DAY",
    solarBearingDeg: 280,
    solarElevationDeg: 5,
    progressionTransitions: [],
    formulaVersion: "weather_environment_v1",
    rulesetVersion: "weather_ruleset_v1",
  });

  it("has all §28 fields", () => {
    expect(record.eventId).toMatch(/^battle-001:\d+:0:weather_time_of_day$/);
    expect(record.battleId).toBe("battle-001");
    expect(record.minute).toBe(30);
    expect(record.substep).toBe(0);
    expect(record.eventType).toBe("weather_time_of_day");
    expect(record.preStateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(record.postStateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(record.visibilityUm).toBeGreaterThanOrEqual(0);
    expect(typeof record.timeOfDay).toBe("string");
    expect(record.solarBearingDeg).toBeGreaterThanOrEqual(0);
    expect(record.solarElevationDeg).toBeGreaterThanOrEqual(-90);
    expect(Array.isArray(record.progressionTransitions)).toBe(true);
    expect(typeof record.formulaVersion).toBe("string");
    expect(typeof record.rulesetVersion).toBe("string");
  });

  it("carries a deterministic record hash", () => {
    expect(record.eventHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same inputs produce identical event hash", () => {
    const a = makeWeatherEventRecord({
      eventId: "battle-001:30:0:weather_time_of_day",
      battleId: "battle-001",
      minute: 30,
      substep: 0,
      eventType: "weather_time_of_day",
      preStateHash: "a".repeat(64),
      postStateHash: "b".repeat(64),
      visibilityUm: 0,
      timeOfDay: "NIGHT",
      solarBearingDeg: 0,
      solarElevationDeg: -30,
      progressionTransitions: [],
      formulaVersion: "v1",
      rulesetVersion: "v1",
    });
    const b = makeWeatherEventRecord({
      eventId: "battle-001:30:0:weather_time_of_day",
      battleId: "battle-001",
      minute: 30,
      substep: 0,
      eventType: "weather_time_of_day",
      preStateHash: "a".repeat(64),
      postStateHash: "b".repeat(64),
      visibilityUm: 0,
      timeOfDay: "NIGHT",
      solarBearingDeg: 0,
      solarElevationDeg: -30,
      progressionTransitions: [],
      formulaVersion: "v1",
      rulesetVersion: "v1",
    });
    expect(a.eventHash).toBe(b.eventHash);
  });

  it("hash differs when a field changes", () => {
    const base = {
      eventId: "e1",
      battleId: "b1",
      minute: 30,
      substep: 0,
      eventType: "weather_time_of_day" as const,
      preStateHash: "a".repeat(64),
      postStateHash: "b".repeat(64),
      visibilityUm: 0,
      timeOfDay: "NIGHT" as const,
      solarBearingDeg: 0,
      solarElevationDeg: -30,
      progressionTransitions: [] as const,
      formulaVersion: "v1",
      rulesetVersion: "v1",
    };
    const a = makeWeatherEventRecord(base);
    const b = makeWeatherEventRecord({ ...base, visibilityUm: 10_000 });
    expect(b.eventHash).not.toBe(a.eventHash);
  });

  it("progression transition records are included when present", () => {
    const record = makeWeatherEventRecord({
      eventId: "e1",
      battleId: "b1",
      minute: 60,
      substep: 0,
      eventType: "weather_progression",
      preStateHash: "a".repeat(64),
      postStateHash: "b".repeat(64),
      visibilityUm: 0,
      timeOfDay: "DAY",
      solarBearingDeg: 120,
      solarElevationDeg: 45,
      progressionTransitions: [
        {
          tacticalMinute: 60,
          intervalIndex: 2,
          component: "seaState",
          preValue: "3",
          postValue: "4",
          reason: "sea_state_drift",
        },
      ],
      formulaVersion: "v1",
      rulesetVersion: "v1",
    });
    expect(record.progressionTransitions).toHaveLength(1);
    expect(record.progressionTransitions[0]!.component).toBe("seaState");
  });

  it("eventId derivation is deterministic", () => {
    const id1 = weatherEventId({
      battleId: "b",
      minute: 10,
      substep: 0,
      eventType: "weather_time_of_day",
    });
    const id2 = weatherEventId({
      battleId: "b",
      minute: 10,
      substep: 0,
      eventType: "weather_time_of_day",
    });
    expect(id1).toBe(id2);
  });
});
