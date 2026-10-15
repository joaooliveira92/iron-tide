import type { BattleManifest, TacticalBattleOutcome } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import {
  applyGenerateFailed,
  applyManifestGenerated,
  applyTacticalOutcome,
  initialTacticalSandboxScreenState,
  updateScriptedOrdersText,
  updateTurnCount,
  updateWarId,
} from "./tactical-sandbox-screen-state.js";

const manifest: BattleManifest = {
  battleId: "battle_1",
  warId: "war_uk_germany",
  missionType: "fleet_engagement",
  areaId: "area_northern_europe",
  month: { year: 1900, month: 1 },
  sides: [
    { sideId: "attacker", nationId: "nation_uk", participants: [] },
    { sideId: "defender", nationId: "nation_germany", participants: [] },
  ],
  elementInstantiation: {
    step: "instantiate",
    outcome: "noop",
    reason: "",
    coastalElementCount: 0,
    coastalElementReason: "",
    submarineElementCount: 0,
    submarineElementReason: "",
    mineElementCount: 0,
    mineElementReason: "",
    airElementCount: 0,
    airElementReason: "",
    missileElementCount: 0,
    missileElementReason: "",
    samCiwsElementCount: 0,
    samCiwsElementReason: "",
    jetElementCount: 0,
    jetElementReason: "",
    radarElementCount: 0,
    radarElementReason: "",
    ewElementCount: 0,
    ewElementReason: "",
  },
  manifestHash: "hash_1",
};

describe("tactical-sandbox-screen-state", () => {
  it("defaults to the fixture war with a sample scripted order", () => {
    const state = initialTacticalSandboxScreenState();
    expect(state.warId).toBe("war_uk_germany");
    expect(state.turnCount).toBe(200);
    expect(state.scriptedOrdersText.length).toBeGreaterThan(0);
  });

  it("updates warId and turnCount independently", () => {
    const state = initialTacticalSandboxScreenState();
    const updated = updateTurnCount(updateWarId(state, "war_custom"), 50);
    expect(updated.warId).toBe("war_custom");
    expect(updated.turnCount).toBe(50);
  });

  it("records a generated manifest and clears prior resolution results", () => {
    const state = applyManifestGenerated(initialTacticalSandboxScreenState(), manifest);
    expect(state.manifest).toBe(manifest);
    expect(state.generateError).toBeNull();
    expect(state.autoResolution).toBeNull();
    expect(state.tacticalOutcome).toBeNull();
  });

  it("records a generation failure and clears any prior manifest", () => {
    const state = applyGenerateFailed(initialTacticalSandboxScreenState(), "WAR_NOT_FOUND");
    expect(state.generateError).toBe("WAR_NOT_FOUND");
    expect(state.manifest).toBeNull();
  });

  it("updates the scripted orders text field verbatim", () => {
    const state = updateScriptedOrdersText(initialTacticalSandboxScreenState(), "[]");
    expect(state.scriptedOrdersText).toBe("[]");
  });

  it("records a tactical outcome", () => {
    const outcome = { turnsResolved: 12 } as unknown as TacticalBattleOutcome;
    const state = applyTacticalOutcome(initialTacticalSandboxScreenState(), outcome);
    expect(state.tacticalOutcome).toBe(outcome);
    expect(state.resolveError).toBeNull();
  });
});
