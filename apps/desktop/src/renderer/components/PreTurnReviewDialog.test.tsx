import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { PlayerProjectionEconomy, StrategicPriority } from "@bluewave/campaign-engine";

import { PreTurnReviewDialogView } from "./PreTurnReviewDialog.js";
import type { PreTurnReviewData } from "./usePreTurnReviewData.js";

afterEach(cleanup);

const PRIORITY: StrategicPriority = {
  id: "p1",
  type: "monthly_deficit",
  severity: "warning",
  title: "Deficit looming",
  summary: "Spending exceeds income.",
  reason: "reason",
  destination: "overview",
  fingerprint: "fp",
};

const ECONOMY: PlayerProjectionEconomy = {
  treasury: 1234,
  monthlyAppropriation: 400,
  shipyardCapacity: 10,
  constructionSpend: 300,
  researchSpend: 500,
  maintenanceCost: 200,
  obligations: 50,
  researchRequested: 500,
  researchCap: 800,
  plannedConstruction: 300,
  projectedNet: -56,
  shortfall: 0,
  status: "deficit",
  monthEndTreasury: 1178,
};

const LOADED: PreTurnReviewData = {
  priorities: [PRIORITY],
  economy: ECONOMY,
  pipeline: [
    {
      id: "k1",
      className: "Bellerophon class",
      shipType: "destroyer",
      status: "IN_PROGRESS",
      completedWork: 95,
      totalWork: 100,
      paidWork: 95,
      progress: 0.95,
      nearCompletion: true,
    },
  ],
  constructionCount: 2,
  expectedCompletions: 1,
  researchSpend: 500,
  loading: false,
};

const CAMPAIGN = { month: { year: 1900, month: 3 }, treasury: 1234, projectedSurplusDeficit: -56 };

function renderView(overrides: Partial<Parameters<typeof PreTurnReviewDialogView>[0]> = {}) {
  return render(
    <PreTurnReviewDialogView
      open
      onOpenChange={() => {}}
      campaign={CAMPAIGN}
      data={LOADED}
      saving={false}
      saveMessage={null}
      committing={false}
      onAdvance={async () => {}}
      {...overrides}
    />,
  );
}

describe("PreTurnReviewDialogView", () => {
  it("shows both months of the transit and the closing treasury", () => {
    renderView();

    expect(screen.getByText("Mar 1900")).toBeTruthy();
    expect(screen.getAllByText("Apr 1900").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1,178 NC").length).toBeGreaterThan(0);
  });

  it("lists every ledger line as its own control", () => {
    renderView();

    expect(screen.getByRole("button", { name: /^Opening treasury: 1,234 NC/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Fleet upkeep: −200 NC/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Month-end treasury: 1,178 NC/ })).toBeTruthy();
  });

  it("puts the unresolved warning on the watch-list and gives a cautious verdict", () => {
    renderView();

    expect(screen.getByText("Deficit looming")).toBeTruthy();
    expect(document.querySelector("[data-verdict='caution']")).not.toBeNull();
  });

  it("says so when the Admiralty has nothing to flag", () => {
    renderView({
      data: { ...LOADED, priorities: [], economy: { ...ECONOMY, status: "healthy" } },
    });

    expect(screen.getByText("The Admiralty has identified no urgent concerns.")).toBeTruthy();
    expect(document.querySelector("[data-verdict='clear']")).not.toBeNull();
  });

  it("advises a hold on a critical priority", () => {
    renderView({
      data: { ...LOADED, priorities: [{ ...PRIORITY, severity: "critical" }] },
    });

    expect(document.querySelector("[data-verdict='hold']")).not.toBeNull();
  });

  it("asks for a second confirmation before advancing through a hold", () => {
    const onAdvance = vi.fn(async () => {});
    renderView({
      onAdvance,
      data: { ...LOADED, priorities: [{ ...PRIORITY, severity: "critical" }] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Advance to Apr 1900" }));
    expect(onAdvance).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Advance regardless?");

    fireEvent.click(screen.getByRole("button", { name: "Advance to Apr 1900 anyway" }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("lets the player step back from the confirmation", () => {
    renderView({ data: { ...LOADED, priorities: [{ ...PRIORITY, severity: "critical" }] } });

    fireEvent.click(screen.getByRole("button", { name: "Advance to Apr 1900" }));
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Advance to Apr 1900" })).toBeTruthy();
  });

  it("does not ask for confirmation when only cautioned", () => {
    const onAdvance = vi.fn(async () => {});
    renderView({ onAdvance });

    screen.getByRole("button", { name: "Advance to Apr 1900" }).click();

    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("opens the place a warning points at", () => {
    const onOpenPriority = vi.fn();
    renderView({
      onOpenPriority,
      data: { ...LOADED, priorities: [{ ...PRIORITY, destination: "construction" }] },
    });

    screen.getByRole("button", { name: "Warning: Deficit looming" }).click();

    expect(onOpenPriority).toHaveBeenCalledTimes(1);
  });

  it("labels the advance action with the next month", () => {
    renderView();
    expect(screen.getByRole("button", { name: "Advance to Apr 1900" })).toBeTruthy();
  });

  it("shows placeholders while the projections load", () => {
    renderView({
      data: {
        ...LOADED,
        economy: null,
        pipeline: [],
        constructionCount: null,
        expectedCompletions: null,
        researchSpend: null,
        loading: true,
      },
    });
    expect(screen.getByText(/^… building/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Research spending: …" })).toBeTruthy();
    expect(screen.getByText("Reading the slipways…")).toBeTruthy();
  });

  it("invokes onAdvance from the footer", async () => {
    const onAdvance = vi.fn(async () => {});
    renderView({ onAdvance });
    screen.getByRole("button", { name: "Advance to Apr 1900" }).click();
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("disables advancing while committing", () => {
    renderView({ committing: true });
    const button = screen.getByRole("button", { name: "Advancing…" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
