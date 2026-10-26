import type { ExplanationTree } from "@bluewave/events";
import { describe, expect, it } from "vite-plus/test";

import { createPresentationFormat } from "../../lib/presentation-format/index.js";
import { netTone, treasuryReadouts } from "./treasury-readouts.js";
import type { TreasuryBreakdown } from "./treasury-summary.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const breakdown: TreasuryBreakdown = {
  income: 4000,
  obligations: 0,
  fleetMaintenance: 200,
  researchSpend: 300,
  researchRequested: 300,
  researchCap: 480,
  researchUnfundedReason: undefined,
  plannedConstruction: 500,
  totalExpenditure: 500,
  projectedSurplusDeficit: 3500,
  status: "healthy",
  shortfall: 0,
  availableFunds: 50000,
  projectedMonthEndFunds: 53000,
  runwayMonths: undefined,
  netExplanation: undefined,
  monthEndExplanation: undefined,
  runwayExplanation: undefined,
  appropriationExplanation: undefined,
};

const NET_TREE: ExplanationTree = {
  formulaId: "economy_net",
  formulaVersion: "economy_v1",
  inputs: { appropriation: 4000 },
  intermediate: { outflow: 500 },
  result: 3500,
  unit: "nc",
  children: [
    {
      formulaId: "economy_net.appropriation",
      formulaVersion: "economy_v1",
      inputs: { amount: 4000 },
      intermediate: {},
      result: 4000,
      unit: "nc",
    },
    {
      formulaId: "economy_net.research",
      formulaVersion: "economy_v1",
      inputs: { amount: 300 },
      intermediate: {},
      result: -300,
      unit: "nc",
    },
  ],
};

describe("treasuryReadouts", () => {
  it("attaches each explanation to the readout whose number it explains", () => {
    const readouts = treasuryReadouts(
      {
        ...breakdown,
        netExplanation: NET_TREE,
        appropriationExplanation: NET_TREE,
        monthEndExplanation: NET_TREE,
        runwayExplanation: NET_TREE,
        runwayMonths: 3,
      },
      FORMAT,
    );
    expect(readouts.find((r) => r.id === "funds")?.explanation).toBe(NET_TREE);
    expect(readouts.find((r) => r.id === "net")?.explanation).toBe(NET_TREE);
    expect(readouts.find((r) => r.id === "monthEnd")?.explanation).toBe(NET_TREE);
    expect(readouts.find((r) => r.id === "runway")?.explanation).toBe(NET_TREE);
    expect(treasuryReadouts(breakdown, FORMAT).every((r) => r.explanation === undefined)).toBe(
      true,
    );
  });

  it("reads the headline figures and omits the runway when the treasury is not running down", () => {
    const readouts = treasuryReadouts(breakdown, FORMAT);
    expect(readouts.map((r) => [r.id, r.value])).toEqual([
      ["funds", "50,000"],
      ["net", "+3,500"],
      ["monthEnd", "53,000"],
    ]);
  });

  it("marks a deficit and a short runway as bad", () => {
    const readouts = treasuryReadouts(
      { ...breakdown, projectedSurplusDeficit: -250, runwayMonths: 2, status: "critical" },
      FORMAT,
    );
    expect(readouts.find((r) => r.id === "net")?.tone).toBe("bad");
    expect(readouts.find((r) => r.id === "runway")?.tone).toBe("bad");
    expect(readouts.find((r) => r.id === "net")?.value).toBe("-250");
  });

  it("tones a zero net as a warning", () => {
    expect(netTone(0)).toBe("warn");
    expect(netTone(1)).toBe("good");
  });

  it("lists halted-project carrying cost in the month-end breakdown only when there is some", () => {
    const rows = (carrying: number) =>
      treasuryReadouts(breakdown, FORMAT, carrying)
        .find((r) => r.id === "monthEnd")
        ?.rows.map((row) => row.label);
    expect(rows(0)).not.toContain("Halted-project carrying cost");
    expect(rows(12)).toContain("Halted-project carrying cost");
  });
});
