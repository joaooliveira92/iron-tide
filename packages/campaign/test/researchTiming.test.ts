import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { discoveryDrawWeight, historicalTimingModifierBp } from "../src/researchEligibility.js";

describe("historicalTimingModifierBp", () => {
  it.each([
    [0, 0, 10_000],
    [60, 0, 10_000],
    [61, 0, 12_500],
    [0, 24, 8_000],
    [0, 25, 5_000],
    [0, 60, 5_000],
    [0, 61, 10_000],
  ])("turn %i against availability %i gives %i bp", (turn, availability, expected) => {
    expect(historicalTimingModifierBp(SafeInt(availability), SafeInt(turn))).toBe(expected);
  });
});

describe("discoveryDrawWeight", () => {
  it("scales the base weight by the timing modifier and never drops below one", () => {
    expect(discoveryDrawWeight(SafeInt(4000), SafeInt(0), SafeInt(100))).toBe(5000);
    expect(discoveryDrawWeight(SafeInt(1), SafeInt(24), SafeInt(0))).toBe(1);
  });
});
