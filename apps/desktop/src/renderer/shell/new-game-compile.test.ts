import { describe, expect, it, vi } from "vite-plus/test";

import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { CampaignCommandClient } from "../../shared/campaign-contract.js";
import type { DraftPreferences } from "../screens/new-game/new-game-preferences-screen-state.js";
import { compileNewGame, isLaunchableDraft } from "./new-game-compile.js";
import type { LaunchableDraft, NewGameDraft } from "./new-game-draft.js";

type CampaignExecute = CampaignCommandClient["execute"];

const preferences = {
  version: "campaign_configuration_v1",
  scenarioId: "scen_1900",
  continuityMode: "historical",
  fleetSize: "standard",
  researchSpeed: "standard",
  technologyVariation: "none",
  historicalBudget: "canonical",
  legacyFleetMode: "canonical_fixture",
  tacticalRealism: "admiral",
  difficulty: "standard",
  campaignSeed: "TEST",
} as DraftPreferences;

function launchableDraft(overrides: Partial<LaunchableDraft> = {}): LaunchableDraft {
  return {
    nationId: "uk",
    preferences,
    options: null,
    archetype: null,
    identity: null,
    fleetMethod: { legacyFleetModeId: "canonical_fixture" },
    recommendedPreset: null,
    ...overrides,
  };
}

function bridgeWith(execute: CampaignExecute): Pick<BluewaveDesktopBridge, "campaign"> {
  return { campaign: { execute } } as Pick<BluewaveDesktopBridge, "campaign">;
}

describe("isLaunchableDraft", () => {
  it("requires both preferences and a fleet method", () => {
    const bare: NewGameDraft = {
      nationId: "uk",
      preferences: null,
      options: null,
      archetype: null,
      identity: null,
      fleetMethod: null,
      recommendedPreset: null,
    };
    expect(isLaunchableDraft(null)).toBe(false);
    expect(isLaunchableDraft(bare)).toBe(false);
    expect(isLaunchableDraft({ ...bare, preferences })).toBe(false);
    expect(
      isLaunchableDraft({
        ...bare,
        preferences,
        fleetMethod: { legacyFleetModeId: "x" },
      }),
    ).toBe(true);
  });
});

describe("compileNewGame", () => {
  it("sends a compileCampaign command and returns the session id", async () => {
    const execute = vi.fn(async () => ({
      outcome: "success" as const,
      value: { sessionId: "ses-1" },
    })) as unknown as CampaignExecute;

    const result = await compileNewGame(bridgeWith(execute), launchableDraft());

    expect(result).toEqual({ kind: "compiled", sessionId: "ses-1" });
    expect(execute).toHaveBeenCalledWith(
      "compileCampaign",
      expect.objectContaining({ archetype: expect.any(String) }),
    );
  });

  it("treats a native save-location cancel as cancelled, not failed", async () => {
    const execute = vi.fn(async () => ({
      outcome: "rejected" as const,
      reason: "SAVE_LOCATION_CANCELLED",
      diagnostics: [],
    })) as unknown as CampaignExecute;

    expect(await compileNewGame(bridgeWith(execute), launchableDraft())).toEqual({
      kind: "cancelled",
    });
  });

  it("maps a rejection to a failed message carrying the diagnostics", async () => {
    const execute = vi.fn(async () => ({
      outcome: "rejected" as const,
      reason: "INVALID_CONFIG",
      diagnostics: ["bad seed", "bad nation"],
    })) as unknown as CampaignExecute;

    expect(await compileNewGame(bridgeWith(execute), launchableDraft())).toEqual({
      kind: "failed",
      message: "INVALID_CONFIG. bad seed; bad nation",
    });
  });

  it("normalizes a thrown transport error", async () => {
    const execute = vi.fn(async () => {
      throw new Error("ipc down");
    }) as unknown as CampaignExecute;

    expect(await compileNewGame(bridgeWith(execute), launchableDraft())).toEqual({
      kind: "failed",
      message: "COMPILE_FAILED.",
    });
  });
});
