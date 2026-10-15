import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { DENSITY_STORAGE_KEY, DensityProvider } from "./DensityContext.js";
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
    },
    fleet: [],
    strategicAreas: [],
  } as unknown as PlayerProjection;
  return buildStatusStrip({ projection, areas: [], alertsCount: 2 });
}

function renderStrip(balance = 1200) {
  return render(
    <DensityProvider>
      <StatusStripView model={model(balance)} />
    </DensityProvider>,
  );
}

describe("StatusStripView", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("is a labelled region with Nation and Budget groups, expanded by default", () => {
    renderStrip();
    const region = screen.getByRole("region", { name: "Status strip" });
    expect(within(region).getByRole("group", { name: "Nation" })).toBeTruthy();
    expect(within(region).getByRole("group", { name: "Budget" })).toBeTruthy();
    expect(within(region).getByText("Monthly budget (projected)")).toBeTruthy();
    expect(screen.getByRole("button", { name: /collapse/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("keeps deferred rows out of the expanded band", () => {
    renderStrip();
    const region = screen.getByRole("region", { name: "Status strip" });
    expect(within(region).queryByText("Prestige")).toBeNull();
    expect(within(region).getByText("Shipyard capacity (port levels)")).toBeTruthy();
    expect(within(region).getByText("Total expenses")).toBeTruthy();
  });

  it("keeps deferred rows in one popover with their reasons, out of the expanded band", () => {
    renderStrip();
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

  it("states a deficit in words, not colour alone", () => {
    renderStrip(-450);
    const balance = screen
      .getByText("Monthly balance (projected)")
      .closest("[data-row]") as HTMLElement;
    expect(within(balance).getByText("-£450")).toBeTruthy();
    expect(within(balance).getByText("Deficit")).toBeTruthy();
    expect(balance.getAttribute("data-tone")).toBe("alert");
  });

  it("collapses to a one-liner with balance, treasury and alerts, and expands again", () => {
    renderStrip();
    fireEvent.click(screen.getByRole("button", { name: /collapse/i }));
    const region = screen.getByRole("region", { name: "Status strip" });
    expect(within(region).queryByRole("group", { name: "Nation" })).toBeNull();
    expect(region.textContent).toContain("£1,200");
    expect(region.textContent).toContain("Surplus");
    expect(region.textContent).toContain("£50,000");
    expect(region.textContent).toContain("2 alerts");
    fireEvent.click(screen.getByRole("button", { name: /expand/i }));
    expect(within(region).getByRole("group", { name: "Nation" })).toBeTruthy();
  });

  it("starts as a one-liner in compact density", () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, "compact");
    renderStrip();
    expect(screen.queryByRole("group", { name: "Nation" })).toBeNull();
    expect(screen.getByRole("button", { name: /expand/i })).toBeTruthy();
  });
});
