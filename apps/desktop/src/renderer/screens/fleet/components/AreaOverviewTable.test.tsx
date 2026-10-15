import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { AreaOverviewTable } from "./AreaOverviewTable.js";

describe("AreaOverviewTable", () => {
  afterEach(cleanup);

  it("renders one row per area, showing None where the player has nothing", () => {
    render(
      <AreaOverviewTable
        rows={[
          {
            areaId: "a",
            name: "Malta",
            ports: ["Valletta"],
            divisions: ["Mediterranean Fleet"],
            neighbours: ["Algeria"],
          },
          { areaId: "b", name: "Algeria", ports: [], divisions: [], neighbours: ["Malta"] },
        ]}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Your ports" })).toBeTruthy();
    expect(screen.getByText("Valletta")).toBeTruthy();
    expect(screen.getByText("Mediterranean Fleet")).toBeTruthy();
    expect(screen.getAllByText("None")).toHaveLength(2);
  });

  it("states the empty case plainly", () => {
    render(<AreaOverviewTable rows={[]} />);
    expect(screen.getByText("No areas in this campaign.")).toBeTruthy();
  });
});
