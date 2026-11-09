import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ShipbuildingWorkspace } from "./ShipbuildingWorkspace.js";

vi.unmock("../../components/design-workspace/ChoiceProblemDialog.js");

afterEach(cleanup);

const statusOf = (id: string) =>
  screen
    .getByRole("region", { name: "Engineering status" })
    .querySelector<HTMLElement>(`[data-status="${id}"]`)?.textContent ?? "";
const length = () => screen.getByLabelText(/^Length \(waterline\)/);
const commitLength = (value: string) => {
  fireEvent.change(length(), { target: { value } });
  fireEvent.blur(length());
};
const openHull = () =>
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Design sections" })).getByRole("button", {
      name: /^Hull/,
    }),
  );

describe("a choice that breaks the design", () => {
  it("explains a choice that breaks the design, and undoes it on request", () => {
    render(<ShipbuildingWorkspace />);
    openHull();
    const before = statusOf("displacement");
    commitLength("120");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("This change breaks the design")).toBeTruthy();
    expect(within(dialog).getAllByText("How to fix it").length).toBeGreaterThan(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Undo this choice" }));
    expect(screen.queryByText("This change breaks the design")).toBeNull();
    expect(statusOf("displacement")).toBe(before);
    expect(length().getAttribute("aria-invalid")).toBeNull();
  });

  it("says what changed, from and to, and the value against its limit in player units", () => {
    render(<ShipbuildingWorkspace />);
    openHull();
    commitLength("120");
    const dialog = screen.getByRole("dialog");
    const headline = within(dialog).getByText(/^Changing /).textContent ?? "";
    expect(headline).toMatch(/^Changing Length \(waterline\) from .+ to .+ leaves the design/);
    expect(headline).not.toMatch(/_|[a-z][A-Z]|[{}‰]|\b120000\b/);
    expect(within(dialog).getByText(/^Current .+; must not exceed .+/).textContent).toMatch(
      /^Current 131\.2 yd; must not exceed 76\.6 yd$/,
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Undo this choice" }));
  });

  it("keeps the invalid field marked after dismissing, and does not reopen for a finding already shown", () => {
    render(<ShipbuildingWorkspace />);
    openHull();
    const original = (length() as HTMLInputElement).value;
    commitLength("120");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Keep it and fix it myself",
      }),
    );
    expect(length().getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    commitLength("121");
    expect(screen.queryByText("This change breaks the design")).toBeNull();
    commitLength(original);
    expect(length().getAttribute("aria-invalid")).toBeNull();
  });
});

describe("inline errors beyond the hull", () => {
  it("marks the machinery field whose change broke the design", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Design sections" })).getByRole("button", {
        name: /^Machinery/,
      }),
    );
    const power = screen.getByLabelText(/^Installed power/) as HTMLInputElement;
    fireEvent.change(power, { target: { value: "1" } });
    fireEvent.blur(power);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep it and fix it myself" }));
    expect(power.getAttribute("aria-invalid")).toBe("true");
  });

  it("marks the armour region whose addition broke the design", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Design sections" })).getByRole("button", {
        name: /^Protection/,
      }),
    );
    const panel = screen.getByRole("region", { name: "Protection" });
    fireEvent.click(within(panel).getByRole("button", { name: "Add region" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Keep it and fix it myself",
      }),
    );
    const row = panel.querySelector<HTMLElement>("[data-armour-region]");
    expect(within(row as HTMLElement).getByRole("alert")).toBeTruthy();
  });
});
