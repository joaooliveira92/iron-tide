import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DivisionPickerRow } from "../fleet-screen-state.js";
import { DivisionPicker } from "./DivisionPicker.js";

afterEach(cleanup);

const row: DivisionPickerRow = {
  divisionId: "fleet_gbr_home",
  fleetName: "Home Fleet",
  areaName: "English Home Waters",
  ships: [{ name: "HMS Alexandra", designId: "", status: "commissioned" }],
};

describe("DivisionPicker", () => {
  it("titles each card with the fleet's name, never the internal id", () => {
    render(<DivisionPicker rows={[row]} selectedDivisionId={null} onSelectDivision={vi.fn()} />);
    expect(screen.getByText("Home Fleet")).not.toBeNull();
    expect(screen.getByText("English Home Waters")).not.toBeNull();
    expect(screen.queryByText(/fleet_gbr_home/)).toBeNull();
    expect(screen.getByText("HMS Alexandra")).not.toBeNull();
  });
});
