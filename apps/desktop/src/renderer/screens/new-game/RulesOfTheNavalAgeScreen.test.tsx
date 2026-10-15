/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { NewGameOptions } from "../../../shared/new-game-contract.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../../preload/index.js";
import type { AdmiralPresetValues } from "./admiral-preset.js";
import type { PrimaryAction } from "../../shell/primary-action.js";
import { PRESET_DEFINITIONS } from "./rules-of-the-naval-age-presets.js";
import { RulesOfTheNavalAgeScreen } from "./RulesOfTheNavalAgeScreen.js";

const options: NewGameOptions = {
  scenarios: [
    {
      id: "scen_1900",
      name: "January 1900",
      startYear: 1900,
      startMonth: 1,
      participantNationIds: ["nation_uk", "nation_germany"],
      playableNationIds: ["nation_uk", "nation_germany"],
    },
  ],
  nations: [
    { id: "nation_uk", name: "United Kingdom", regimeName: "Monarchy", regimeType: "monarchy" },
  ],
  supportedValues: {
    scenarioId: ["scen_1900"],
    playerSlotId: ["nation_uk", "nation_germany"],
    continuityMode: ["historical"],
    fleetSize: ["small", "standard", "large", "very_large"],
    researchSpeed: ["slow", "standard", "fast", "very_fast"],
    technologyVariation: ["none", "some", "considerable"],
    historicalBudget: ["standard", "historical"],
    legacyFleetMode: ["historical", "generated", "disabled"],
    tacticalRealism: ["standard", "realistic", "not_applicable"],
    difficulty: ["easy", "normal", "hard", "very_hard"],
  },
};

const execute = vi.fn(async (name: string) => {
  if (name === "listNewGameOptions") {
    return { outcome: "success" as const, value: options };
  }
  throw new Error(`unexpected command: ${name}`);
});

const bridge = { campaign: { execute } } as unknown as BluewaveDesktopBridge;

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  window.bluewave = bridge;
});

async function setupUi(recommendedPreset: AdmiralPresetValues | null = null) {
  const onCancel = vi.fn();
  const onNext = vi.fn();
  let primary: PrimaryAction | null = null;
  const utils = render(
    <RulesOfTheNavalAgeScreen
      recommendedPreset={recommendedPreset}
      onCancel={onCancel}
      onNext={onNext}
      onPrimaryActionChange={(action) => {
        primary = action;
      }}
    />,
  );
  // The deck and the setting controls only render once the options have loaded through the
  // bridge. Wait for them, or the tests below race the load on a busy machine.
  await screen.findByLabelText("Fleet Size");
  await screen.findByRole("listbox", { name: "Campaign presets" });
  return { ...utils, onCancel, onNext, getPrimary: () => primary };
}

function openSelectAndPick(labelText: string, optionName: string) {
  const trigger = screen.getByLabelText(labelText);
  fireEvent.click(trigger);
  // The panel is portaled to <body>, so reach it through the trigger's aria-controls.
  const listId = trigger.getAttribute("aria-controls");
  const list = listId ? document.getElementById(listId) : null;
  const option = within(list ?? document.body).getByRole("option", { name: optionName });
  fireEvent.click(option);
}

const SETTING_LABELS = [
  "Fleet Size",
  "Research Pace",
  "Technology Variation",
  "Historical Budget",
  "Tactical Realism",
  "Difficulty",
];

function presetListbox(): HTMLElement {
  return screen.getByRole("listbox", { name: "Campaign presets" });
}

function presetOption(name: string): HTMLElement {
  return within(presetListbox()).getByRole("option", { name });
}

/** The focused-preset panel is the region named after whichever preset is previewed. */
function detailPanel(presetName: string): HTMLElement {
  return screen.getByRole("region", { name: presetName });
}

/** The name the deck reports as currently applied: a preset, or "Custom". */
function appliedSetup(): string {
  const text = screen.getByRole("status").textContent ?? "";
  return text.replace(/^Current setup:\s*/u, "");
}

describe("RulesOfTheNavalAgeScreen", () => {
  it("splits into a preset deck and a detail column that sit side by side", async () => {
    await setupUi();

    const master = presetListbox().closest("aside");
    const detail = screen.getByRole("region", { name: "Preset details" });
    expect(master).not.toBeNull();
    expect(master?.parentElement).toBe(detail.parentElement);
    expect(master?.contains(detail)).toBe(false);
    // The forms live in the detail column, not the deck.
    expect(within(detail).getByLabelText("Fleet Size")).toBeTruthy();
    expect(within(detail).getByLabelText("Difficulty")).toBeTruthy();
    expect(within(master as HTMLElement).queryByLabelText("Fleet Size")).toBeNull();
  });

  it("carries no globe, and leaves the title and description to the shell header", async () => {
    const { container } = await setupUi();

    expect(container.querySelector("svg[aria-label='World map']")).toBeNull();
    expect(screen.queryByTestId("preset-globe-band")).toBeNull();
    // The shell header's secondary row shows these now; the screen no longer repeats them.
    expect(
      screen.queryByText("Set the era, scale, and historical uncertainty for this campaign."),
    ).toBeNull();
    expect(screen.queryByText("Rules of the Naval Age")).toBeNull();
  });

  it("lists exactly the four preset bundles as options of one listbox", async () => {
    await setupUi();

    expect(screen.getAllByRole("listbox")).toHaveLength(1);
    const names = within(presetListbox())
      .getAllByRole("option")
      .map((option) => option.getAttribute("aria-label"));
    expect(names).toEqual(PRESET_DEFINITIONS.map((preset) => preset.name));
    expect(names).toEqual(["Cadet", "Admiral", "Naval Historian", "Alternate History"]);
  });

  it("previews the focused preset's name, tagline and all six settings", async () => {
    await setupUi();

    const cadet = PRESET_DEFINITIONS[0];
    const panel = detailPanel("Cadet");
    expect(within(panel).getByText(cadet?.tagline ?? "")).toBeTruthy();
    expect(
      within(panel)
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual(SETTING_LABELS);
    expect(
      within(panel)
        .getAllByRole("definition")
        .map((definition) => definition.textContent),
    ).toEqual(["Small", "Standard", "Historical", "Standard", "Standard", "Easy"]);
  });

  it("has no Select button: the panel only reports whether the preset is applied", async () => {
    await setupUi();

    expect(screen.queryByRole("button", { name: /^Select/ })).toBeNull();
    expect(within(detailPanel("Cadet")).queryByText("Active")).toBeNull();

    fireEvent.keyDown(presetListbox(), { key: "Enter" });

    expect(within(detailPanel("Cadet")).getByText("Active")).toBeTruthy();
  });

  it("says a previewed preset will be applied by Next, until it is applied", async () => {
    await setupUi();

    // Looking at the default card promises nothing.
    expect(within(detailPanel("Cadet")).queryByText("Applies on Next")).toBeNull();

    fireEvent.keyDown(presetListbox(), { key: "ArrowRight" });
    expect(within(detailPanel("Admiral")).getByText("Applies on Next")).toBeTruthy();

    fireEvent.keyDown(presetListbox(), { key: "Enter" });
    expect(within(detailPanel("Admiral")).queryByText("Applies on Next")).toBeNull();
    expect(within(detailPanel("Admiral")).getByText("Active")).toBeTruthy();
  });

  it("starts on Custom because the loaded defaults match no preset", async () => {
    await setupUi();

    expect(appliedSetup()).toBe("Custom");
    for (const option of within(presetListbox()).getAllByRole("option")) {
      expect(option.getAttribute("aria-selected")).toBe("false");
    }
  });

  it.each([
    ["ArrowRight", "Admiral"],
    ["ArrowDown", "Admiral"],
    ["ArrowLeft", "Alternate History"],
    ["ArrowUp", "Alternate History"],
  ])("%s moves focus from Cadet to %s, wrapping at the ends", async (key, expectedName) => {
    await setupUi();

    fireEvent.keyDown(presetListbox(), { key });

    expect(detailPanel(expectedName)).toBeTruthy();
    expect(presetListbox().getAttribute("aria-activedescendant")).toBe(
      presetOption(expectedName).id,
    );
  });

  it("previews on focus changes without committing any preference", async () => {
    await setupUi();

    fireEvent.keyDown(presetListbox(), { key: "ArrowRight" });
    fireEvent.keyDown(presetListbox(), { key: "ArrowRight" });

    expect(detailPanel("Naval Historian")).toBeTruthy();
    expect(appliedSetup()).toBe("Custom");
    expect(screen.getByLabelText("Fleet Size").textContent).toContain("Small");
    expect(screen.getByLabelText("Difficulty").textContent).toContain("Easy");
  });

  it("keeps the previewed card when edited settings happen to match another preset", async () => {
    await setupUi();

    fireEvent.keyDown(presetListbox(), { key: "ArrowRight" });
    expect(detailPanel("Admiral")).toBeTruthy();

    // The loaded defaults differ from Cadet only in Research Pace.
    openSelectAndPick("Research Pace", "Standard");

    expect(appliedSetup()).toBe("Cadet");
    expect(detailPanel("Admiral")).toBeTruthy();
  });

  it("confirms the focused preset on Enter", async () => {
    await setupUi();

    fireEvent.keyDown(presetListbox(), { key: "ArrowRight" });
    fireEvent.keyDown(presetListbox(), { key: "Enter" });

    expect(appliedSetup()).toBe("Admiral");
    expect(screen.getByLabelText("Fleet Size").textContent).toContain("Standard");
    expect(screen.getByLabelText("Difficulty").textContent).toContain("Normal");
    expect(within(detailPanel("Admiral")).getByText("Active")).toBeTruthy();
    expect(presetOption("Admiral").getAttribute("aria-selected")).toBe("true");
  });

  it("applies a preset when any visible card, not just the top one, is tapped", async () => {
    await setupUi();

    fireEvent.pointerDown(presetOption("Naval Historian"), { button: 0, pointerId: 1 });

    expect(appliedSetup()).toBe("Naval Historian");
    expect(screen.getByLabelText("Fleet Size").textContent).toContain("Large");
    expect(screen.getByLabelText("Difficulty").textContent).toContain("Hard");
    expect(detailPanel("Naval Historian")).toBeTruthy();
  });

  it("moves focus without applying anything when a drag flings the top card away", async () => {
    await setupUi();

    fireEvent.pointerDown(presetOption("Cadet"), {
      button: 0,
      pointerId: 7,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 40, clientY: 0 });
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 220, clientY: 0 });
    fireEvent.pointerUp(window, { button: 0, pointerId: 7, clientX: 220, clientY: 0 });

    await waitFor(() => expect(detailPanel("Admiral")).toBeTruthy());
    expect(appliedSetup()).toBe("Custom");
    expect(screen.getByLabelText("Fleet Size").textContent).toContain("Small");
  });

  it("applies a preset's exact six-setting bundle, then reverts to Custom on a single edit", async () => {
    await setupUi();

    fireEvent.pointerDown(presetOption("Cadet"), { button: 0, pointerId: 1 });
    fireEvent.pointerUp(window, { button: 0, pointerId: 1 });
    expect(appliedSetup()).toBe("Cadet");
    expect(screen.getByLabelText("Fleet Size").textContent).toContain("Small");
    expect(screen.getByLabelText("Difficulty").textContent).toContain("Easy");

    openSelectAndPick("Difficulty", "Hard");

    expect(appliedSetup()).toBe("Custom");
    expect(presetOption("Cadet").getAttribute("aria-selected")).toBe("false");
  });

  it.each([
    ["Small", /faster turns, fewer ships/i],
    ["Standard", /recommended default/i],
    ["Large", /more ships to manage, slower turns/i],
    ["Very Large", /most ships to manage/i],
  ])("shows the qualitative readout for fleet size %s", async (optionName, expectedText) => {
    await setupUi();

    openSelectAndPick("Fleet Size", optionName);

    expect(screen.getByText(expectedText)).toBeTruthy();
  });

  it("presents each Era & Scale option with an icon and a secondary description", async () => {
    await setupUi();

    const scenarioTrigger = screen.getByLabelText("Starting Era");
    fireEvent.click(scenarioTrigger);
    const scenarioList = document.getElementById(
      scenarioTrigger.getAttribute("aria-controls") ?? "",
    );
    const scenarioOption = within(scenarioList ?? document.body).getByRole("option", {
      name: "January 1900",
    });
    expect(scenarioOption.querySelector("svg")).toBeTruthy();
    expect(within(scenarioOption).getByText("Begins January 1900 · 2 nations")).toBeTruthy();

    const fleetTrigger = screen.getByLabelText("Fleet Size");
    fireEvent.click(fleetTrigger);
    const fleetList = document.getElementById(fleetTrigger.getAttribute("aria-controls") ?? "");
    const fleetOption = within(fleetList ?? document.body).getByRole("option", { name: "Large" });
    expect(fleetOption.querySelector("svg")).toBeTruthy();
    expect(within(fleetOption).getByText(/more ships to manage, slower turns/)).toBeTruthy();
  });

  it("edits the campaign seed from the Era & Scale form", async () => {
    await setupUi();

    const seed = screen.getByLabelText("Campaign Seed");
    fireEvent.change(seed, { target: { value: "SEED-42" } });

    expect((screen.getByLabelText("Campaign Seed") as HTMLInputElement).value).toBe("SEED-42");
  });

  it("shows each Historical Uncertainty setting's label and updates it", async () => {
    await setupUi();

    for (const label of SETTING_LABELS.slice(1)) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    openSelectAndPick("Research Pace", "Fast");
    expect(screen.getByLabelText("Research Pace").textContent).toContain("Fast");
  });

  it("applies the previewed preset when Next is pressed", async () => {
    const { onNext, getPrimary } = await setupUi();

    fireEvent.keyDown(presetListbox(), { key: "ArrowRight" });
    expect(appliedSetup()).toBe("Custom");
    await waitFor(() => expect(getPrimary()?.disabled).toBe(false));
    act(() => getPrimary()?.onTrigger());

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    const [preferences] = onNext.mock.calls[0] as [Record<string, string>, NewGameOptions];
    expect(preferences).toMatchObject({
      fleetSize: "standard",
      researchSpeed: "standard",
      technologyVariation: "some",
      historicalBudget: "standard",
      tacticalRealism: "standard",
      difficulty: "normal",
    });
  });

  it("leaves hand-set values alone when Next is pressed without previewing a preset", async () => {
    const { onNext, getPrimary } = await setupUi();

    await waitFor(() => expect(getPrimary()?.disabled).toBe(false));
    act(() => getPrimary()?.onTrigger());

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    const [preferences] = onNext.mock.calls[0] as [Record<string, string>, NewGameOptions];
    // The loaded defaults, not Cadet's bundle (which differs in Research Pace).
    expect(preferences.researchSpeed).toBe("slow");
  });

  it("does not overwrite a setting edited after previewing a preset", async () => {
    const { onNext, getPrimary } = await setupUi();

    fireEvent.keyDown(presetListbox(), { key: "ArrowRight" });
    openSelectAndPick("Difficulty", "Hard");
    expect(within(detailPanel("Admiral")).queryByText("Applies on Next")).toBeNull();
    act(() => getPrimary()?.onTrigger());

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    const [preferences] = onNext.mock.calls[0] as [Record<string, string>, NewGameOptions];
    expect(preferences.difficulty).toBe("hard");
    expect(preferences.fleetSize).toBe("small");
  });

  it("returns to nation selection through Back", async () => {
    const { onCancel } = await setupUi();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables Next until options finish loading, then advances with the current preferences", async () => {
    const { onNext, getPrimary } = await setupUi();

    fireEvent.pointerDown(presetOption("Cadet"), { button: 0, pointerId: 1 });
    fireEvent.pointerUp(window, { button: 0, pointerId: 1 });
    await waitFor(() => expect(getPrimary()?.disabled).toBe(false));
    expect(getPrimary()?.label).toBe("Next: Choose Archetype");
    act(() => getPrimary()?.onTrigger());

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    const [preferences] = onNext.mock.calls[0] as [Record<string, string>, NewGameOptions];
    expect(preferences.fleetSize).toBe("small");
    expect(preferences.difficulty).toBe("easy");
  });
});
