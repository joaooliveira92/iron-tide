/* @vitest-environment jsdom */
import { ARCHETYPE_PRESETS, type ArchetypeSelection } from "@bluewave/campaign-engine";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import type { NewGameOptions } from "../../../shared/new-game-contract.js";
import { NewGameCommissioningReviewScreen } from "./NewGameCommissioningReviewScreen.js";
import { defaultFleetMethod } from "./new-game-fleet-method-screen-state.js";
import { defaultCampaignIdentity } from "./new-game-identity-screen-state.js";
import type { DraftPreferences } from "./new-game-preferences-screen-state.js";

const preferences: DraftPreferences = {
  version: "campaign_configuration_v1",
  scenarioId: "scen_1900",
  continuityMode: "historical",
  fleetSize: "standard",
  researchSpeed: "standard",
  technologyVariation: "some",
  historicalBudget: "standard",
  legacyFleetMode: "generated",
  tacticalRealism: "standard",
  difficulty: "normal",
  campaignSeed: "TEST",
};

const options: NewGameOptions = {
  scenarios: [
    {
      id: "scen_1900",
      name: "1900 — The Dawn of Steel",
      startYear: 1900,
      startMonth: 1,
      participantNationIds: [],
      playableNationIds: [],
    },
  ],
  nations: [],
  supportedValues: {} as NewGameOptions["supportedValues"],
};

const archetype: ArchetypeSelection = {
  kind: "preset",
  id: ARCHETYPE_PRESETS[0]!.id,
  allocation: { ...ARCHETYPE_PRESETS[0]!.allocation },
};

const identity = {
  ...defaultCampaignIdentity(),
  admiralName: "John Fisher",
  campaignName: "Britannia Ascendant",
};

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
  }
});

function setupUi(nationId = "gb") {
  const onPrimaryActionChange = vi.fn() as unknown as SetPrimaryAction;
  const onBeginCommission = vi.fn();
  const onBack = vi.fn();
  const utils = render(
    <NewGameCommissioningReviewScreen
      nationId={nationId}
      options={options}
      preferences={preferences}
      archetype={archetype}
      identity={identity}
      fleetMethod={defaultFleetMethod()}
      status="ready"
      error={null}
      onBack={onBack}
      onBeginCommission={onBeginCommission}
      onPrimaryActionChange={onPrimaryActionChange}
    />,
  );
  return { ...utils, onBeginCommission, onBack, onPrimaryActionChange };
}

function lastPrimary(onPrimaryActionChange: ReturnType<typeof setupUi>["onPrimaryActionChange"]): {
  label?: string;
  disabled?: boolean;
  onTrigger?: () => void;
} {
  const calls = vi
    .mocked(onPrimaryActionChange)
    .mock.calls.map((call) => call[0])
    .filter(Boolean);
  return calls[calls.length - 1] ?? {};
}

describe("NewGameCommissioningReviewScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders every summary row from draft state, with no cut fields", () => {
    setupUi();
    expect(screen.getByText("Nation")).toBeTruthy();
    expect(screen.getByText("United Kingdom")).toBeTruthy();
    expect(screen.getByText("Era")).toBeTruthy();
    expect(screen.getByText("1900 — The Dawn of Steel")).toBeTruthy();
    expect(screen.getByText("John Fisher")).toBeTruthy();
    expect(screen.getByText("Britannia Ascendant")).toBeTruthy();

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/Aviation development/i);
    expect(text).not.toMatch(/Tutorial adviser/i);
    expect(text).not.toMatch(/Economic model/i);
    expect(text).not.toMatch(/Campaign scale/i);
  });

  it("shows the active preset as an annotation, not a duplicate row", () => {
    setupUi();
    expect(screen.getByText(/Rules of the Naval Age: Admiral/)).toBeTruthy();
    expect(screen.queryByText("Preset")).toBeNull();
  });

  it("folds the summary into three icon-headed sections, each row marked with an icon", () => {
    setupUi();
    expect(screen.getByRole("heading", { name: "The Command" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Historical Uncertainty" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Admiralty Identity" })).toBeTruthy();

    for (const label of ["Nation", "Difficulty", "Campaign name"]) {
      const cell = screen.getByText(label).closest("td");
      expect(cell?.querySelector("svg")).toBeTruthy();
    }
  });

  it("renders a non-empty strategic forecast panel with expected pressures", () => {
    setupUi();
    expect(screen.getByText(/Strategic forecast/)).toBeTruthy();
    expect(screen.getByText("Doctrine")).toBeTruthy();
    expect(screen.getByText("Strategic regions")).toBeTruthy();
    expect(screen.getByText("National character")).toBeTruthy();
    expect(screen.getByText("Expected pressures")).toBeTruthy();
  });

  it("renders the forecast even when the draft carries a compiled nation id", () => {
    setupUi("uk");
    expect(screen.getByText("United Kingdom")).toBeTruthy();
    expect(screen.getByText(/Strategic forecast/)).toBeTruthy();
  });

  it("shows only Back and Begin Commission, no Save-as-Preset or reroll buttons", () => {
    const { onPrimaryActionChange } = setupUi();
    expect(screen.getByRole("button", { name: "Back to Fleet Method" })).toBeTruthy();
    expect(lastPrimary(onPrimaryActionChange).label).toBe("Begin Commission");
    expect(screen.queryByText(/Save as Preset/i)).toBeNull();
    expect(screen.queryByText(/Generate Another Starting Fleet/i)).toBeNull();
  });

  it("triggers onBeginCommission via the primary action", () => {
    const { onPrimaryActionChange, onBeginCommission } = setupUi();
    lastPrimary(onPrimaryActionChange).onTrigger?.();
    expect(onBeginCommission).toHaveBeenCalledTimes(1);
  });

  it("calls onBack when Back is clicked", () => {
    const { onBack } = setupUi();
    fireEvent.click(screen.getByRole("button", { name: "Back to Fleet Method" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
