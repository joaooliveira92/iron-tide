// AC-3 (INC-1): Interception timing formula.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { computeInterceptionTime, convertSpeedToMps } from "../../src/air-combat/index.js";

describe("AC-3: Interception timing", () => {
  describe("convertSpeedToMps", () => {
    it("converts speed score 100 to mps: 100*2.5+20 = 270", () => {
      const mps = convertSpeedToMps(SafeInt(100));
      expect(Number(mps)).toBe(270);
    });

    it("converts speed score 50 to mps: 50*2.5+20 = 145", () => {
      const mps = convertSpeedToMps(SafeInt(50));
      expect(Number(mps)).toBe(145);
    });

    it("converts speed score 0 to mps: 0*2.5+20 = 20 (minimum)", () => {
      const mps = convertSpeedToMps(SafeInt(0));
      expect(Number(mps)).toBe(20);
    });

    it("converts speed score 1 to mps: 1*2.5+20 = 22", () => {
      const mps = convertSpeedToMps(SafeInt(1));
      expect(Number(mps)).toBe(22);
    });

    it("handles speed score 80: 80*2.5+20 = 220", () => {
      const mps = convertSpeedToMps(SafeInt(80));
      expect(Number(mps)).toBe(220);
    });
  });

  describe("computeInterceptionTime", () => {
    it("speed 100 → mps=270 → per minute=16200 → 5000m / 16200m = 1 min (ceil)", () => {
      const result = computeInterceptionTime(SafeInt(5000), SafeInt(100), SafeInt(60));
      expect(Number(result.timeMinutes)).toBe(1);
      expect(result.outcome).toBe("DETECTED");
    });

    it("speed 50 → mps=145 → per minute=8700 → 10000m / 8700m = 2 min (ceil)", () => {
      const result = computeInterceptionTime(SafeInt(10000), SafeInt(50), SafeInt(60));
      // 10000 / 8700 = 1.148... ceil = 2
      expect(Number(result.timeMinutes)).toBe(2);
      expect(result.outcome).toBe("DETECTED");
    });

    it("handles speed 0 gracefully (uses max(1, speedMps*60))", () => {
      // speed 0 → mps=20 → per minute=20*60=1200
      // 5000 / 1200 = 4.166... ceil = 5
      const result = computeInterceptionTime(SafeInt(5000), SafeInt(0), SafeInt(60));
      expect(Number(result.timeMinutes)).toBe(5);
      expect(result.outcome).toBe("DETECTED");
    });

    it("handles negative speed gracefully", () => {
      // speed -5 → -5*2.5+20 = 7.5 → floor(7.5) = 7
      // per minute = 7*60 = 420
      // 5000 / 420 = 11.9... ceil = 12
      const result = computeInterceptionTime(SafeInt(5000), SafeInt(-5), SafeInt(60));
      expect(Number(result.timeMinutes)).toBe(12);
      expect(result.outcome).toBe("DETECTED");
    });

    it("distance 0 → 0 minutes (already at target)", () => {
      const result = computeInterceptionTime(SafeInt.ZERO, SafeInt(100), SafeInt(60));
      expect(Number(result.timeMinutes)).toBe(0);
      expect(result.outcome).toBe("DETECTED");
    });

    it("handles large distance (1000000m) without overflow", () => {
      // speed 100 → mps=270 → per minute=16200
      // 1000000 / 16200 = 61.728... ceil = 62
      const result = computeInterceptionTime(SafeInt(1_000_000), SafeInt(100), SafeInt(120));
      expect(Number(result.timeMinutes)).toBe(62);
      expect(result.outcome).toBe("DETECTED");
    });

    it("returns TOO_LATE when timeToIntercept > fuelRemainingMinutes", () => {
      // speed 50 → per minute=8700
      // 100000m / 8700m = 11.49... ceil = 12
      // fuel=5 → 12 > 5 → TOO_LATE
      const result = computeInterceptionTime(SafeInt(100_000), SafeInt(50), SafeInt(5));
      expect(Number(result.timeMinutes)).toBe(12);
      expect(result.outcome).toBe("TOO_LATE");
    });

    it("returns DETECTED when timeToIntercept equals fuelRemainingMinutes (exact match)", () => {
      // speed 100 → per minute=16200
      // 16200m / 16200m = 1 min
      // fuel=1 → 1 <= 1 → DETECTED
      const result = computeInterceptionTime(SafeInt(16200), SafeInt(100), SafeInt(1));
      expect(Number(result.timeMinutes)).toBe(1);
      expect(result.outcome).toBe("DETECTED");
    });

    it("very small distance rounds up to 1 minute via ceil", () => {
      // speed 100 → per minute=16200
      // 1m / 16200m = 0.0000617... ceil = 1
      const result = computeInterceptionTime(SafeInt(1), SafeInt(100), SafeInt(60));
      expect(Number(result.timeMinutes)).toBe(1);
      expect(result.outcome).toBe("DETECTED");
    });
  });
});
