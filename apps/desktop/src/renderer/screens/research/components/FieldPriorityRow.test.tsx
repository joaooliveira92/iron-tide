/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ResearchFieldRow } from "../research-view-model.js";
import { FieldPriorityRow } from "./FieldPriorityRow.js";

/**
 * Focused contract test for the extracted field row: it renders one field and
 * owns the INC-5 "5-High cap" affordance, but delegates the draft change to the
 * parent via `onSetWeight`.
 */

afterEach(cleanup);

const field = (over: Partial<ResearchFieldRow> = {}): ResearchFieldRow => ({
  fieldId: "GUNNERY",
  label: "Gunnery",
  weight: 2,
  projectedPoints: 1234,
  isHigh: false,
  ...over,
});

function renderRow(
  over: Partial<ResearchFieldRow> = {},
  props: Partial<Parameters<typeof FieldPriorityRow>[0]> = {},
) {
  return render(
    <FieldPriorityRow
      field={field(over)}
      highCapReached={false}
      highCap={5}
      busy={false}
      onSetWeight={() => {}}
      {...props}
    />,
  );
}

describe("FieldPriorityRow", () => {
  it("renders the field, its projected points and the three weight toggles", () => {
    renderRow();

    expect(screen.getByText("Gunnery")).toBeTruthy();
    expect(screen.getByText("~1,234 pts next month")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Gunnery" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gunnery High" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gunnery Med" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gunnery Low" })).toBeTruthy();
  });

  it("disables only the High toggle, with an explanation, when the cap is reached", () => {
    renderRow({}, { highCapReached: true });

    const high = screen.getByRole("button", { name: "Gunnery High" });
    expect(high.hasAttribute("disabled")).toBe(true);
    expect(high.getAttribute("title")).toMatch(/at most 5 fields may be high/i);
    expect(screen.getByRole("button", { name: "Gunnery Med" }).hasAttribute("disabled")).toBe(
      false,
    );
    expect(screen.getByRole("button", { name: "Gunnery Low" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("keeps High enabled for a field already at High even when the cap is reached", () => {
    renderRow({ weight: 4, isHigh: true }, { highCapReached: true });

    expect(screen.getByRole("button", { name: "Gunnery High" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("disables every toggle while the parent is busy", () => {
    renderRow({}, { busy: true });

    for (const label of ["High", "Med", "Low"]) {
      expect(
        screen.getByRole("button", { name: `Gunnery ${label}` }).hasAttribute("disabled"),
      ).toBe(true);
    }
  });

  it("reports the chosen weight to the parent", () => {
    const onSetWeight = vi.fn();
    renderRow({}, { onSetWeight });

    screen.getByRole("button", { name: "Gunnery Low" }).click();

    expect(onSetWeight).toHaveBeenCalledTimes(1);
    expect(onSetWeight).toHaveBeenCalledWith(1);
  });
});
