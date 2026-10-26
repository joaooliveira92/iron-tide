import { describe, expect, it } from "vite-plus/test";

import type { PlayerProjectionEconomy, StrategicPriority } from "@bluewave/campaign-engine";

import {
  buildLedger,
  pipelineOf,
  reviewVerdict,
  sortByUrgency,
  barSpan,
} from "./preTurnReviewModel.js";

const ECONOMY: PlayerProjectionEconomy = {
  treasury: 1000,
  monthlyAppropriation: 400,
  shipyardCapacity: 10,
  constructionSpend: 300,
  researchSpend: 100,
  maintenanceCost: 200,
  obligations: 50,
  researchRequested: 100,
  researchCap: 200,
  plannedConstruction: 300,
  projectedNet: -250,
  shortfall: 0,
  status: "narrow",
  monthEndTreasury: 750,
};

function priority(id: string, severity: StrategicPriority["severity"]): StrategicPriority {
  return {
    id,
    type: "monthly_deficit",
    severity,
    title: id,
    summary: "s",
    reason: "r",
    destination: "overview",
    fingerprint: id,
  };
}

describe("buildLedger", () => {
  it("walks the treasury through every line in settlement order", () => {
    const ledger = buildLedger(ECONOMY);

    expect(ledger.lines.map((line) => line.id)).toEqual([
      "opening",
      "appropriation",
      "construction",
      "maintenance",
      "obligations",
      "research",
      "closing",
    ]);
    expect(ledger.lines.map((line) => line.to)).toEqual([1000, 1400, 1100, 900, 850, 750, 750]);
    expect(ledger.totalOutgoings).toBe(650);
  });

  it("never lets the running balance fall below zero", () => {
    const ledger = buildLedger({ ...ECONOMY, treasury: 0, monthlyAppropriation: 100 });

    expect(ledger.lines.every((line) => line.to >= 0)).toBe(true);
  });
});

describe("barSpan", () => {
  it("stacks the outgoings left to right against the month's money", () => {
    const ledger = buildLedger(ECONOMY);
    const spans = ledger.lines.filter((line) => line.kind === "outgo").map(barSpan);

    expect(spans.map((span) => span.left)).toEqual(
      [0, 300 / 650, 500 / 650, 550 / 650].map((v) => v * 100),
    );
    expect(spans.at(-1)?.left).toBeLessThan(100);
  });

  it("measures the appropriation against whichever is larger, income or outgoings", () => {
    const ledger = buildLedger(ECONOMY);
    const income = ledger.lines.find((line) => line.id === "appropriation");

    expect(income === undefined ? 0 : barSpan(income).width).toBeCloseTo((400 / 650) * 100);
  });

  it("keeps an empty line visible as a sliver", () => {
    const ledger = buildLedger({ ...ECONOMY, researchSpend: 0 });
    const research = ledger.lines.find((line) => line.id === "research");

    expect(research === undefined ? 0 : barSpan(research).width).toBeGreaterThan(0);
  });
});

describe("reviewVerdict", () => {
  it("is clear when nothing is wrong", () => {
    expect(reviewVerdict([priority("a", "advisory")], ECONOMY).kind).toBe("clear");
  });

  it("asks for care on a warning or a deficit", () => {
    expect(reviewVerdict([priority("a", "warning")], ECONOMY).kind).toBe("caution");
    expect(reviewVerdict([], { ...ECONOMY, status: "deficit" }).kind).toBe("caution");
  });

  it("advises a hold on a critical priority or an unpayable month", () => {
    expect(reviewVerdict([priority("a", "critical")], ECONOMY).kind).toBe("hold");
    expect(reviewVerdict([], { ...ECONOMY, shortfall: 10 }).kind).toBe("hold");
  });

  it("falls back to the priorities alone before the economy has loaded", () => {
    expect(reviewVerdict([], null).kind).toBe("clear");
  });
});

describe("sortByUrgency", () => {
  it("puts the most severe first and keeps ties in their original order", () => {
    const sorted = sortByUrgency([
      priority("info", "information"),
      priority("warn-1", "warning"),
      priority("crit", "critical"),
      priority("warn-2", "warning"),
    ]);

    expect(sorted.map((p) => p.id)).toEqual(["crit", "warn-1", "warn-2", "info"]);
  });
});

describe("pipelineOf", () => {
  const project = (id: string, completedWork: number, status = "IN_PROGRESS") => ({
    projectId: id,
    className: id,
    shipType: "destroyer",
    status,
    completedWork,
    totalWork: 100,
    paidWork: completedWork,
  });

  it("drops completed projects, orders by progress and flags near completion", () => {
    const pipeline = pipelineOf([
      project("slow", 10),
      project("done", 100, "COMPLETED"),
      project("nearly", 95),
    ]);

    expect(pipeline.map((p) => p.id)).toEqual(["nearly", "slow"]);
    expect(pipeline.map((p) => p.nearCompletion)).toEqual([true, false]);
  });
});
