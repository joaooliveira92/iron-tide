import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { FleetReportSections } from "./FleetReportSections.js";

const mocks = vi.hoisted(() => ({
  history: null as unknown,
  divisions: [] as unknown[],
}));
vi.mock("../../diplomacy/hooks/useBattleHistory.js", () => ({
  useBattleHistory: () => mocks.history,
}));
vi.mock("../hooks/useDivisionOrganization.js", () => ({
  useDivisionOrganization: () => ({ state: { divisions: mocks.divisions } }),
}));
vi.mock("../../../shell/CampaignShellContext.js", () => ({ useCampaignRevision: () => 3 }));

describe("FleetReportSections", () => {
  afterEach(cleanup);

  it("lists losses, officers and deferred items, all collapsed by default", () => {
    mocks.history = {
      status: "ready",
      history: {
        battles: [
          {
            sequence: 1,
            battleId: "b1",
            areaName: "Channel",
            lostShips: [
              {
                name: "HMS Lost",
                classId: "iron_clad",
                nationName: "Britain",
                ownedByPlayer: true,
                month: "1880-03",
                cause: "fire",
              },
            ],
          },
        ],
      },
    };
    mocks.divisions = [
      {
        divisionId: "d1",
        flagshipName: "HMS Lead",
        commanderVacant: false,
        commander: { officerId: "o", name: "Edmund Harcourt", rank: "COMMODORE", skill: 62 },
      },
      { divisionId: "d2", flagshipName: "HMS Two", commanderVacant: true },
    ];
    render(<FleetReportSections sessionId="s" />);
    for (const id of ["fleet-losses", "fleet-officers", "fleet-deferred"]) {
      expect((screen.getByTestId(id) as HTMLDetailsElement).open).toBe(false);
    }
    expect(within(screen.getByTestId("fleet-losses")).getByText("HMS Lost")).toBeTruthy();
    expect(screen.getByText(/lost to fire/)).toBeTruthy();
    expect(screen.getByText(/Commodore Edmund Harcourt · command rating 62/)).toBeTruthy();
    expect(screen.getByText("Commander vacant")).toBeTruthy();
    for (const name of ["Submarine roster", "Air groups", "Aircraft types", "Fleet exercise"]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });

  it("states honestly when nothing was lost or the history fails", () => {
    mocks.history = { status: "ready", history: { battles: [] } };
    mocks.divisions = [];
    render(<FleetReportSections sessionId="s" />);
    expect(screen.getByText("No ships lost yet.")).toBeTruthy();
    expect(screen.getByText("No divisions to command yet.")).toBeTruthy();
    cleanup();
    mocks.history = { status: "error", message: "boom" };
    render(<FleetReportSections sessionId="s" />);
    expect(screen.getByRole("alert").textContent).toContain("boom");
  });
});
