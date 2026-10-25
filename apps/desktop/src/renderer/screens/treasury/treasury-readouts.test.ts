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
};

describe("treasuryReadouts", () => {
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
