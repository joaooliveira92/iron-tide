import type { MonthlyReportEntry } from "../../../../shared/reports-contract.js";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { MonthlyReportView } from "./MonthlyReportView.js";

const report = (month: number, over: Partial<MonthlyReportEntry> = {}): MonthlyReportEntry => ({
  reportId: `save-${month}`,
  campaignId: "camp_1",
  turn: month,
  period: { from: { year: 1880, month }, to: { year: 1880, month: month + 1 } },
  generatedAt: "1880-02-01T00:00:00.000Z",
  treasury: {
    openingTreasury: 1000,
    closingTreasury: 944,
    maintenanceCost: 16,
    constructionSpending: 60,
    researchExpense: 5,
    governmentAllocation: 25,
    netChange: -56,
    ledgerRows: [],
  },
  construction: {
    projects: [{ projectId: "proj_ironclad", previousWork: 10, newWork: 30 }],
    completedShips: [{ shipId: "s1", name: "HMS Lion" }],
    newlyActiveProjectIds: [],
  },
  research: {
    progress: [{ techId: "tech_steel", previousPoints: 4, newPoints: 9 }],
    discoveries: [{ techId: "tech_rifling", researchFieldId: "ordnance" }],
  },
  fleet: { additions: [{ shipId: "s1", name: "HMS Lion" }], totalActiveShips: 8 },
  priorities: [
    {
      id: "p1",
      type: "monthly_deficit",
      severity: "warning",
      title: "Cover the deficit",
      summary: "s",
      reason: "r",
      destination: "overview",
      fingerprint: "p1",
    },
  ],
  battleOutcomes: [
    {
      battleId: "b1",
      areaId: "malta",
      attackerId: "uk",
      defenderId: "france",
      winnerId: "uk",
      loserId: "france",
      warScoreDelta: 2,
      attackerLosses: ["s1"],
      defenderLosses: ["f1", "f2"],
      explanation: [],
    },
  ],
  ...over,
});

const areaName = (id: string) => (id === "malta" ? "Malta" : id);

describe("MonthlyReportView", () => {
  afterEach(cleanup);

  it("composes a treasury section and one narrative covering every domain", () => {
    const { container } = render(
      <MonthlyReportView report={report(1)} previous={undefined} areaName={areaName} />,
    );

    const root = screen.getByTestId("monthly-report");
    expect(root.children.length).toBe(2);
    expect(container.querySelector("[aria-label='Treasury']")).not.toBeNull();

    const narrative = root.textContent ?? "";
    expect(narrative).toContain("construction on proj_ironclad");
    expect(narrative).toContain("completed HMS Lion");
    expect(narrative).toContain("research advance: tech_steel");
    expect(narrative).toContain("discovered tech_rifling");
    expect(narrative).toContain("commissioned HMS Lion");
    expect(narrative).toContain("the fleet now has 8 active ships");
    expect(narrative).toContain("Cover the deficit");
    expect(narrative).toContain("defeated");
    expect(narrative).toContain("Malta");
  });

  it("renders none of the structured per-domain sections", () => {
    const { container } = render(
      <MonthlyReportView report={report(1)} previous={undefined} areaName={areaName} />,
    );

    for (const label of ["Battle Outcomes", "Construction", "Fleet", "Priorities", "Research"]) {
      expect(container.querySelector(`section[aria-label='${label}']`)).toBeNull();
    }
  });

  it("offers the previous month as a disclosure when one exists", () => {
    render(<MonthlyReportView report={report(2)} previous={report(1)} areaName={areaName} />);

    expect(screen.getByText("Previous month (January 1880)")).toBeTruthy();
  });
});
