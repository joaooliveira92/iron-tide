import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { FleetTradeProjection } from "../../../../shared/fleet-contract.js";
import { FleetTradeSection } from "./FleetTradeSection.js";
import { explainTradeRejection } from "./trade-model.js";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../../../lib/bridge-context.js", () => ({
  useBridge: () => ({ campaign: { execute: mocks.execute } }),
}));
vi.mock(import("../../../shell/CampaignShellContext.js"), async (importOriginal) => ({
  ...(await importOriginal()),
  useCampaignRevision: () => 1,
}));

const tree = (formulaId: string, result: number) => ({
  formulaId,
  formulaVersion: "fleet_v1",
  inputs: {},
  intermediate: {},
  result,
});

const trade = (over: Partial<FleetTradeProjection> = {}): FleetTradeProjection => ({
  atWar: true,
  quota: 4,
  quotaExplanation: tree("fleet_trade_quota", 4),
  assigned: 1,
  assignedExplanation: tree("fleet_trade_assigned", 1),
  shortfall: 3,
  shortfallBp: 7_500,
  shortfallExplanation: tree("fleet_trade_shortfall", 7_500),
  merchantPoolBp: 9_700,
  ships: [
    {
      shipId: "a",
      name: "HMS Amethyst",
      duty: "TRADE_PROTECTION",
      assignable: true,
      contributes: true,
      countsTowardQuota: true,
      canRaid: true,
    },
    {
      shipId: "b",
      name: "HMS Bulwark",
      duty: null,
      assignable: true,
      contributes: false,
      countsTowardQuota: false,
      canRaid: false,
    },
    {
      shipId: "c",
      name: "HMS Cutlass",
      duty: null,
      assignable: false,
      contributes: false,
      countsTowardQuota: false,
      canRaid: false,
    },
  ],
  ...over,
});

const projection = (value: FleetTradeProjection | undefined) => ({
  revision: 1,
  month: { month: 1, year: 1880 },
  playerNationId: "uk",
  divisions: [],
  areas: [],
  areaEdges: [],
  ports: [],
  movementCommands: [],
  presence: { configured: false },
  overBaseShips: [],
  ...(value === undefined ? {} : { trade: value }),
});

function answer(value: FleetTradeProjection | undefined, command?: unknown) {
  mocks.execute.mockImplementation((name: string) =>
    Promise.resolve(
      name === "inspectFleetScreen"
        ? { outcome: "success", value: projection(value), diagnostics: [] }
        : command,
    ),
  );
}

describe("FleetTradeSection (submitTradeDuty)", () => {
  afterEach(() => {
    cleanup();
    mocks.execute.mockReset();
  });

  it("renders nothing while the trade section is not authored", async () => {
    answer(undefined);
    const { container } = render(<FleetTradeSection sessionId="s" />);
    await waitFor(() => expect(mocks.execute).toHaveBeenCalled());
    expect(container.querySelector("[data-testid='fleet-trade']")).toBeNull();
  });

  it("reads the quota, assigned count, shortfall and pool, each with an explanation", async () => {
    answer(trade());
    render(<FleetTradeSection sessionId="s" />);
    const text = (id: string) => screen.getByTestId(id).textContent;
    expect((await screen.findByTestId("fleet-trade-quota")).textContent).toContain(
      "Quota: 4 ships",
    );
    expect(text("fleet-trade-assigned")).toContain("counted: 1");
    expect(text("fleet-trade-shortfall")).toContain("Short by 3 ships (75%");
    expect(text("fleet-trade-pool")).toContain("97%");
    for (const id of ["quota", "assigned", "shortfall"]) {
      expect(screen.queryByTestId(`fleet-trade-${id}-explanation`)).not.toBeNull();
    }
    expect(text("fleet-trade-duty-a")).toContain("trade protection");
  });

  it("says the quota is not in force in peacetime", async () => {
    answer(trade({ atWar: false }));
    render(<FleetTradeSection sessionId="s" />);
    expect(await screen.findByText(/quota is not in force/)).toBeTruthy();
  });

  it("submits raider duty for the selected ships and reports it queued", async () => {
    answer(trade(), {
      outcome: "success",
      value: { commandId: "c1", duty: "RAIDER", shipCount: 1, appliedOnNextTurn: true },
      diagnostics: [],
    });
    render(<FleetTradeSection sessionId="s" />);
    fireEvent.click(await screen.findByLabelText("Select HMS Bulwark"));
    fireEvent.click(screen.getByRole("button", { name: "Raider" }));
    await waitFor(() =>
      expect(mocks.execute).toHaveBeenCalledWith(
        "submitTradeDuty",
        expect.objectContaining({ duty: "RAIDER", shipIds: ["b"] }),
      ),
    );
    expect(await screen.findByText(/1 ship queued as a raider/)).toBeTruthy();
  });

  it("submits trade protection and clear for the selection", async () => {
    answer(trade(), {
      outcome: "success",
      value: { commandId: "c2", duty: "NONE", shipCount: 1, appliedOnNextTurn: true },
      diagnostics: [],
    });
    render(<FleetTradeSection sessionId="s" />);
    fireEvent.click(await screen.findByLabelText("Select HMS Amethyst"));
    fireEvent.click(screen.getByRole("button", { name: "Clear duty" }));
    await waitFor(() =>
      expect(mocks.execute).toHaveBeenCalledWith(
        "submitTradeDuty",
        expect.objectContaining({ duty: "NONE", shipIds: ["a"] }),
      ),
    );
  });

  it("cannot select a ship the engine would refuse", async () => {
    answer(trade());
    render(<FleetTradeSection sessionId="s" />);
    const cutlass = await screen.findByLabelText<HTMLInputElement>("Select HMS Cutlass");
    expect(cutlass.disabled).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Trade protection" }).disabled,
    ).toBe(true);
  });

  it("words a per-ship rejection with the ship name", () => {
    const lines = explainTradeRejection(
      ["Trade duty RAIDER rejected: b=NOT_ACTIVE, zz=NOT_OWNED"],
      new Map([["b", "HMS Bulwark"]]),
    );
    expect(lines).toEqual([
      "Trade duty rejected. Nothing was queued.",
      "HMS Bulwark is not on active service.",
      "zz is not one of your ships.",
    ]);
  });
});
