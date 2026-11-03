/* @vitest-environment jsdom */
import type { ExplanationTree } from "@bluewave/events";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { axeViolations } from "../../lib/axe.js";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { ExplanationDisclosure } from "./ExplanationDisclosure.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const TREE: ExplanationTree = {
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

afterEach(cleanup);

describe("ExplanationDisclosure", () => {
  it("shows the result, each line, and its value as a native disclosure", () => {
    render(
      <ExplanationDisclosure
        tree={TREE}
        area="economy"
        summaryKey="economy.economy_net.summary"
        format={FORMAT}
      />,
    );
    expect(screen.getByText("Net before construction 3,500")).not.toBeNull();
    expect(screen.getByText("Appropriation")).not.toBeNull();
    expect(screen.getByText("4,000")).not.toBeNull();
    expect(screen.getByText("Research")).not.toBeNull();
    expect(screen.getByText("-300")).not.toBeNull();
    expect(screen.getByTestId("explanation-economy_net")).not.toBeNull();
  });

  it("names the empty case when the tree has no lines", () => {
    render(
      <ExplanationDisclosure
        tree={{ ...TREE, children: [] }}
        area="economy"
        summaryKey="economy.economy_net.summary"
        format={FORMAT}
      />,
    );
    expect(screen.getByText("No lines apply.")).not.toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <ExplanationDisclosure
        tree={TREE}
        area="economy"
        summaryKey="economy.economy_net.summary"
        format={FORMAT}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
