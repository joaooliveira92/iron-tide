import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { DEFAULT_APP_PREFERENCES } from "../../shared/preferences-contract.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import { PreferencesProvider } from "../lib/preferences-context.js";
import { createPreferencesBridgeStub } from "../lib/preferences-test-bridge.js";
import { DensityProvider } from "./DensityContext.js";
import { axeViolations } from "../lib/axe.js";
import { StatusStripView } from "./StatusStrip.js";
import { buildStatusStrip } from "./status-strip-state.js";
import type { PlayerProjection } from "@bluewave/campaign-engine";

function model(balance: number) {
  const projection = {
    projectedSurplusDeficit: balance,
    economy: {
      treasury: 50000,
      monthlyAppropriation: 5000,
      shipyardCapacity: 7,
      constructionSpend: 1000,
      researchSpend: 800,
      maintenanceCost: 2000,
      obligations: 500,
      researchRequested: 800,
      researchCap: 600,
      plannedConstruction: 1000,
      projectedNet: balance,
      shortfall: 0,
      status: balance < 0 ? "deficit" : "healthy",
      monthEndTreasury: 50000 + balance,
    },
    nationName: "Britain",
    fleet: [],
    strategicAreas: [],
    ports: [],
  } as unknown as PlayerProjection;
  return buildStatusStrip({ projection, areas: [], alertsCount: 2 });
}

async function renderStrip(
  balance = 1200,
  interfaceDensity: "comfortable" | "compact" = "comfortable",
) {
  const stub = createPreferencesBridgeStub({ ...DEFAULT_APP_PREFERENCES, interfaceDensity });
  const result = render(
    <BridgeProvider bridge={stub.bridge}>
      <PreferencesProvider>
        <DensityProvider>
          <StatusStripView model={model(balance)} />
        </DensityProvider>
      </PreferencesProvider>
    </BridgeProvider>,
  );
  // Flush the provider's async read so its state update lands inside `act`.
  await act(async () => {});
  return result;
}

describe("StatusStripView", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("is a labelled region with Nation and Budget groups, expanded by default", async () => {
    await renderStrip();
    const region = screen.getByRole("region", { name: "Status strip" });
    expect(within(region).getByRole("group", { name: "Nation" })).toBeTruthy();
    expect(within(region).getByRole("group", { name: "Budget" })).toBeTruthy();
    expect(within(region).getByText("Monthly appropriation")).toBeTruthy();
    expect(screen.getByRole("button", { name: /collapse/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("keeps deferred rows out of the expanded band", async () => {
    await renderStrip();
    const region = screen.getByRole("region", { name: "Status strip" });
    expect(within(region).queryByText("Prestige")).toBeNull();
    expect(within(region).getByText("Shipyard capacity (port levels)")).toBeTruthy();
    expect(within(region).getByText("Committed expenses")).toBeTruthy();
  });

  it("keeps deferred rows in one popover with their reasons, out of the expanded band", async () => {
    await renderStrip();
    const trigger = screen.getByRole("button", { name: /Not yet modelled \(\d+\)/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Prestige")).toBeNull();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const prestige = screen.getByText("Prestige").closest("[data-row]") as HTMLElement;
    expect(prestige.getAttribute("data-deferred")).toBe("true");
    expect(within(prestige).getByText(/no prestige mechanic/i)).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByText("Prestige")).toBeNull();
  });

  it("states a deficit in words, not colour alone", async () => {
    await renderStrip(-450);
    const balance = screen
      .getByText("Monthly balance (projected)")
      .closest("[data-row]") as HTMLElement;
    expect(within(balance).getByText("-£450")).toBeTruthy();
    expect(within(balance).getByText("Deficit")).toBeTruthy();
    expect(balance.getAttribute("data-tone")).toBe("alert");
  });

  it("collapses to a one-liner with balance, treasury and alerts, and expands again", async () => {
    await renderStrip();
    fireEvent.click(screen.getByRole("button", { name: /collapse/i }));
    const region = screen.getByRole("region", { name: "Status strip" });
    expect(within(region).queryByRole("group", { name: "Nation" })).toBeNull();
    expect(region.textContent).toContain("£1,200");
    expect(region.textContent).toContain("Healthy");
    expect(region.textContent).toContain("£50,000");
    expect(region.textContent).toContain("2 alerts");
    fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    expect(within(region).getByRole("group", { name: "Nation" })).toBeTruthy();
  });

  it("starts as a one-liner in compact density", async () => {
    await renderStrip(1200, "compact");
    await waitFor(() => expect(screen.queryByRole("group", { name: "Nation" })).toBeNull());
    expect(screen.getByRole("button", { name: /expand/i })).toBeTruthy();
  });

  it("draws the appropriation as a described stacked bar with a legend of shares", async () => {
    await renderStrip();
    const budget = screen.getByRole("group", { name: "Budget" });
    const bar = within(budget).getByRole("img", { name: /of the monthly appropriation/i });
    expect(bar.getAttribute("aria-label")).toContain("£3,300");
    expect(bar.getAttribute("aria-label")).toContain("66%");
    const maintenance = within(budget).getByText("Maintenance").closest("[data-row]");
    expect(maintenance?.textContent).toContain("£2,000");
    expect(maintenance?.textContent).toContain("40%");
    expect(budget.querySelectorAll("[data-segment]").length).toBe(4);
  });

  it("names the nation and puts treasury and balance in an outlook group", async () => {
    await renderStrip();
    const region = screen.getByRole("region", { name: "Status strip" });
    expect(within(region).getAllByText("Britain").length).toBeGreaterThan(0);
    const outlook = within(region).getByRole("group", { name: "Outlook" });
    expect(within(outlook).getByText("Treasury")).toBeTruthy();
    expect(within(outlook).getByText("Monthly balance (projected)")).toBeTruthy();
  });

  it("says so in words when the committed lines exceed the appropriation", async () => {
    const stub = createPreferencesBridgeStub({ ...DEFAULT_APP_PREFERENCES });
    const base = model(100);
    render(
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <DensityProvider>
            <StatusStripView
              model={{ ...base, allocation: { ...base.allocation, overCommitted: true } }}
            />
          </DensityProvider>
        </PreferencesProvider>
      </BridgeProvider>,
    );
    await act(async () => {});
    expect(screen.getAllByText(/over-committed/i).length).toBeGreaterThan(0);
    const bar = within(screen.getByRole("group", { name: "Budget" })).getByRole("img");
    expect(bar.getAttribute("aria-label")).toMatch(/over-committed/);
  });

  it("draws no bar segment for a zero line", async () => {
    const stub = createPreferencesBridgeStub({ ...DEFAULT_APP_PREFERENCES });
    const base = model(100);
    render(
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <DensityProvider>
            <StatusStripView
              model={{
                ...base,
                allocation: {
                  ...base.allocation,
                  segments: base.allocation.segments.map((s) =>
                    s.id === "research" ? { ...s, fraction: 0 } : s,
                  ),
                },
              }}
            />
          </DensityProvider>
        </PreferencesProvider>
      </BridgeProvider>,
    );
    await act(async () => {});
    const budget = screen.getByRole("group", { name: "Budget" });
    expect(budget.querySelector("[data-segment=research]")).toBeNull();
    expect(within(budget).getByText("Research")).toBeTruthy();
  });

  it("has no axe violations expanded, in deficit, or with the deferred popover open", async () => {
    const { container } = await renderStrip(-450);
    expect(await axeViolations(container)).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: /Not yet modelled \(\d+\)/ }));
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("opens a full card for a budget line on keyboard focus and links it to the bar", async () => {
    await renderStrip();
    const budget = screen.getByRole("group", { name: "Budget" });
    const label = within(budget).getByText("Maintenance");
    act(() => {
      label.focus();
    });
    expect(await screen.findByText("Over a year")).toBeTruthy();
    expect(screen.getByText("£24,000")).toBeTruthy();
    expect(budget.querySelector("[data-segment=maintenance]")?.getAttribute("data-active")).toBe(
      "true",
    );
    expect(budget.querySelector("[data-segment=research]")?.className).toContain("opacity-30");
  });

  it("walks the appropriation down to the balance in the balance card", async () => {
    await renderStrip(1200);
    const outlook = screen.getByRole("group", { name: "Outlook" });
    act(() => {
      within(outlook).getByText("Monthly balance (projected)").focus();
    });
    expect(await screen.findByText("Balance breakdown")).toBeTruthy();
    const steps = [...document.querySelectorAll("[data-step]")].map((el) =>
      el.getAttribute("data-step"),
    );
    expect(steps).toEqual(["obligations", "maintenance", "research", "balance"]);
    expect(screen.getByText("With construction at its upper bound")).toBeTruthy();
  });

  describe("pinning a card", () => {
    async function openMaintenance() {
      await renderStrip();
      const budget = screen.getByRole("group", { name: "Budget" });
      const label = within(budget).getByText("Maintenance");
      act(() => {
        label.focus();
      });
      await screen.findByText("Over a year");
      return label;
    }

    it("keeps a pinned card open after focus leaves, with a hint on how to close it", async () => {
      const label = await openMaintenance();
      fireEvent.click(label);
      act(() => {
        label.blur();
      });
      // A pinned card ignores hover-out and blur.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));
      });
      expect(screen.getByText("Over a year")).toBeTruthy();
      expect(screen.getByText(/Pinned\. Press Esc/)).toBeTruthy();
    });

    it("unpins and closes on Escape", async () => {
      const label = await openMaintenance();
      fireEvent.click(label);
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      await waitFor(() => expect(screen.queryByText("Over a year")).toBeNull());
    });

    it("pins from the keyboard with Enter on a label", async () => {
      const label = await openMaintenance();
      expect(label.getAttribute("role")).toBe("button");
      fireEvent.keyDown(label, { key: "Enter" });
      act(() => {
        label.blur();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));
      });
      expect(screen.getByText(/Pinned\. Press Esc/)).toBeTruthy();
    });

    it("toggles: a second click unpins", async () => {
      const label = await openMaintenance();
      fireEvent.click(label);
      expect(screen.getByText(/Pinned\. Press Esc/)).toBeTruthy();
      fireEvent.click(label);
      await waitFor(() => expect(screen.queryByText("Over a year")).toBeNull());
    });

    it("pins a collapsed chip, which is already a button", async () => {
      await renderStrip();
      fireEvent.click(screen.getByRole("button", { name: /collapse/i }));
      const chip = screen.getByRole("button", { name: /^Treasury/ });
      fireEvent.click(chip);
      expect(await screen.findByText("Next month end")).toBeTruthy();
      expect(screen.getByText(/Pinned\. Press Esc/)).toBeTruthy();
    });
  });

  it("shows foreign-station tonnage per area and per ship in its card", async () => {
    const stub = createPreferencesBridgeStub({ ...DEFAULT_APP_PREFERENCES });
    const base = model(100);
    render(
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <DensityProvider>
            <StatusStripView
              model={{
                ...base,
                stations: {
                  total: 3,
                  foreign: 2,
                  foreignTons: "17,880 t",
                  totalTons: "30,000 t",
                  foreignTonsFraction: 17_880 / 30_000,
                  unknown: false,
                  foreignGroups: [
                    {
                      areaId: "a_foreign",
                      areaName: "Biscay",
                      controller: "fra",
                      tons: "17,880 t",
                      ships: [
                        { name: "HMS Alexandra", tons: 11_880 },
                        { name: "HMS Temeraire", tons: 6_000 },
                      ],
                    },
                  ],
                },
              }}
            />
          </DensityProvider>
        </PreferencesProvider>
      </BridgeProvider>,
    );
    await act(async () => {});
    act(() => {
      screen.getByText("Ships on foreign stations").focus();
    });
    expect(await screen.findByText("Foreign stations")).toBeTruthy();
    expect(screen.getByText("17,880 t of 30,000 t")).toBeTruthy();
    expect(screen.getByText(/2 ships · 17,880 t/)).toBeTruthy();
    expect(screen.getByText("11,880 t")).toBeTruthy();
    expect(screen.getByText(/each ship's design displacement/i)).toBeTruthy();
  });

  it("says why tonnage is missing when a foreign ship has no known design", async () => {
    const stub = createPreferencesBridgeStub({ ...DEFAULT_APP_PREFERENCES });
    const base = model(100);
    render(
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <DensityProvider>
            <StatusStripView
              model={{
                ...base,
                stations: {
                  total: 1,
                  foreign: 1,
                  foreignTons: null,
                  totalTons: null,
                  foreignTonsFraction: null,
                  unknown: false,
                  foreignGroups: [
                    {
                      areaId: "a_foreign",
                      areaName: "Biscay",
                      controller: "fra",
                      tons: null,
                      ships: [{ name: "HMS Alexandra", tons: null }],
                    },
                  ],
                },
              }}
            />
          </DensityProvider>
        </PreferencesProvider>
      </BridgeProvider>,
    );
    await act(async () => {});
    act(() => {
      screen.getByText("Ships on foreign stations").focus();
    });
    expect(await screen.findByText("tonnage unknown")).toBeTruthy();
    expect(screen.getByText(/partial total would mislead/i)).toBeTruthy();
  });

  it("groups the not-yet-modelled readouts by where they would sit", async () => {
    await renderStrip();
    fireEvent.click(screen.getByRole("button", { name: /Not yet modelled \(\d+\)/ }));
    expect(screen.getByRole("region", { name: "Nation readouts" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Budget readouts" })).toBeTruthy();
  });

  it("orders Nation, Budget, Outlook in reading order under level-2 headings", async () => {
    await renderStrip();
    const region = screen.getByRole("region", { name: "Status strip" });
    const headings = within(region).getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(["Nation", "Budget", "Outlook"]);
  });

  it("opens the deferred popover from the keyboard and closes it with Escape", async () => {
    await renderStrip();
    const trigger = screen.getByRole("button", { name: /Not yet modelled \(\d+\)/ });
    trigger.focus();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
  });
});
