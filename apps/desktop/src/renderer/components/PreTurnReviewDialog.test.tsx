import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { StrategicPriority } from "@bluewave/campaign-engine";

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

const LOADED: PreTurnReviewData = {
  priorities: [PRIORITY],
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
  it("renders the campaign figures and unresolved warnings", () => {
    renderView();

    expect(screen.getByText("Mar 1900")).toBeTruthy();
    expect(screen.getByText("Apr 1900")).toBeTruthy();
    expect(screen.getByText("1,234 NC")).toBeTruthy();
    expect(screen.getByText("Deficit looming")).toBeTruthy();
    expect(screen.getAllByText("warning").length).toBeGreaterThan(0);
  });

  it("labels the advance action with the next month", () => {
    renderView();
    expect(screen.getByRole("button", { name: "Advance to Apr 1900" })).toBeTruthy();
  });

  it("shows a pending placeholder while the projections load", () => {
    renderView({
      data: {
        ...LOADED,
        constructionCount: null,
        expectedCompletions: null,
        researchSpend: null,
        loading: true,
      },
    });
    expect(screen.getAllByText("…").length).toBe(3);
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
