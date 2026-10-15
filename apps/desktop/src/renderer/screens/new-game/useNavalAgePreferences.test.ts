import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import type { NewGameOptions } from "../../../shared/new-game-contract.js";
import { useNavalAgePreferences, type NewGameOptionsPort } from "./useNavalAgePreferences.js";

const supportedValues = {
  scenarioId: ["s1"],
  playerSlotId: ["n1"],
  continuityMode: ["historical"],
  fleetSize: ["small"],
  researchSpeed: ["standard"],
  technologyVariation: ["none"],
  historicalBudget: ["standard"],
  legacyFleetMode: ["historical"],
  tacticalRealism: ["standard"],
  difficulty: ["normal"],
};

const options = {
  scenarios: [
    {
      id: "s1",
      name: "January 1900",
      startYear: 1900,
      startMonth: 1,
      participantNationIds: ["n1"],
      playableNationIds: ["n1"],
    },
  ],
  nations: [],
  supportedValues,
} as unknown as NewGameOptions;

function portFor(execute: (name: string) => Promise<unknown>): NewGameOptionsPort {
  return { campaign: { execute } } as unknown as NewGameOptionsPort;
}

describe("useNavalAgePreferences", () => {
  it("loads through the injected port and becomes ready to proceed", async () => {
    const execute = vi.fn(async () => ({
      outcome: "success" as const,
      value: options,
      diagnostics: [],
    }));

    const { result } = renderHook(() => useNavalAgePreferences(null, portFor(execute)));

    await waitFor(() => expect(result.current.state.loading).toBe(false));
    expect(execute).toHaveBeenCalledWith("listNewGameOptions", undefined);
    expect(result.current.options).toBe(options);
    expect(result.current.ready).toBe(true);
  });

  it("surfaces the engine reason when the options cannot be listed", async () => {
    const execute = vi.fn(async () => ({
      outcome: "rejected" as const,
      reason: "OPTIONS_UNAVAILABLE",
      diagnostics: [],
    }));

    const { result } = renderHook(() => useNavalAgePreferences(null, portFor(execute)));

    await waitFor(() => expect(result.current.state.loading).toBe(false));
    expect(result.current.state.error).toBe("OPTIONS_UNAVAILABLE");
    expect(result.current.options).toBeNull();
    expect(result.current.ready).toBe(false);
  });

  it("updates a single preference without touching the others", async () => {
    const execute = vi.fn(async () => ({
      outcome: "success" as const,
      value: options,
      diagnostics: [],
    }));
    const { result } = renderHook(() => useNavalAgePreferences(null, portFor(execute)));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const before = result.current.preferences;

    act(() => result.current.setPreference("difficulty", "hard"));

    expect(result.current.preferences.difficulty).toBe("hard");
    expect(result.current.preferences.fleetSize).toBe(before.fleetSize);
  });
});
