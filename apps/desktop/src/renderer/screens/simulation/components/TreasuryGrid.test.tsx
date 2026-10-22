/* @vitest-environment jsdom */
import type { MonthReport } from "@bluewave/campaign-engine";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { TreasuryGrid } from "./TreasuryGrid.js";

const report: MonthReport = {
  month: { month: 2, year: 1880 },
  openingTreasury: 1000,
  maintenanceCost: 120,
  newConstructionSpending: 60,
  closingTreasury: 820,
};

afterEach(() => {
  cleanup();
});

describe("TreasuryGrid", () => {
  it("renders opening, costs and closing treasury from the report", () => {
    render(<TreasuryGrid report={report} />);

    expect(screen.getByText("Opening Treasury")).not.toBeNull();
    expect(screen.getByText("1000")).not.toBeNull();
    expect(screen.getByText("Maintenance Cost")).not.toBeNull();
    expect(screen.getByText("-120")).not.toBeNull();
    expect(screen.getByText("Construction Spending")).not.toBeNull();
    expect(screen.getByText("-60")).not.toBeNull();
    expect(screen.getByText("Closing Treasury")).not.toBeNull();
    expect(screen.getByText("820")).not.toBeNull();
  });
});
