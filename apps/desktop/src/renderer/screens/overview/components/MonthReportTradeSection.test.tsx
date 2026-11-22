import type {
  MonthlyReportRaiderEntry,
  MonthlyReportTradeProtection,
} from "../../../../shared/reports-contract.js";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { hasAuthoredMessage } from "../../../lib/strings.js";
import { MonthReportTradeSection } from "./MonthReportTradeSection.js";

const trade = (over: Partial<MonthlyReportTradeProtection>): MonthlyReportTradeProtection => ({
  quota: 0,
  assigned: 0,
  shortfall: 0,
  shortfallBp: 0,
  ...over,
});

const raiderRows = () =>
  screen.queryAllByTestId("month-report-raider").map((row) => row.textContent);

const lossOf = (raiderHits: number, over: { readonly pressureHit?: boolean } = {}) => ({
  raiderHits,
  pressureHit: over.pressureHit ?? false,
  lossBp: 100,
  poolBefore: 10000,
  poolAfter: 9900,
});

describe("MonthReportTradeSection", () => {
  afterEach(cleanup);

  it("states that no quota was in force when the month had no quota and no raiders", () => {
    render(<MonthReportTradeSection trade={trade({})} />);
    expect(screen.getByText("No trade protection quota was in force.")).toBeTruthy();
    expect(screen.queryByTestId("month-report-raider")).toBeNull();
    expect(screen.queryByTestId("month-report-trade-loss")).toBeNull();
  });

  it("uses the singular for one raider hit", () => {
    render(<MonthReportTradeSection trade={trade({ quota: 2, assigned: 2, loss: lossOf(1) })} />);
    expect(screen.getByTestId("month-report-trade-loss").textContent).toBe(
      "Merchant pool fell from 100% to 99% (-1%): 1 raider hit.",
    );
  });

  it("states an unattributed loss when no cause was recorded", () => {
    render(<MonthReportTradeSection trade={trade({ quota: 2, assigned: 2, loss: lossOf(0) })} />);
    expect(screen.getByTestId("month-report-trade-loss").textContent).toBe(
      "Merchant pool fell from 100% to 99% (-1%): no single cause recorded.",
    );
  });

  it("falls back to the ship id for a report stored before ships were named", () => {
    render(
      <MonthReportTradeSection
        trade={trade({ raiders: [{ shipId: "ship_old", event: "RELEASED" }] })}
      />,
    );
    expect(raiderRows()).toEqual(["ship_old was released from internment."]);
  });

  it.each<[Omit<MonthlyReportRaiderEntry, "shipId" | "shipName">, string]>([
    [{ event: "INTERNED" }, "HMS Alert was interned."],
    [{ event: "INTERNED", cause: "BREAKDOWN" }, "HMS Alert was interned after a breakdown."],
    [{ event: "INTERNED", cause: "DAMAGE" }, "HMS Alert was interned after taking damage."],
    [{ event: "ENGAGED" }, "HMS Alert was engaged."],
    [{ event: "ENGAGED", outcome: "SURVIVED" }, "HMS Alert was engaged and survived."],
    [{ event: "ENGAGED", outcome: "SUNK" }, "HMS Alert was engaged and was sunk."],
    [{ event: "ENGAGED", outcome: "SCUTTLED" }, "HMS Alert was engaged and was scuttled."],
    [{ event: "ENGAGED", outcome: "INTERNED" }, "HMS Alert was engaged and was interned."],
    [
      { event: "ENGAGED", encounter: "INTERCEPTION", victimNationId: "france" },
      "HMS Alert intercepted a convoy of France.",
    ],
    [
      { event: "ENGAGED", encounter: "BREAKOUT", victimNationId: "france", outcome: "SCUTTLED" },
      "HMS Alert broke out against the trade of France and was scuttled.",
    ],
    [
      {
        event: "ENGAGED",
        encounter: "INTERCEPTION",
        victimNationId: "france",
        outcome: "INTERNED",
      },
      "HMS Alert intercepted a convoy of France and was interned.",
    ],
  ])("words a raider row as one sentence (%j)", (entry, sentence) => {
    render(
      <MonthReportTradeSection
        trade={trade({ raiders: [{ shipId: "ship_a", shipName: "HMS Alert", ...entry }] })}
      />,
    );
    expect(raiderRows()).toEqual([sentence]);
  });

  it("has an authored sentence for every encounter, outcome and cause", () => {
    const encounters = ["INTERCEPTION", "BREAKOUT", "NONE"];
    const outcomes = ["SURVIVED", "SUNK", "SCUTTLED", "INTERNED", "NONE"];
    const causes = ["FUEL_EXHAUSTION", "BREAKDOWN", "DAMAGE", "NONE"];
    const missing = [
      ...encounters.flatMap((encounter) =>
        outcomes.map((outcome) => `reports.trade.raider.engaged.${encounter}.${outcome}`),
      ),
      ...causes.map((cause) => `reports.trade.raider.interned.${cause}`),
    ].filter((key) => !hasAuthoredMessage(key));
    expect(missing).toEqual([]);
  });
});
