export const VALID_MONTHLY_REPORT = {
  reportId: "save-1",
  campaignId: "camp_1",
  turn: 1,
  period: { from: { year: 1880, month: 1 }, to: { year: 1880, month: 2 } },
  generatedAt: "1880-02-01T00:00:00.000Z",
  treasury: {
    openingTreasury: 1000,
    closingTreasury: 944,
    maintenanceCost: 16,
    constructionSpending: 60,
    researchExpense: 5,
    governmentAllocation: 25,
    netChange: -56,
    ledgerRows: [
      {
        id: "l1",
        description: "revenue",
        phase: "monthly_revenue",
        amount: 25,
        runningBalance: 1025,
      },
    ],
  },
  construction: {
    projects: [{ projectId: "p1", previousWork: 1, newWork: 2 }],
    completedShips: [{ shipId: "s1", name: "HMS Example" }],
    newlyActiveProjectIds: ["p2"],
  },
  research: {
    progress: [{ techId: "t1", previousPoints: 1, newPoints: 2 }],
    discoveries: [{ techId: "t2", researchFieldId: "GUNNERY" }],
  },
  fleet: {
    additions: [{ shipId: "s1", name: "HMS Example" }],
    totalActiveShips: 8,
  },
  priorities: [
    {
      id: "monthly_deficit",
      type: "monthly_deficit",
      severity: "warning",
      title: "Monthly deficit",
      summary: "s",
      reason: "r",
      destination: "overview",
      fingerprint: "monthly_deficit",
    },
  ],
  battleOutcomes: [
    {
      battleId: "b1",
      areaId: "a1",
      attackerId: "uk",
      defenderId: "france",
      winnerId: "uk",
      loserId: "france",
      warScoreDelta: 2,
      attackerLosses: ["s1"],
      defenderLosses: [],
      explanation: [],
    },
  ],
} as const;
