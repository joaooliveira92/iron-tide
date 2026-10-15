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
    },
    foreignIntelligence: {
      relations: [{ nationId: "germany", name: "German Empire", relation: "at_war", tension: 10 }],
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
    expect(screen.getByText("State of the Navy")).toBeTruthy();
    expect(screen.getByText("Majestic class (£150)")).toBeTruthy();
    expect(screen.getByText("Ships under construction")).toBeTruthy();

    // Page 2 -> 3.
    expect(primaryLabel()).toBe("Next");
    triggerPrimary();
    expect(screen.getByText("Treasury Position")).toBeTruthy();
    expect(screen.getByText("Projected surplus / deficit")).toBeTruthy();
    expect(screen.getByText("narrow")).toBeTruthy();

    // Page 3 -> 4.
    expect(primaryLabel()).toBe("Next");
    triggerPrimary();
    expect(screen.getByText("Foreign Intelligence")).toBeTruthy();
    expect(screen.getByText("German Empire")).toBeTruthy();
    expect(screen.getByText("At war")).toBeTruthy();
    expect(screen.getByText("War imminent")).toBeTruthy();
    expect(screen.getByText("10/10")).toBeTruthy();

    // Page 4 -> 5.
    expect(primaryLabel()).toBe("Next");
    triggerPrimary();
    expect(screen.getByText("Immediate Concerns")).toBeTruthy();
    expect(screen.getByText("The projected monthly budget runs a deficit.")).toBeTruthy();

    // Back returns to page 4.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Foreign Intelligence")).toBeTruthy();

    // Forward again then Take command.
    expect(primaryLabel()).toBe("Next");
    triggerPrimary();
    expect(primaryLabel()).toBe("Take command");
    triggerPrimary();
    expect(onTakeCommand).toHaveBeenCalledTimes(1);
  });

  it("renders flags and expressive relation/tension treatments on the Foreign Intelligence page", async () => {
    const { view, primaryLabel, triggerPrimary } = renderScreen(
      fixtureProjection({
        foreignIntelligence: {
          relations: [
            { nationId: "germany", name: "German Empire", relation: "neutral", tension: 5 },
            { nationId: "france", name: "France", relation: "allied", tension: 1 },
          ],
        },
      }),
    );
    await screen.findByText("Opening Strategic Briefing");
    await waitFor(() => expect(primaryLabel()).toBe("Review Naval Estimates"));
    triggerPrimary(); // 1 -> 2
    triggerPrimary(); // 2 -> 3
    triggerPrimary(); // 3 -> 4
    expect(screen.getByText("Foreign Intelligence")).toBeTruthy();

    // A flag image renders for each power.
    expect(view.container.querySelectorAll("img")).toHaveLength(2);

    // Relation vocabulary is spelled out with its own pill.
    expect(screen.getByText("Allied")).toBeTruthy();
    // A "neutral" relation at the "neutral" band collapses to one word — the pill
    // carries it; the band word is suppressed rather than repeating it.
    expect(screen.getAllByText("Neutral")).toHaveLength(1);
    expect(screen.getByText("Cordial")).toBeTruthy();

    // The tension meter is a real 10-segment bar, tinted by the engine's band.
    const neutralMeter = screen.getByRole("img", { name: "Tension 5 of 10" });
    expect(neutralMeter.querySelectorAll(".bg-amber-500")).toHaveLength(5);
    const cordialMeter = screen.getByRole("img", { name: "Tension 1 of 10" });
    expect(cordialMeter.querySelectorAll(".bg-emerald-500")).toHaveLength(1);
  });

  it("orders relations most-hostile first so the forecast surfaces at the top", async () => {
    const { primaryLabel, triggerPrimary } = renderScreen(
      fixtureProjection({
        foreignIntelligence: {
          relations: [
            { nationId: "france", name: "France", relation: "neutral", tension: 2 },
            { nationId: "germany", name: "German Empire", relation: "at_war", tension: 10 },
            { nationId: "japan", name: "Japan", relation: "neutral", tension: 6 },
          ],
        },
      }),
    );
    await screen.findByText("Opening Strategic Briefing");
    await waitFor(() => expect(primaryLabel()).toBe("Review Naval Estimates"));
    triggerPrimary();
    triggerPrimary();
    triggerPrimary();
    const names = screen
      .getAllByText(/(German Empire|France|Japan)$/)
      .map((node) => node.textContent);
    expect(names).toEqual(["German Empire", "Japan", "France"]);
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
