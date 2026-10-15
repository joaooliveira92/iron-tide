import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { MonthReportCard } from "./MonthReportCard.js";
import { NationRail } from "./NationRail.js";
import { PrioritiesCard } from "./PrioritiesCard.js";

const noop = () => undefined;

describe("embedded cards (body only, for map-overlay panels)", () => {
  afterEach(cleanup);

  it("the month report keeps its test id and description but drops its own title", () => {
    render(<MonthReportCard reports={[]} embedded />);
    expect(screen.getByTestId("month-report-card")).toBeTruthy();
    expect(screen.queryByText("Recent Developments")).toBeNull();
    expect(screen.getByText(/appears here after you advance the month/)).toBeTruthy();
  });

  it("the priorities card drops its title", () => {
    render(
      <PrioritiesCard state={{ status: "ready", priorities: [] }} onNavigate={noop} embedded />,
    );
    expect(screen.getByTestId("priorities-card")).toBeTruthy();
    expect(screen.queryByText("Immediate Priorities")).toBeNull();
    expect(screen.getByText(/no urgent concerns/)).toBeTruthy();
  });

  it("the nation rail drops its title and keeps the All relations link", () => {
    render(
      <NationRail
        state={{ status: "unavailable" }}
        playerName="Britain"
        onNavigate={noop}
        embedded
      />,
    );
    expect(screen.getByTestId("nation-rail")).toBeTruthy();
    expect(screen.queryByText("Nations")).toBeNull();
    expect(screen.getByRole("button", { name: "All relations" })).toBeTruthy();
  });

  it("the default (not embedded) still shows the titles", () => {
    render(<MonthReportCard reports={[]} />);
    expect(screen.getByText("Recent Developments")).toBeTruthy();
  });
});
