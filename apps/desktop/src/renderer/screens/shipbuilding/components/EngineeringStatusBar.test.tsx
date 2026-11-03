/* @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createPresentationFormat } from "../../../lib/presentation-format/profile.js";
import { EngineeringStatusBar } from "./EngineeringStatusBar.js";

const format = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

afterEach(cleanup);

describe("EngineeringStatusBar", () => {
  it("shows trailing content inside the status region", () => {
    render(<EngineeringStatusBar readouts={[]} format={format} trail={<span>budget</span>} />);
    const bar = screen.getByRole("region", { name: "Engineering status" });
    expect(within(bar).getByText("budget")).toBeTruthy();
  });

  it("adds nothing when there is no trailing content", () => {
    render(<EngineeringStatusBar readouts={[]} format={format} />);
    const bar = screen.getByRole("region", { name: "Engineering status" });
    expect(bar.children).toHaveLength(0);
  });
});
