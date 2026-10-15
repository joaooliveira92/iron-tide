/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { SecondaryRow } from "../site-header-state.js";
import { SecondaryRowView } from "./HeaderSecondaryRow.js";

describe("SecondaryRowView", () => {
  afterEach(cleanup);

  it("renders the status row", () => {
    render(<SecondaryRowView row={{ kind: "status", leading: "Leading", trailing: "Trailing" }} />);

    expect(screen.getByText("Leading")).toBeTruthy();
    expect(screen.getByText("Trailing")).toBeTruthy();
  });

  it("renders only the backed campaign metrics and the status", () => {
    const row: SecondaryRow = {
      kind: "campaign",
      status: "Armed peace",
      metrics: [
        { icon: "budget", label: "Budget", value: "£1k", placeholder: false },
        { icon: "prestige", label: "Prestige", value: "—", placeholder: true },
      ],
    };

    render(<SecondaryRowView row={row} />);

    expect(screen.getByText(/Budget:/)).toBeTruthy();
    expect(screen.queryByText(/Prestige:/)).toBeNull();
    expect(screen.getByText("Armed peace")).toBeTruthy();
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
