import { describe, it, expect } from "vite-plus/test";
import {
  ACCESS_EFFECTS,
  accessEffect,
  applyNationalConstructionEconomics,
  DEFAULT_ACCESS_POLICY,
  type ComponentAccessPolicy,
} from "../src/nationalConstruction.js";
import { resolveNationalConstruction } from "../src/index.js";
import { navalProfiles } from "./helpers/earlyContext.js";

const uk = navalProfiles.find((p) => p.nationId === "uk")!;
const france = navalProfiles.find((p) => p.nationId === "france")!;

describe("component access effects", () => {
  it("domestic supply is the baseline; imports and licences cost more and are less reliable", () => {
    expect(accessEffect("DOMESTIC").costMultiplierBp).toBe(10_000);
    expect(accessEffect("DOMESTIC").reliabilityDeltaBp).toBe(0);
    expect(accessEffect("IMPORTED").costMultiplierBp).toBeGreaterThan(10_000);
    expect(accessEffect("IMPORTED").reliabilityDeltaBp).toBeLessThan(0);
    expect(accessEffect("LICENSE_BUILT").costMultiplierBp).toBeGreaterThan(10_000);
    expect(accessEffect("UNAVAILABLE").available).toBe(false);
  });
  it("wartime cuts a neutral/hostile overseas supply line but not a friendly one", () => {
    const hostile: ComponentAccessPolicy = { wartime: true, alignment: "HOSTILE" };
    const friendly: ComponentAccessPolicy = { wartime: true, alignment: "FRIENDLY" };
    expect(accessEffect("IMPORTED", hostile).available).toBe(false);
    expect(accessEffect("IMPORTED", friendly).available).toBe(true);
    expect(accessEffect("IMPORTED", friendly).costMultiplierBp).toBeGreaterThan(
      accessEffect("IMPORTED", DEFAULT_ACCESS_POLICY).costMultiplierBp,
    );
    expect(accessEffect("DOMESTIC", hostile).available).toBe(true);
  });
  it("captured/studied equipment stays available in war but cannot be refitted", () => {
    expect(
      accessEffect("CAPTURED_OR_STUDIED", { wartime: true, alignment: "HOSTILE" }).available,
    ).toBe(true);
    expect(accessEffect("CAPTURED_OR_STUDIED").refitEligible).toBe(false);
  });
});

describe("national construction modifiers", () => {
  it("composes industrial and access premiums into one multiplier (each factor once)", () => {
    const ukM = resolveNationalConstruction(uk, "1880-01");
    const frM = resolveNationalConstruction(france, "1880-01");
    expect(ukM.costMultiplierBp).toBeLessThan(frM.costMultiplierBp);
    expect(ukM.buildTimeMultiplierBp).toBeLessThan(frM.buildTimeMultiplierBp);
    const product = ukM.costBreakdown.reduce(
      (acc, b) => Math.ceil((acc * b.costMultiplierBp) / 10_000),
      10_000,
    );
    expect(product).toBe(ukM.costMultiplierBp);
  });
  it("is date-banded: the displacement ceiling grows over time", () => {
    expect(resolveNationalConstruction(uk, "1880-01").maxPracticalDisplacementKg).toBe(10_000_000);
    expect(resolveNationalConstruction(uk, "1891-01").maxPracticalDisplacementKg).toBe(15_000_000);
  });
  it("applies cost and build time exactly once, rounding up, preserving the base", () => {
    const m = resolveNationalConstruction(uk, "1880-01");
    const e = applyNationalConstructionEconomics(200, 24, m);
    expect(e.baseCostUnits).toBe(200);
    expect(e.costUnits).toBe(Math.ceil((200 * m.costMultiplierBp) / 10_000));
    expect(e.buildMonths).toBe(Math.ceil((24 * m.buildTimeMultiplierBp) / 10_000));
    expect(e.costUnits).toBeLessThan(200);
    expect(e.buildMonths).toBeLessThan(24);
  });
  it("France costs and builds above the baseline; the two nations differ measurably", () => {
    const ukE = applyNationalConstructionEconomics(
      200,
      24,
      resolveNationalConstruction(uk, "1880-01"),
    );
    const frE = applyNationalConstructionEconomics(
      200,
      24,
      resolveNationalConstruction(france, "1880-01"),
    );
    expect(frE.costUnits).toBeGreaterThan(200);
    expect(frE.buildMonths).toBeGreaterThan(24);
    expect(frE.costUnits).toBeGreaterThan(ukE.costUnits);
    expect(frE.buildMonths).toBeGreaterThan(ukE.buildMonths);
  });
  it("rejects invalid base values safely", () => {
    const m = resolveNationalConstruction(uk, "1880-01");
    expect(() => applyNationalConstructionEconomics(-1, 10, m)).toThrowError(/non-negative/);
    expect(() => applyNationalConstructionEconomics(10, -1, m)).toThrowError(/non-negative/);
    expect(() => applyNationalConstructionEconomics(1.5, 10, m)).toThrowError(/safe integer/);
  });
  it("the access effect table covers every defined state", () => {
    for (const status of [
      "DOMESTIC",
      "LICENSE_BUILT",
      "IMPORTED",
      "CAPTURED_OR_STUDIED",
      "UNAVAILABLE",
    ] as const)
      expect(ACCESS_EFFECTS[status]).toBeDefined();
  });
});
