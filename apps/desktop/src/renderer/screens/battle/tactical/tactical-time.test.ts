import { describe, expect, it } from "vite-plus/test";
import {
  PROVISIONAL_BASE_STEP_INTERVAL_MS,
  TACTICAL_TIME_SCALES,
  formatTacticalClock,
  isTimeScale,
  stepIntervalMs,
} from "./tactical-time.js";

describe("tactical time scales", () => {
  it("shortens the wall interval between steps without changing the step", () => {
    const intervals = TACTICAL_TIME_SCALES.map(stepIntervalMs);
    expect(intervals[0]).toBe(PROVISIONAL_BASE_STEP_INTERVAL_MS);
    expect([...intervals].sort((a, b) => b - a)).toEqual(intervals);
    expect(new Set(intervals).size).toBe(intervals.length);
  });

  it("accepts only the listed scales", () => {
    expect(isTimeScale(4)).toBe(true);
    expect(isTimeScale(3)).toBe(false);
    expect(isTimeScale(0)).toBe(false);
  });

  it("formats elapsed tactical minutes as hours and minutes", () => {
    expect(formatTacticalClock(0)).toBe("00:00");
    expect(formatTacticalClock(59)).toBe("00:59");
    expect(formatTacticalClock(61)).toBe("01:01");
    expect(formatTacticalClock(600)).toBe("10:00");
  });
});
