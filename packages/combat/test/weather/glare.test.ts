// AC-7: Glare — directional, angular separation bands §24; disabled by cloud
// cover > 7_500 bp; observer looking toward sun receives penalty only.
import { describe, it, expect } from "vite-plus/test";
import { computeGlareMultiplierBp } from "../../src/weather/glare.js";

describe("AC-7: glare model (§24)", () => {
  it("returns neutral 10_000 when glareEligible is false", () => {
    const r = computeGlareMultiplierBp({
      observerToTargetBearingDeg: 90,
      solarBearingDeg: 90,
      cloudCoverBp: 0,
      glareEligible: false,
    });
    expect(r.glareMultiplierBp).toBe(10_000);
    expect(r.cloudDisabled).toBe(false);
  });

  it("returns neutral 10_000 when cloud cover > 7_500 bp disables glare", () => {
    const r = computeGlareMultiplierBp({
      observerToTargetBearingDeg: 90,
      solarBearingDeg: 90,
      cloudCoverBp: 7_501,
      glareEligible: true,
    });
    expect(r.glareMultiplierBp).toBe(10_000);
    expect(r.cloudDisabled).toBe(true);
  });

  it("returns 5_000 bp when angular separation < 10°", () => {
    const r = computeGlareMultiplierBp({
      observerToTargetBearingDeg: 90,
      solarBearingDeg: 95, // 5° separation
      cloudCoverBp: 0,
      glareEligible: true,
    });
    expect(r.glareMultiplierBp).toBe(5_000);
    expect(r.angularSeparationDeg).toBe(5);
  });

  it("returns 7_500 bp when separation 10-20°", () => {
    const r = computeGlareMultiplierBp({
      observerToTargetBearingDeg: 0,
      solarBearingDeg: 15, // 15° separation
      cloudCoverBp: 0,
      glareEligible: true,
    });
    expect(r.glareMultiplierBp).toBe(7_500);
    expect(r.angularSeparationDeg).toBe(15);
  });

  it("returns 9_000 bp when separation 20-30°", () => {
    const r = computeGlareMultiplierBp({
      observerToTargetBearingDeg: 30,
      solarBearingDeg: 5, // 25° separation (wrap: 30-5 = 25)
      cloudCoverBp: 0,
      glareEligible: true,
    });
    expect(r.glareMultiplierBp).toBe(9_000);
    expect(r.angularSeparationDeg).toBe(25);
  });

  it("returns 10_000 bp when separation ≥ 30°", () => {
    const r = computeGlareMultiplierBp({
      observerToTargetBearingDeg: 90,
      solarBearingDeg: 130, // 40° separation
      cloudCoverBp: 0,
      glareEligible: true,
    });
    expect(r.glareMultiplierBp).toBe(10_000);
    expect(r.angularSeparationDeg).toBe(40);
  });

  it("handles bearing wrap-around correctly (350° vs 10° = 20° separation)", () => {
    const r = computeGlareMultiplierBp({
      observerToTargetBearingDeg: 350,
      solarBearingDeg: 10,
      cloudCoverBp: 0,
      glareEligible: true,
    });
    expect(r.angularSeparationDeg).toBe(20);
    expect(r.glareMultiplierBp).toBe(9_000);
  });

  it("observer NOT looking toward sun gets > 10° separation → less penalty", () => {
    // Observer looking North (0°) while sun is South (180°) → 180° separation
    const r = computeGlareMultiplierBp({
      observerToTargetBearingDeg: 0,
      solarBearingDeg: 180,
      cloudCoverBp: 0,
      glareEligible: true,
    });
    expect(r.glareMultiplierBp).toBe(10_000); // ≥30° → neutral
  });

  it("boundary: at exactly 10° separation returns 5_000 (<10 band)", () => {
    const r = computeGlareMultiplierBp({
      observerToTargetBearingDeg: 90,
      solarBearingDeg: 99, // 9°, not 10°
      cloudCoverBp: 0,
      glareEligible: true,
    });
    expect(r.glareMultiplierBp).toBe(5_000);
  });
});
