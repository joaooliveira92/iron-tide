import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { DEFAULT_APP_PREFERENCES } from "../../shared/preferences-contract.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import { PreferencesProvider } from "../lib/preferences-context.js";
import { createPreferencesBridgeStub } from "../lib/preferences-test-bridge.js";
import { DensityProvider } from "./DensityContext.js";
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
    expect(screen.getByText(/over-committed/i)).toBeTruthy();
  });
});
