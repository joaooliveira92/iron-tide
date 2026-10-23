/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { StrategicPriority } from "@bluewave/campaign-engine";
import type { SecondaryRow } from "../site-header-state.js";
import { SecondaryRowView } from "./HeaderSecondaryRow.js";

const priority = (id: string, title: string): StrategicPriority => ({
  id,
  type: "low_research_spending",
  severity: "warning",
  title,
  summary: "Research is below target.",
  reason: "r",
  destination: "research",
  fingerprint: id,
});

describe("SecondaryRowView", () => {
  afterEach(cleanup);

  it("renders the status row", () => {
    render(<SecondaryRowView row={{ kind: "status", leading: "Leading", trailing: "Trailing" }} />);

    expect(screen.getByText("Leading")).toBeTruthy();
    expect(screen.getByText("Trailing")).toBeTruthy();
  });

  it("renders the alert metric and the status", () => {
    const row: SecondaryRow = {
      kind: "campaign",
      status: "Armed peace",
      metrics: [{ icon: "prestige", label: "Prestige", value: "15 — at risk", placeholder: false }],
    };

    render(<SecondaryRowView row={row} />);

    expect(screen.getByText(/Prestige:/)).toBeTruthy();
    expect(screen.getByText("Armed peace")).toBeTruthy();
  });

  it("hides a placeholder metric", () => {
    const row: SecondaryRow = {
      kind: "campaign",
      status: "Armed peace",
      metrics: [{ icon: "prestige", label: "Prestige", value: "—", placeholder: true }],
    };

    render(<SecondaryRowView row={row} />);

    expect(screen.queryByText(/Prestige:/)).toBeNull();
  });

  it("shows priority chips and routes a click to the destination", () => {
    const onNavigate = vi.fn();
    const row: SecondaryRow = { kind: "campaign", status: "Armed peace", metrics: [] };

    render(
      <SecondaryRowView
        row={row}
        briefing={{
          state: { status: "ready", priorities: [priority("a", "Low research spending")] },
          onNavigate,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Low research spending.*Go to Research/ }));
    expect(onNavigate).toHaveBeenCalledWith("research");
    expect(screen.queryByText(/more/)).toBeNull();
  });

  it("collapses extra priorities behind a +N more control", () => {
    const row: SecondaryRow = { kind: "campaign", status: "Armed peace", metrics: [] };

    render(
      <SecondaryRowView
        row={row}
        briefing={{
          state: {
            status: "ready",
            priorities: [priority("a", "One"), priority("b", "Two"), priority("c", "Three")],
          },
          onNavigate: vi.fn(),
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /One/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Two/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Three/ })).toBeNull();
    expect(screen.getByRole("button", { name: /\+1 more/ })).toBeTruthy();
  });

  it("says so when there are no urgent concerns, and stays quiet while loading", () => {
    const row: SecondaryRow = { kind: "campaign", status: "Armed peace", metrics: [] };
    const { rerender } = render(
      <SecondaryRowView
        row={row}
        briefing={{ state: { status: "ready", priorities: [] }, onNavigate: vi.fn() }}
      />,
    );
    expect(screen.getByText("No urgent concerns")).toBeTruthy();

    rerender(
      <SecondaryRowView
        row={row}
        briefing={{ state: { status: "loading" }, onNavigate: vi.fn() }}
      />,
    );
    expect(screen.queryByTestId("priority-briefing")).toBeNull();
  });

  it("routes editor actions through onActionClick", () => {
    const onActionClick = vi.fn();
    const row: SecondaryRow = {
      kind: "editor",
      scenario: "Active scenario",
      actions: [{ code: "validate", label: "Validate parameters", icon: "validate" }],
    };

    render(<SecondaryRowView row={row} onActionClick={onActionClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Validate parameters" }));

    expect(onActionClick).toHaveBeenCalledWith("validate");
  });

  it("renders the wizard row", () => {
    render(<SecondaryRowView row={{ kind: "wizard", heading: "Setup", hint: "Pick one" }} />);

    expect(screen.getByText("Setup")).toBeTruthy();
    expect(screen.getByText("Pick one")).toBeTruthy();
  });

  it("renders the preferences row", () => {
    render(
      <SecondaryRowView row={{ kind: "preferences", label: "Preferences:", detail: "Storage" }} />,
    );

    expect(screen.getByText("Preferences:")).toBeTruthy();
    expect(screen.getByText("Storage")).toBeTruthy();
  });
});
