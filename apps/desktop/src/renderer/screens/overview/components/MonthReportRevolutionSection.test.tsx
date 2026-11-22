import type { MonthlyReportRevolution } from "../../../../shared/reports-contract.js";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { hasAuthoredMessage } from "../../../lib/strings.js";
import { MonthReportRevolutionSection } from "./MonthReportRevolutionSection.js";

const rows = () => screen.queryAllByTestId("month-report-revolution").map((row) => row.textContent);

const revolution = (over: Partial<MonthlyReportRevolution> = {}): MonthlyReportRevolution => ({
  nationId: "france",
  governmentBefore: "autocratic",
  governmentAfter: "communist",
  ...over,
});

describe("MonthReportRevolutionSection", () => {
  afterEach(cleanup);

  it("names the nation, the old government and the new government", () => {
    render(<MonthReportRevolutionSection revolutions={[revolution()]} />);
    expect(rows()).toHaveLength(1);
    const text = rows()[0] ?? "";
    expect(text).toMatch(/france/i);
    expect(text).toContain("autocracy");
    expect(text).toContain("communist state");
  });

  it("lists every revolution of the month", () => {
    render(
      <MonthReportRevolutionSection
        revolutions={[
          revolution(),
          revolution({
            nationId: "russia",
            governmentBefore: "fascist",
            governmentAfter: "limited_democracy",
          }),
        ]}
      />,
    );
    expect(rows()).toHaveLength(2);
  });

  it("falls back to the stored government name when it has no label", () => {
    render(
      <MonthReportRevolutionSection revolutions={[revolution({ governmentAfter: "junta" })]} />,
    );
    expect(rows()[0]).toContain("junta");
  });

  it("authors a label for every government type", () => {
    for (const type of [
      "liberal_democracy",
      "limited_democracy",
      "autocratic",
      "fascist",
      "communist",
      "eastern",
    ]) {
      expect(hasAuthoredMessage(`reports.revolution.government.${type}`)).toBe(true);
    }
  });
});
