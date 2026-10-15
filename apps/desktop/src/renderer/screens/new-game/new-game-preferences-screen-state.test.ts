import { describe, expect, it } from "vite-plus/test";
import type { NewGameOptions } from "../../../shared/new-game-contract.js";
import {
  applyOptionsFailed,
  applyOptionsLoaded,
  initialNewGamePreferencesScreenState,
  isReadyToProceed,
  selectedScenario,
  updatePreference,
} from "./new-game-preferences-screen-state.js";

const options: NewGameOptions = {
  scenarios: [
    {
      id: "scen_1900",
      name: "January 1900",
      startYear: 1900,
      startMonth: 1,
      participantNationIds: ["nation_uk"],
      playableNationIds: ["nation_uk"],
    },
  ],
  nations: [
    {
      id: "nation_uk",
      name: "United Kingdom",
      regimeName: "Constitutional Monarchy",
      regimeType: "constitutional_monarchy",
    },
  ],
  supportedValues: {
    scenarioId: ["scen_1900"],
    playerSlotId: ["nation_uk", "nation_germany"],
    continuityMode: ["historical"],
    fleetSize: ["standard"],
    researchSpeed: ["standard"],
    technologyVariation: ["none"],
    historicalBudget: ["canonical"],
    legacyFleetMode: ["canonical_fixture"],
    tacticalRealism: ["admiral"],
    difficulty: ["standard"],
  },
};

describe("new-game-preferences-screen-state", () => {
  it("starts empty and not ready", () => {
    const state = initialNewGamePreferencesScreenState();
    expect(state.loading).toBe(true);
    expect(isReadyToProceed(state)).toBe(false);
  });

  it("seeds defaults from loaded options", () => {
    const loaded = applyOptionsLoaded(initialNewGamePreferencesScreenState(), options, "SEED-1");
    expect(loaded.loading).toBe(false);
    expect(loaded.preferences.scenarioId).toBe("scen_1900");
    expect(loaded.preferences.difficulty).toBe("standard");
    expect(loaded.preferences.campaignSeed).toBe("SEED-1");
    expect(isReadyToProceed(loaded)).toBe(true);
    expect(selectedScenario(loaded)?.name).toBe("January 1900");
  });

  it("records a load failure without becoming ready", () => {
    const failed = applyOptionsFailed(
      initialNewGamePreferencesScreenState(),
      "CONTENT_COMPILATION_FAILED",
    );
    expect(failed.loading).toBe(false);
    expect(failed.error).toBe("CONTENT_COMPILATION_FAILED");
    expect(isReadyToProceed(failed)).toBe(false);
  });

  it("rejects an empty campaign seed", () => {
    const loaded = applyOptionsLoaded(initialNewGamePreferencesScreenState(), options, "SEED-1");
    const cleared = updatePreference(loaded, "campaignSeed", "   ");
    expect(isReadyToProceed(cleared)).toBe(false);
  });

  it("updates a single preference field", () => {
    const loaded = applyOptionsLoaded(initialNewGamePreferencesScreenState(), options, "SEED-1");
    const updated = updatePreference(loaded, "campaignSeed", "CUSTOM-SEED");
    expect(updated.preferences.campaignSeed).toBe("CUSTOM-SEED");
    expect(loaded.preferences.campaignSeed).toBe("SEED-1");
  });

  it("seeds the six preset-covered fields from a recommended preset instead of the first supported value", () => {
    const wideOptions: NewGameOptions = {
      ...options,
      supportedValues: {
        ...options.supportedValues,
        fleetSize: ["small", "standard"],
        difficulty: ["easy", "normal"],
      },
    };
    const loaded = applyOptionsLoaded(
      initialNewGamePreferencesScreenState(),
      wideOptions,
      "SEED-1",
      {
        fleetSize: "standard",
        researchSpeed: "standard",
        technologyVariation: "none",
        historicalBudget: "canonical",
        tacticalRealism: "admiral",
        difficulty: "normal",
      },
    );
    expect(loaded.preferences.fleetSize).toBe("standard");
    expect(loaded.preferences.difficulty).toBe("normal");
    // Non-preset fields still fall back to the first supported value.
    expect(loaded.preferences.scenarioId).toBe("scen_1900");
  });
});
