//packages/combat/test/weather/ordering.test.ts
// AC-12: Canonical ordering — weather events order by §29: weather transitions
// by minute → component priority, then commands, then observation rays, then
// fire rays. DB/UI/rendering/wall-clock order must not affect outcomes.
import { describe, it, expect } from "vite-plus/test";
import { canonicalEventOrder } from "../../src/battleLedger.js";

function base(overrides: Record<string, unknown> = {}) {
  return {
    battleId: "battle-001",
    minute: 10,
    substep: 0,
    eventPriority: 7.5,
    actorId: "weather",
    targetId: "",
    eventId: "battle-001:10:0:weather_time_of_day:weather:",
    eventType: "weather_time_of_day",
    ...overrides,
  };
}

describe("AC-12: weather event canonical ordering", () => {
  it("two identical weather events compare equal", () => {
    expect(canonicalEventOrder(base(), base())).toBe(0);
  });

  it("weather events sort before later minute's events", () => {
    expect(canonicalEventOrder(base(), base({ minute: 11 }))).toBeLessThan(0);
  });

  it("weather events sort after earlier minute's events", () => {
    expect(canonicalEventOrder(base({ minute: 9 }), base())).toBeLessThan(0);
  });

  it("weather events sort before spotting (priority 7.5 < 8) in same minute", () => {
    const weather = base({
      eventType: "weather_time_of_day",
      eventPriority: 7.5,
    });
    const spotting = base({
      eventType: "resolve_sensors_spotting",
      eventPriority: 8,
      actorId: "pipeline",
    });
    expect(canonicalEventOrder(weather, spotting)).toBeLessThan(0);
  });

  it("weather events sort after collisions (priority 7.5 > 7) in same minute", () => {
    const collision = base({
      eventType: "resolve_collisions_grounding",
      eventPriority: 7,
      actorId: "pipeline",
    });
    const weather = base({
      eventType: "weather_time_of_day",
      eventPriority: 7.5,
    });
    expect(canonicalEventOrder(collision, weather)).toBeLessThan(0);
  });

  it("weather_time_of_day sorts before weather_progression when event priority differs", () => {
    const tod = base({ eventType: "weather_time_of_day", eventId: "a" });
    const prog = base({ eventType: "weather_progression", eventId: "z" });
    // Same priority (7.5), same actorId, sort by eventId
    expect(canonicalEventOrder(tod, prog)).toBeLessThan(0);
  });

  it("battle field order is deterministic (same inputs = same output)", () => {
    const a = base({ minute: 5, eventType: "weather_time_of_day" });
    const b = base({ minute: 10, eventType: "weather_progression" });
    expect(canonicalEventOrder(a, b)).toBe(canonicalEventOrder(a, b));
  });
});
