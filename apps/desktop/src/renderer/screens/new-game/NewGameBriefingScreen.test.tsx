/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { OpeningBriefingProjection } from "@bluewave/campaign-engine";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { PrimaryAction } from "../../shell/primary-action.js";
import { NewGameBriefingScreen } from "./NewGameBriefingScreen.js";

function fixtureProjection(
  overrides: Partial<OpeningBriefingProjection> = {},
): OpeningBriefingProjection {
  return {
    nationId: "gb",
    nationName: "United Kingdom",
    month: { month: 1, year: 1880 },
    stateOfTheNavy: {
      shipClassCounts: [
        { label: "battleship", count: 2 },
        { label: "cruiser", count: 4 },
      ],
      shipsUnderConstruction: 1,
      mostExpensiveActiveClass: { className: "Majestic class", projectedCost: 150 },
      largestDockCapacity: 30,
      totalMaintenance: 1_200,
      constructionCommitted: 400,
    },
    treasury: {
      governmentAllocation: 2_000,
      fleetMaintenance: 1_000,
      constructionCommitted: 400,
      researchExpenditure: 500,
      projectedSurplus: 100,
      status: "narrow",
      obligations: 600,
    },
    foreignIntelligence: {
      relations: [
        {
          nationId: "germany",
          name: "German Empire",
          relation: "at_war",
          tension: 10,
          nap: false,
          controlledAreas: [],
        },
      ],
      playerAreas: [],
    },
    immediateConcerns: [
      { category: "budget_shortfall", message: "The projected monthly budget runs a deficit." },
    ],
    ...overrides,
  };
}

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

/** The briefing progress list's current step, by its accessible marker. */
function currentStep(): string {
  return document.querySelector('[aria-current="step"]')?.textContent ?? "";
}

function renderScreen(projection: OpeningBriefingProjection, onTakeCommand = vi.fn()) {
  const onInspect = vi
    .fn()
    .mockResolvedValue({ outcome: "success", value: { projection }, diagnostics: [] });
  let primary: PrimaryAction | null = null;
  const onPrimaryActionChange = vi.fn((action: PrimaryAction | null) => {
    primary = action;
  });
  const view = render(
    <NewGameBriefingScreen
      sessionId="s1"
      onInspectOpeningBriefing={onInspect}
      onTakeCommand={onTakeCommand}
      onPrimaryActionChange={onPrimaryActionChange}
    />,
  );
  return {
    onInspect,
    onTakeCommand,
    view,
    primaryLabel: () => primary?.label ?? null,
    triggerPrimary: () => act(() => primary?.onTrigger()),
  };
}

describe("NewGameBriefingScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("loads the projection and renders the Appointment page first with title and start date", async () => {
    const { primaryLabel } = renderScreen(fixtureProjection());
    await screen.findByText("Opening Strategic Briefing");
    expect(
      screen.getByText(/You have been appointed First Sea Lord — United Kingdom/),
    ).toBeTruthy();
    expect(screen.getByText("Appointment confirmed · January 1880")).toBeTruthy();
    // Page 1 keeps the flavorful forward label, not "Next". The label registers from an
    // effect that runs after the page text appears, so wait for it rather than read it once.
    await waitFor(() => expect(primaryLabel()).toBe("Review Naval Estimates"));
    // Back is not available on page 1.
    expect(screen.getByRole("button", { name: "Back" }).hasAttribute("disabled")).toBe(true);
  });

  it("walks the full five-page sequence then Take command fires the closing action", async () => {
    const onTakeCommand = vi.fn();
    const { primaryLabel, triggerPrimary } = renderScreen(fixtureProjection(), onTakeCommand);
    await screen.findByText("Opening Strategic Briefing");
    // `triggerPrimary` is a silent no-op until the primary action has registered.
    await waitFor(() => expect(primaryLabel()).toBe("Review Naval Estimates"));

    // Page 1 -> 2 via "Review Naval Estimates".
    triggerPrimary();
    expect(currentStep()).toContain("State of the Navy");
    expect(screen.getByText("Majestic class (£150)")).toBeTruthy();
    expect(screen.getByText("Ships under construction")).toBeTruthy();

    // Page 2 -> 3.
    expect(primaryLabel()).toBe("Continue to Treasury Position");
    triggerPrimary();
    expect(currentStep()).toContain("Treasury Position");
    expect(screen.getByText("Projected surplus / deficit")).toBeTruthy();
    expect(screen.getByText("narrow")).toBeTruthy();

    // Page 3 -> 4: the World Situation Briefing.
    expect(primaryLabel()).toBe("Continue to Foreign Intelligence");
    triggerPrimary();
    expect(
      screen.getByRole("heading", { level: 2, name: "World Situation Briefing" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { level: 4, name: "German Empire" })).toBeTruthy();

    // The page says it is review-only and where continuing leads.
    expect(
      screen.getByText(/Review only\. Nothing on this page changes your standing\./),
    ).toBeTruthy();
    expect(screen.getByText(/Continuing opens Immediate Concerns\./)).toBeTruthy();

    // Page 4 -> 5: the action names its destination.
    expect(primaryLabel()).toBe("Continue to Immediate Concerns");
    triggerPrimary();
    expect(currentStep()).toContain("Immediate Concerns");
    expect(screen.getByText("The projected monthly budget runs a deficit.")).toBeTruthy();

    // Back returns to page 4.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("heading", { level: 2, name: "World Situation Briefing" }),
    ).toBeTruthy();

    // Forward again then Take command.
    expect(primaryLabel()).toBe("Continue to Immediate Concerns");
    triggerPrimary();
    expect(primaryLabel()).toBe("Take command");
    triggerPrimary();
    expect(onTakeCommand).toHaveBeenCalledTimes(1);
  });

  it("shows an error state when the inspection fails", async () => {
    const onInspect = vi
      .fn()
      .mockResolvedValue({ outcome: "error", reason: "SESSION_NOT_FOUND", diagnostics: [] });
    render(
      <NewGameBriefingScreen
        sessionId="s1"
        onInspectOpeningBriefing={onInspect}
        onTakeCommand={vi.fn()}
        onPrimaryActionChange={vi.fn()}
      />,
    );
    await screen.findByText("Briefing unavailable");
    expect(screen.getByText(/SESSION_NOT_FOUND/)).toBeTruthy();
  });
});
