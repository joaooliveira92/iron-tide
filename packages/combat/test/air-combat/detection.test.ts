// AC-2 (INC-1): CAP detection of incoming strikes via B-2 spotting model.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { computeDetection } from "../../src/air-combat/index.js";

describe("AC-2: CAP detection of incoming strikes", () => {
  it("detects a strike within sensor range", () => {
    // capSensorValue=5 → detectionRange = 5000m
    // distance=3000m → within range → DETECTED
    const result = computeDetection(SafeInt(5), SafeInt(1), SafeInt(3000));
    expect(result).toBe("DETECTED");
  });

  it("detects a strike exactly at sensor range boundary", () => {
    // capSensorValue=3 → detectionRange = 3000m
    // distance=3000m → at boundary → DETECTED
    const result = computeDetection(SafeInt(3), SafeInt(1), SafeInt(3000));
    expect(result).toBe("DETECTED");
  });

  it("does NOT detect a strike beyond sensor range", () => {
    // capSensorValue=2 → detectionRange = 2000m
    // distance=3000m → beyond range → UNDETECTED
    const result = computeDetection(SafeInt(2), SafeInt(1), SafeInt(3000));
    expect(result).toBe("UNDETECTED");
  });

  it("always returns UNDETECTED when capSensorValue is zero", () => {
    const result = computeDetection(SafeInt.ZERO, SafeInt(1), SafeInt(500));
    expect(result).toBe("UNDETECTED");
  });

  it("always returns UNDETECTED when capSensorValue is negative", () => {
    const result = computeDetection(SafeInt(-1), SafeInt(1), SafeInt(500));
    expect(result).toBe("UNDETECTED");
  });

  it("always returns UNDETECTED when strikeSignature is zero", () => {
    // Even though within range, zero signature = perfectly stealthy
    const result = computeDetection(SafeInt(5), SafeInt.ZERO, SafeInt(1000));
    expect(result).toBe("UNDETECTED");
  });

  it("always returns UNDETECTED when strikeSignature is negative", () => {
    const result = computeDetection(SafeInt(5), SafeInt(-1), SafeInt(1000));
    expect(result).toBe("UNDETECTED");
  });

  it("scales detection range linearly with sensor value", () => {
    // sensor 2 → 2000m
    expect(computeDetection(SafeInt(2), SafeInt(1), SafeInt(2000))).toBe("DETECTED");
    expect(computeDetection(SafeInt(2), SafeInt(1), SafeInt(2001))).toBe("UNDETECTED");

    // sensor 5 → 5000m
    expect(computeDetection(SafeInt(5), SafeInt(1), SafeInt(5000))).toBe("DETECTED");
    expect(computeDetection(SafeInt(5), SafeInt(1), SafeInt(5001))).toBe("UNDETECTED");

    // sensor 10 → 10000m
    expect(computeDetection(SafeInt(10), SafeInt(1), SafeInt(10000))).toBe("DETECTED");
    expect(computeDetection(SafeInt(10), SafeInt(1), SafeInt(10001))).toBe("UNDETECTED");
  });
});
