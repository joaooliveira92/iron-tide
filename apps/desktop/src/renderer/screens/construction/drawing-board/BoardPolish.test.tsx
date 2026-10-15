import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DrawingBoard } from "./DrawingBoard.js";
import { plural } from "../../../components/design-workspace/plural.js";
import { openTab } from "./test-helpers.js";

vi.mock("../../../shell/CampaignShellContext.js", () => ({
  useCampaignRevision: () => null,
  useCampaignMonthId: () => "1880-01",
}));

afterEach(cleanup);

const editPower = (value: string) => {
  const input = screen.getByLabelText(/installed power/i) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

describe("Drawing Board polish", () => {
  it("undoes and redoes with the keyboard, but leaves a text field's own undo alone", () => {
    render(<DrawingBoard />);
    const board = screen.getByTestId("drawing-board");
    editPower("2600");
    expect(screen.getByText("1 edit")).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText(/installed power/i), { key: "z", metaKey: true });
    expect(screen.getByText("1 edit")).toBeTruthy();
    fireEvent.keyDown(board, { key: "z", metaKey: true });
    expect(screen.getByText("No edits")).toBeTruthy();
    fireEvent.keyDown(board, { key: "z", ctrlKey: true, shiftKey: true });
    expect(screen.getByText("1 edit")).toBeTruthy();
    fireEvent.keyDown(board, { key: "z", ctrlKey: true });
    fireEvent.keyDown(board, { key: "y", ctrlKey: true });
    expect(screen.getByText("1 edit")).toBeTruthy();
  });

  it("shows the campaign's technology date as fixed text, not a one-option dropdown", () => {
    render(<DrawingBoard />);
    expect(screen.queryByLabelText("Technology as of")).toBeNull();
    expect(screen.getByLabelText("Technology as of 1880-01 (campaign date)")).toBeTruthy();
  });

  it("in a campaign, opens on the first design that exists at the campaign date", () => {
    render(<DrawingBoard />);
    // Per-nation files (ADR-0109): the first design at or before the campaign date is the UK torpedo-gunboat starter.
    expect(screen.getByLabelText("Starting design").textContent).toMatch(
      /Torpedo gunboat \(starter, DD\)/,
    );
  });

  it("in a campaign, disables starting designs whose technology does not exist yet", () => {
    render(<DrawingBoard />);
    fireEvent.click(screen.getByLabelText("Starting design"));
    const option = (value: string) =>
      screen.getAllByRole("option").find((o) => o.getAttribute("data-value") === value)!;
    // The 1893/1895 designs need guns introduced in 1886+; at the 1880 campaign date they are shown but not selectable.
    const havock = option("havock_like");
    expect(havock.getAttribute("aria-disabled")).toBe("true");
    expect(havock.textContent).toMatch(/Not available until 1895-06/);
    // The 1880 designs (the generic cruiser and the historical ironclads) exist at the campaign date.
    expect(option("torpedo_cruiser_1880").getAttribute("aria-disabled")).toBeNull();
    expect(option("devastator_1873").getAttribute("aria-disabled")).toBeNull();
  });

  it("keeps the long drawing disclaimer behind a short line", () => {
    render(<DrawingBoard />);
    expect(screen.getByText(/Schematic, not a lines plan\./)).toBeTruthy();
    expect(screen.queryByText(/waterplane coefficient, LCB, sheer/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "About this drawing" }));
    expect(screen.getByText(/waterplane coefficient, LCB, sheer/)).toBeTruthy();
  });

  it("mounts a tab's panels when first opened and keeps them mounted after", () => {
    render(<DrawingBoard />);
    expect(screen.queryByRole("region", { name: "Edit history", hidden: true })).toBeNull();
    openTab("History and files");
    const history = screen.getByRole("region", { name: "Edit history" });
    openTab("Hull and machinery");
    expect(history.isConnected).toBe(true);
  });

  it("words counts in English", () => {
    expect(plural(0, "edit", "edits", "No edits")).toBe("No edits");
    expect(plural(1, "edit")).toBe("1 edit");
    expect(plural(1500, "fitting")).toBe("1,500 fittings");
    expect(plural(0, "warning")).toBe("0 warnings");
  });
});
