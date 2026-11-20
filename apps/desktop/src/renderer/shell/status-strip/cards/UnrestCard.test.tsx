import { cleanup, render, screen } from "@testing-library/react";
import type { ExplanationTree } from "@bluewave/events";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { PreferencesProvider } from "../../../lib/preferences-context.js";
import { UnrestCard } from "./UnrestCard.js";

describe("UnrestCard explanation", () => {
  afterEach(cleanup);

  const explanation: ExplanationTree = {
    formulaId: "unrest_change",
    formulaVersion: "unrest_v1",
    inputs: { month: "1880-02" },
    intermediate: { unclampedAfter: 5, clampDelta: 0 },
    result: 5,
    unit: "unrest",
    operation: "add",
    children: [
      {
        formulaId: "unrest_change.before",
        formulaVersion: "unrest_v1",
        inputs: {},
        intermediate: {},
        result: 4,
        unit: "unrest",
      },
      {
        formulaId: "unrest_change.military_spending",
        formulaVersion: "unrest_v1",
        inputs: { reasonCode: "MILITARY_SPENDING" },
        intermediate: {},
        result: 1,
        unit: "unrest",
        operation: "add",
      },
    ],
  };

  it("shows the last change as a disclosure with its working", () => {
    render(
      <PreferencesProvider>
        <UnrestCard
          gauge={{ current: 5, max: 10, fraction: 0.5 }}
          note="Last change: +1 (military spending, 1880-02)."
          explanation={explanation}
        />
      </PreferencesProvider>,
    );
    expect(screen.getByTestId("unrest-change-explanation")).toBeTruthy();
    expect(screen.getByText("Unrest change: 5")).toBeTruthy();
    expect(screen.getByText("Unrest before")).toBeTruthy();
    expect(screen.getByText("Military spending")).toBeTruthy();
  });

  it("omits the disclosure before the first change", () => {
    render(
      <PreferencesProvider>
        <UnrestCard gauge={{ current: 0, max: 10, fraction: 0 }} note="" />
      </PreferencesProvider>,
    );
    expect(screen.queryByTestId("unrest-change-explanation")).toBeNull();
  });
});
