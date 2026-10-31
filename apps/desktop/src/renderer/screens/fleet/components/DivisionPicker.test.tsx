import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DivisionPickerRow } from "../fleet-screen-state.js";
import { DivisionPicker } from "./DivisionPicker.js";

afterEach(cleanup);

const row: DivisionPickerRow = {
  divisionId: "fleet_gbr_home",
  fleetName: "Home Fleet",
  areaName: "English Home Waters",
  ships: [
    {
      shipId: "alexandra",
      name: "HMS Alexandra",
      designId: "",
      status: "active",
      readiness: "ACTIVE",
      crewQuality: 100,
    },
  ],
};

describe("DivisionPicker", () => {
  it("titles each row with the fleet's name, never the internal id", () => {
    render(<DivisionPicker rows={[row]} selectedDivisionId={null} onSelectDivision={vi.fn()} />);
    expect(screen.getByText("Home Fleet")).not.toBeNull();
    expect(screen.getByText("English Home Waters")).not.toBeNull();
    expect(screen.getByText("1 ship")).not.toBeNull();
    expect(screen.queryByText(/fleet_gbr_home/)).toBeNull();
  });

  it("lists the ships of the selected division only", () => {
    const { rerender } = render(
      <DivisionPicker rows={[row]} selectedDivisionId={null} onSelectDivision={vi.fn()} />,
    );
    expect(screen.queryByText("HMS Alexandra")).toBeNull();
    rerender(
      <DivisionPicker rows={[row]} selectedDivisionId="fleet_gbr_home" onSelectDivision={vi.fn()} />,
    );
    expect(screen.getByText("HMS Alexandra")).not.toBeNull();
  });
});
