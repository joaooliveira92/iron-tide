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

  it("shows the presence shortfalls and the prestige cost only when the month had them", () => {
    const { rerender } = render(
      <MonthlyReportView report={report(1)} previous={undefined} areaName={areaName} />,
    );
    expect(screen.queryByTestId("month-report-presence-prestige")).toBeNull();
    expect(screen.queryByText("Foreign-station presence")).toBeNull();

    rerender(
      <MonthlyReportView
        report={report(1, {
          presence: {
            shortfalls: [
              { areaId: "malta", requiredTons: 1200, presentTons: 300, shortfallTons: 900 },
            ],
            prestigeDelta: -2,
          },
        })}
        previous={undefined}
        areaName={areaName}
      />,
    );
    expect(screen.getByText("Foreign-station presence")).toBeTruthy();
    expect(screen.getByTestId("month-report-presence-prestige").textContent).toContain("-2");
    expect(
      screen.getByText(/Malta: 300 t on station against 1200 t required, short 900 t/),
    ).toBeTruthy();
  });

  it("lists the exercise ordering, its result and the tension changes only when the month had them", () => {
    const { rerender } = render(
      <MonthlyReportView report={report(1)} previous={undefined} areaName={areaName} />,
    );
    expect(screen.queryByText("Fleet exercise")).toBeNull();

    rerender(
      <MonthlyReportView
        report={report(1, {
          fleetExercise: {
            scheduled: { month: "1880-02", shipIds: ["s1", "s2"] },
            tension: [],
          },
        })}
        previous={undefined}
        areaName={areaName}
      />,
    );
    expect(screen.getByText("Exercise set for 1880-02 with 2 ships.")).toBeTruthy();

    rerender(
      <MonthlyReportView
        report={report(2, {
          fleetExercise: {
            completed: { month: "1880-02", shipIds: ["s1", "s2"], experienceGained: 5 },
            tension: [{ otherNationId: "france", before: 2, after: 3 }],
          },
        })}
        previous={undefined}
        areaName={areaName}
      />,
    );
    expect(
      screen.getByText("Exercise held in 1880-02 with 2 ships; divisions gained 5 experience."),
    ).toBeTruthy();
    expect(screen.getByText(/tension 2 to 3/)).toBeTruthy();
  });

  it("renders the trade block with quota, shortfall, merchant pool and losses only when the month had one", () => {
    const { rerender } = render(
      <MonthlyReportView report={report(1)} previous={undefined} areaName={areaName} />,
    );
    expect(screen.queryByText("Trade protection")).toBeNull();

    rerender(
      <MonthlyReportView
        report={report(1, {
          tradeProtection: { quota: 4, assigned: 4, shortfall: 0, shortfallBp: 0 },
        })}
        previous={undefined}
        areaName={areaName}
      />,
    );
    expect(screen.getByText("Trade protection")).toBeTruthy();
    expect(screen.getByText("Quota 4 ships, 4 counted. The quota was met.")).toBeTruthy();
    expect(screen.queryByTestId("month-report-trade-loss")).toBeNull();

    rerender(
      <MonthlyReportView
        report={report(1, {
          tradeProtection: {
            quota: 4,
            assigned: 1,
            shortfall: 3,
            shortfallBp: 7500,
            loss: {
              raiderHits: 2,
              submarineHits: 1,
              pressureHit: true,
              lossBp: 900,
              poolBefore: 10000,
              poolAfter: 9100,
            },
          },
        })}
        previous={undefined}
        areaName={areaName}
      />,
    );
    expect(
      screen.getByText("Quota 4 ships, 1 counted. Short by 3 ships (75% of the quota)."),
    ).toBeTruthy();
    expect(screen.getByTestId("month-report-trade-loss").textContent).toBe(
      "Merchant pool fell from 100% to 91% (-9%): 2 raider hits, 1 submarine hit, blockade pressure.",
    );
  });

  it("lists every raider engagement, internment and release", () => {
    render(
      <MonthlyReportView
        report={report(1, {
          tradeProtection: {
            quota: 0,
            assigned: 0,
            shortfall: 0,
            shortfallBp: 0,
            raiders: [
              {
                shipId: "ship_a",
                shipName: "HMS Alert",
                event: "ENGAGED",
                encounter: "INTERCEPTION",
                victimNationId: "france",
                outcome: "SUNK",
              },
              {
                shipId: "ship_b",
                shipName: "HMS Bold",
                event: "ENGAGED",
                encounter: "BREAKOUT",
                victimNationId: "france",
                outcome: "SURVIVED",
              },
              {
                shipId: "ship_c",
                shipName: "HMS Cutlass",
                event: "INTERNED",
                cause: "FUEL_EXHAUSTION",
              },
              { shipId: "ship_d", shipName: "HMS Dauntless", event: "RELEASED" },
            ],
          },
        })}
        previous={undefined}
        areaName={areaName}
      />,
    );
    const rows = screen.getAllByTestId("month-report-raider").map((row) => row.textContent);
    expect(rows).toEqual([
      "HMS Alert intercepted a convoy of France and was sunk.",
      "HMS Bold broke out against the trade of France and survived.",
      "HMS Cutlass was interned after running out of fuel.",
      "HMS Dauntless was released from internment.",
    ]);
  });

  it("shows a revolution row only when a foreign government changed", () => {
    const { rerender } = render(
      <MonthlyReportView report={report(1)} previous={undefined} areaName={areaName} />,
    );
    expect(screen.queryByTestId("month-report-revolution")).toBeNull();

    rerender(
      <MonthlyReportView
        report={report(1, {
          foreignRevolutions: [
            { nationId: "france", governmentBefore: "autocratic", governmentAfter: "communist" },
          ],
        })}
        previous={undefined}
        areaName={areaName}
      />,
    );
    expect(screen.getAllByTestId("month-report-revolution")).toHaveLength(1);
  });

  it("offers the previous month as a disclosure when one exists", () => {
    render(<MonthlyReportView report={report(2)} previous={report(1)} areaName={areaName} />);

    expect(screen.getByText("Previous month (January 1880)")).toBeTruthy();
  });
});
