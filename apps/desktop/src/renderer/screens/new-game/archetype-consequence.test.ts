import { describe, expect, it } from "vite-plus/test";
import { BALANCED_ALLOCATION, archetypeEffects } from "@bluewave/campaign-engine";
import { buildArchetypeConsequence } from "./archetype-consequence.js";

const merchantPrince = { economy: 10, industry: 5, combat: 5 };

describe("buildArchetypeConsequence", () => {
  it("reports the difference from balanced and exact numeric effects", () => {
    const consequence = buildArchetypeConsequence(merchantPrince);
    expect(consequence.difference).toEqual({
      economy: 3,
      industry: -2,
      combat: -1,
    });
    expect(consequence.numericEffects.find((e) => e.label === "Starting treasury")!.value).toBe(
      "+24%",
    );
    expect(
      consequence.numericEffects.find((e) => e.label === "Commander bonus in battle")!.value,
    ).toBe("-5");
  });

  it("lists strengths for dimensions above balanced and opportunity costs below", () => {
    const consequence = buildArchetypeConsequence(merchantPrince);
    expect(consequence.strengths.some((s) => s.includes("Economy"))).toBe(true);
    expect(consequence.opportunityCosts.some((c) => c.includes("Combat"))).toBe(true);
  });

  it("lists the engine systems affected", () => {
    const consequence = buildArchetypeConsequence(merchantPrince);
    expect(
      consequence.systems.some((s) => s.includes("Starting treasury and monthly appropriation")),
    ).toBe(true);
    expect(consequence.systems.some((s) => s.includes("Shipyard capacity"))).toBe(true);
    expect(consequence.systems.some((s) => s.includes("battle resolution"))).toBe(true);
  });

  it("mentions thresholds and the point cap", () => {
    const consequence = buildArchetypeConsequence(merchantPrince);
    expect(consequence.thresholds.join(" ")).toContain("20");
  });

  it("matches the engine's authoritative effect calculator", () => {
    const consequence = buildArchetypeConsequence(merchantPrince);
    expect(consequence.effects).toEqual(archetypeEffects(merchantPrince));
  });

  it("is neutral for the balanced allocation", () => {
    const consequence = buildArchetypeConsequence(BALANCED_ALLOCATION);
    expect(consequence.difference).toEqual({
      economy: 0,
      industry: 0,
      combat: 0,
    });
    expect(consequence.numericEffects.every((e) => e.value === "0%" || e.value === "0")).toBe(true);
  });
});
