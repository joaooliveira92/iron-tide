/* @vitest-environment jsdom */

import { ARCHETYPE_PRESETS } from "@bluewave/campaign-engine";
import type { ArchetypeSelection } from "@bluewave/campaign-engine";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type {
  CampaignCommandClient,
  CompileCampaignResult,
} from "../../shared/campaign-command-contract.js";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { NewGameOptions } from "../../shared/new-game-contract.js";
import { defaultFleetMethod } from "../screens/new-game/new-game-fleet-method-screen-state.js";
import { defaultCampaignIdentity } from "../screens/new-game/new-game-identity-screen-state.js";
import type { DraftPreferences } from "../screens/new-game/new-game-preferences-screen-state.js";
import { COSMETIC_MINIMUM_DURATION_MS } from "../screens/new-game/world-generation-presentation.js";
import { useNewGameFlow } from "./useNewGameFlow.js";

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
const options = {
  scenarios: [],
  nations: [],
  supportedValues: {},
} as unknown as NewGameOptions;

type CampaignExecute = CampaignCommandClient["execute"];

const compiledSuccess = vi.fn(async () => ({
  outcome: "success" as const,
  value: { sessionId: "ses-created" },
})) as unknown as CampaignExecute;

function setup(execute: CampaignExecute = compiledSuccess) {
  const selectScreen = vi.fn();
  const openCampaign = vi.fn(async () => undefined);
  const bridge = { campaign: { execute } } as Pick<BluewaveDesktopBridge, "campaign">;
  const rendered = renderHook(() => useNewGameFlow(bridge, { selectScreen, openCampaign }));
  return { ...rendered, selectScreen, openCampaign, execute };
}

const preferenceArchetype: ArchetypeSelection = {
  kind: "preset",
  id: ARCHETYPE_PRESETS[0]!.id,
  allocation: { ...ARCHETYPE_PRESETS[0]!.allocation },
};

/** Drives the flow forward to (but not through) the fleet-method step. */
function advanceToFleetMethod(actions: ReturnType<typeof setup>["result"]["current"]["actions"]) {
  act(() => actions.confirmNation("nation_uk"));
  act(() => actions.acceptPreferences(preferences, options));
  act(() => actions.acceptArchetype(preferenceArchetype));
  act(() => actions.acceptIdentity(defaultCampaignIdentity()));
}

/** Drives the flow forward through the fleet-method and review steps, ready to launch. */
function advanceToReview(
  actions: ReturnType<typeof setup>["result"]["current"]["actions"],
  fleetMethod = defaultFleetMethod(),
) {
  advanceToFleetMethod(actions);
  act(() => actions.acceptFleetMethod(fleetMethod));
}

describe("useNewGameFlow", () => {
  it("moves nation first, then through preferences, archetype, identity, and fleet method", () => {
    const { result, selectScreen } = setup();

    act(() => result.current.actions.start());
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-nation");

    act(() => result.current.actions.confirmNation("nation_uk"));
    expect(result.current.state.draft).toEqual({
      nationId: "nation_uk",
      preferences: null,
      options: null,
      archetype: null,
      identity: null,
      fleetMethod: null,
      recommendedPreset: null,
    });
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-preferences");

    act(() => result.current.actions.acceptPreferences(preferences, options));
    expect(result.current.state.draft?.preferences).toEqual(preferences);
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-archetype");

    act(() => result.current.actions.acceptArchetype(preferenceArchetype));
    expect(result.current.state.draft?.archetype).toEqual(preferenceArchetype);
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-identity");

    const identity = defaultCampaignIdentity();
    act(() => result.current.actions.acceptIdentity(identity));
    expect(result.current.state.draft?.identity).toEqual(identity);
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-fleet-method");

    act(() => result.current.actions.acceptFleetMethod(defaultFleetMethod()));
    expect(result.current.state.draft?.fleetMethod).toEqual(defaultFleetMethod());
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-review");
  });

  it("applies the recommended setup into the draft without navigating away", () => {
    const { result, selectScreen } = setup();

    act(() => result.current.actions.applyRecommendedSetup("nation_uk"));

    expect(result.current.state.draft).toEqual({
      nationId: "nation_uk",
      preferences: null,
      options: null,
      archetype: null,
      identity: null,
      fleetMethod: { legacyFleetModeId: "generated" },
      recommendedPreset: {
        fleetSize: "standard",
        researchSpeed: "standard",
        technologyVariation: "some",
        historicalBudget: "standard",
        tacticalRealism: "standard",
        difficulty: "normal",
      },
    });
    expect(selectScreen).not.toHaveBeenCalled();
  });

  it("preserves the archetype and nation when navigating backward and forward", () => {
    const { result, selectScreen } = setup();

    act(() => result.current.actions.confirmNation("nation_uk"));
    act(() => result.current.actions.acceptPreferences(preferences, options));
    act(() => result.current.actions.acceptArchetype(preferenceArchetype));
    expect(result.current.state.draft?.archetype).toEqual(preferenceArchetype);

    act(() => result.current.actions.backToArchetype());
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-archetype");
    act(() => result.current.actions.backToPreferences());
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-preferences");
    act(() => result.current.actions.backToNation());
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-nation");

    // Moving forward again keeps the already-chosen nation and archetype.
    act(() => result.current.actions.acceptPreferences(preferences, options));
    expect(result.current.state.draft?.nationId).toBe("nation_uk");
    expect(result.current.state.draft?.archetype).toEqual(preferenceArchetype);
  });

  it("compiles the campaign then hands off to the opening briefing, not the dashboard", async () => {
    const { result, execute, openCampaign, selectScreen } = setup();
    advanceToReview(result.current.actions);

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      let launchPromise: Promise<void> = Promise.resolve();
      act(() => {
        launchPromise = result.current.actions.launch();
      });
      expect(selectScreen).toHaveBeenLastCalledWith("new-game-launching");
      await vi.advanceTimersByTimeAsync(COSMETIC_MINIMUM_DURATION_MS);
      await act(() => launchPromise);
    } finally {
      vi.useRealTimers();
    }

    expect(execute).toHaveBeenCalledWith(
      "compileCampaign",
      expect.objectContaining({
        scenarioId: preferences.scenarioId,
        playerSlotId: "nation_uk",
      }),
    );
    // World generation auto-advances into the briefing, not straight to the
    // dashboard (spec §7 -> §8). The dashboard opens only on "Take command".
    expect(openCampaign).not.toHaveBeenCalled();
    expect(selectScreen).toHaveBeenLastCalledWith("opening-briefing");
    expect(result.current.state.briefingSessionId).toBe("ses-created");
    expect(result.current.state.draft).toBeNull();
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.status).toBe("ready");
  });

  it("takes command from the briefing into the existing Overview dashboard and clears the handoff", async () => {
    const { result, openCampaign, selectScreen } = setup();
    advanceToReview(result.current.actions);

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      let launchPromise: Promise<void> = Promise.resolve();
      act(() => {
        launchPromise = result.current.actions.launch();
      });
      await vi.advanceTimersByTimeAsync(COSMETIC_MINIMUM_DURATION_MS);
      await act(() => launchPromise);
    } finally {
      vi.useRealTimers();
    }

    await act(() => result.current.actions.takeCommand());
    expect(openCampaign).toHaveBeenCalledWith("ses-created");
    expect(result.current.state.briefingSessionId).toBeNull();
    expect(selectScreen).not.toHaveBeenLastCalledWith("new-game-launching");
  });

  it("sends the fleet-method screen's selected legacyFleetModeId, not the preferences default", async () => {
    const { result, execute } = setup();
    advanceToReview(result.current.actions, { legacyFleetModeId: "disabled" });

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      let launchPromise: Promise<void> = Promise.resolve();
      act(() => {
        launchPromise = result.current.actions.launch();
      });
      await vi.advanceTimersByTimeAsync(COSMETIC_MINIMUM_DURATION_MS);
      await act(() => launchPromise);
    } finally {
      vi.useRealTimers();
    }

    expect(execute).toHaveBeenCalledWith(
      "compileCampaign",
      expect.objectContaining({ legacyFleetModeId: "disabled" }),
    );
  });

  it("reports one of the five real compilation failures as a rejection, without waiting out the cosmetic timer", async () => {
    const execute = (async () => ({
      outcome: "rejected" as const,
      reason: "INVALID_CAMPAIGN_CONFIGURATION",
      diagnostics: ["difficulty is invalid"],
    })) as unknown as CampaignExecute;
    const { result, openCampaign, selectScreen } = setup(execute);
    advanceToReview(result.current.actions);

    await act(() => result.current.actions.launch());

    expect(selectScreen).toHaveBeenCalledWith("new-game-launching");
    expect(openCampaign).not.toHaveBeenCalled();
    expect(result.current.state.error).toBe(
      "INVALID_CAMPAIGN_CONFIGURATION. difficulty is invalid",
    );
    expect(result.current.state.status).toBe("ready");

    // Stays on the launching screen's error state until the player backs out.
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-launching");
    act(() => result.current.actions.backToReviewFromLaunch());
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-review");
    expect(result.current.state.error).toBeNull();

    act(() => result.current.actions.backToIdentity());
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-identity");
    act(() => result.current.actions.cancel());
    expect(selectScreen).toHaveBeenLastCalledWith("file");
  });

  it("routes a spec'd error-outcome failure (COMPILE_FAILED) to the launching error state, immediately and without a session", async () => {
    const execute = (async () => ({
      outcome: "error" as const,
      reason: "COMPILE_FAILED",
      diagnostics: [],
    })) as unknown as CampaignExecute;
    const { result, openCampaign, selectScreen } = setup(execute);
    advanceToReview(result.current.actions);

    await act(() => result.current.actions.launch());

    expect(selectScreen).toHaveBeenCalledWith("new-game-launching");
    expect(openCampaign).not.toHaveBeenCalled();
    expect(result.current.state.error).toBe("COMPILE_FAILED.");
    expect(result.current.state.status).toBe("ready");
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-launching");
  });

  it("returns silently to the review screen on SAVE_LOCATION_CANCELLED, without an error or waiting out the cosmetic timer", async () => {
    const execute = (async () => ({
      outcome: "rejected" as const,
      reason: "SAVE_LOCATION_CANCELLED",
      diagnostics: [],
    })) as unknown as CampaignExecute;
    const { result, openCampaign, selectScreen } = setup(execute);
    advanceToReview(result.current.actions);

    await act(() => result.current.actions.launch());

    expect(selectScreen).toHaveBeenCalledWith("new-game-launching");
    expect(selectScreen).toHaveBeenLastCalledWith("new-game-review");
    expect(openCampaign).not.toHaveBeenCalled();
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.status).toBe("ready");
    expect(result.current.state.draft).not.toBeNull();
  });

  it("exposes starting state while compilation is unresolved", async () => {
    let resolveCompilation: (value: BridgeResult<CompileCampaignResult>) => void = () => undefined;
    const execute = (() =>
      new Promise<BridgeResult<CompileCampaignResult>>((resolve) => {
        resolveCompilation = resolve;
      })) as unknown as CampaignExecute;
    const { result } = setup(execute);
    advanceToReview(result.current.actions);

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      let launchPromise: Promise<void> = Promise.resolve();
      act(() => {
        launchPromise = result.current.actions.launch();
      });
      expect(result.current.state.status).toBe("launching");

      resolveCompilation({
        outcome: "success",
        value: { sessionId: "ses-created" },
        diagnostics: [],
      });
      await vi.advanceTimersByTimeAsync(COSMETIC_MINIMUM_DURATION_MS);
      await act(() => launchPromise);
    } finally {
      vi.useRealTimers();
    }
    expect(result.current.state.status).toBe("ready");
  });
});
