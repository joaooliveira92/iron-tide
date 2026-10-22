import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import {
  advanceCampaignMonth,
  assertCampaignStateImmutability,
  canAdvanceCampaign,
  createInitialCampaignState,
  validateCampaignPreconditions,
} from "../src/campaignSession.js";
import { CANONICAL_FLEET_SIZE_SETTINGS } from "../src/fleetSize.js";
import { CANONICAL_RESEARCH_SPEED_SETTINGS } from "../src/researchSpeed.js";
import { CANONICAL_SCENARIOS } from "../src/scenario.js";

function collector() {
  return new DiagnosticCollector();
}
function hasCode(c: DiagnosticCollector, code: string) {
  return c.errors.some((d) => d.code === code);
}
const SEED = "a".repeat(32);
const BASE_CFG: any = {
  scenarioId: "scen_1880",
  playerSlotId: "gbr",
  continuityModeId: "historical",
  fleetSizeSettingId: "standard",
  researchSpeedSettingId: "standard",
  technologyVariationSettingId: "none",
  historicalBudgetOptionId: "standard",
  legacyFleetModeId: "historical",
  tacticalRealismModeId: "standard",
  difficultyProfileId: "normal",
  campaignSeed: SEED,
  configurationSchemaVersion: "1.0",
};

describe("state: validateCampaignPreconditions strictness (§3, inference prohibited)", () => {
  it("fails when campaignConfiguration missing (no fallback)", () => {
    const c = collector();
    expect(validateCampaignPreconditions({ scenarios: CANONICAL_SCENARIOS }, c)).toBe(false);
    expect(hasCode(c, "INVALID_CAMPAIGN_CONFIGURATION")).toBe(true);
  });
  it("fails when scenarios missing (no ?? CANONICAL)", () => {
    const c = collector();
    expect(
      validateCampaignPreconditions(
        {
          campaignConfiguration: BASE_CFG,
          fleetSizeSettings: CANONICAL_FLEET_SIZE_SETTINGS,
          researchSpeedSettings: CANONICAL_RESEARCH_SPEED_SETTINGS,
        },
        c,
      ),
    ).toBe(false);
    expect(hasCode(c, "INVALID_SCENARIO_DEFINITION")).toBe(true);
  });
  it("fails when fleetSizeSettings missing (inference prohibited)", () => {
    const c = collector();
    expect(
      validateCampaignPreconditions(
        {
          scenarios: CANONICAL_SCENARIOS,
          campaignConfiguration: BASE_CFG,
          researchSpeedSettings: CANONICAL_RESEARCH_SPEED_SETTINGS,
        },
        c,
      ),
    ).toBe(false);
    expect(hasCode(c, "MISSING_FLEET_SIZE_MULTIPLIER")).toBe(true);
  });
  it("fails when researchSpeedSettings missing", () => {
    const c = collector();
    expect(
      validateCampaignPreconditions(
        {
          scenarios: CANONICAL_SCENARIOS,
          campaignConfiguration: BASE_CFG,
          fleetSizeSettings: CANONICAL_FLEET_SIZE_SETTINGS,
        },
        c,
      ),
    ).toBe(false);
    expect(hasCode(c, "INVALID_RESEARCH_SPEED_MULTIPLIER")).toBe(true);
  });
  it("fails when chosen fleet not supported by scenario", () => {
    const c = collector();
    const badCfg = { ...BASE_CFG, fleetSizeSettingId: "very_large" as any };
    const scenTampered = CANONICAL_SCENARIOS.map((s) =>
      s.scenarioId === "scen_1880" ? { ...s, supportedFleetSizeSettingIds: ["small"] } : s,
    );
    expect(
      validateCampaignPreconditions(
        {
          scenarios: scenTampered,
          campaignConfiguration: badCfg,
          fleetSizeSettings: CANONICAL_FLEET_SIZE_SETTINGS,
          researchSpeedSettings: CANONICAL_RESEARCH_SPEED_SETTINGS,
        },
        c,
      ),
    ).toBe(false);
    expect(hasCode(c, "INVALID_CAMPAIGN_CONFIGURATION")).toBe(true);
  });
  it("passes with full canonical valid input", () => {
    const c = collector();
    expect(
      validateCampaignPreconditions(
        {
          scenarios: CANONICAL_SCENARIOS,
          campaignConfiguration: BASE_CFG,
          fleetSizeSettings: CANONICAL_FLEET_SIZE_SETTINGS,
          researchSpeedSettings: CANONICAL_RESEARCH_SPEED_SETTINGS,
        },
        c,
      ),
    ).toBe(true);
    expect(c.hasErrors).toBe(false);
  });
});

describe("state: createInitialCampaignState cross-check", () => {
  it("rejects unsupported difficulty", () => {
    const c = collector();
    const cfg = { ...BASE_CFG, difficultyProfileId: "nonexistent" };
    expect(createInitialCampaignState(cfg as any, c)).toBeUndefined();
    expect(hasCode(c, "INVALID_CAMPAIGN_CONFIGURATION")).toBe(true);
  });
  it("hash stable", () => {
    const c1 = collector(),
      c2 = collector();
    const s1 = createInitialCampaignState(BASE_CFG as any, c1)!;
    const s2 = createInitialCampaignState(BASE_CFG as any, c2)!;
    expect(s1.configurationHash).toBe(s2.configurationHash);
    expect(s1.configurationHash).toHaveLength(64);
  });
});

describe("state: timeline advance (§2)", () => {
  it("canAdvance false at Dec 1970", () => {
    const c = collector();
    const s = createInitialCampaignState({ ...BASE_CFG, scenarioId: "scen_1960" } as any, c)!;
    let cur = {
      ...s,
      currentYear: 1970,
      currentMonth: 11,
      turnNumber: 10,
      isTerminal: false,
    } as any;
    const nxt = advanceCampaignMonth(cur, collector())!;
    expect(nxt.currentYear).toBe(1970);
    expect(nxt.currentMonth).toBe(12);
    expect(nxt.isTerminal).toBe(true);
    expect(canAdvanceCampaign(nxt)).toBe(false);
    const c2 = collector();
    expect(advanceCampaignMonth(nxt, c2)).toBeUndefined();
    expect(hasCode(c2, "SIMULATION_END_REACHED")).toBe(true);
  });
  it("assertCampaignStateImmutability hash mismatch", () => {
    const c = collector();
    const s = createInitialCampaignState(BASE_CFG as any, c)!;
    const mutated: any = { ...BASE_CFG, fleetSizeSettingId: "large" };
    const c2 = collector();
    expect(assertCampaignStateImmutability(s, mutated, c2)).toBe(false);
    expect(hasCode(c2, "INVALID_CAMPAIGN_CONFIGURATION")).toBe(true);
  });
});
