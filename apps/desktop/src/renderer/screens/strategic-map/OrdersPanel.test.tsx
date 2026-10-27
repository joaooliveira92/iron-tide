/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { OrdersPanel, type OrdersPanelProps } from "./OrdersPanel.js";
import type { MapOrderFleet } from "../../components/world-map/map-orders.js";

const noop = () => undefined;

const fleet: MapOrderFleet = {
  fleetId: "home-fleet",
  fleetName: "Home Fleet",
  areaId: "sea_north_sea",
  mapAreaId: "area_north_sea",
  areaName: "North Sea",
  shipCount: 12,
  legalDestinations: [
    {
      areaId: "sea_western_approaches",
      mapAreaId: "area_western_approaches",
      name: "Western Approaches",
    },
  ],
  blockedReason: null,
};

function panel(overrides: Partial<OrdersPanelProps> = {}) {
  return (
    <OrdersPanel
      fleets={[fleet]}
      pending={[]}
      selectedFleet={null}
      choices={[]}
      notice={null}
      noticeKind="status"
      presence={{ configured: false }}
      areaName={(id) => (id === "med" ? "The Mediterranean" : id)}
      blockades={[]}
      onSelectFleet={noop}
      onOrder={noop}
      onChoose={noop}
      onCancelChoice={noop}
      onCancelOrder={noop}
      {...overrides}
    />
  );
}

afterEach(cleanup);

describe("OrdersPanel", () => {
  it("lists the player's fleets with their area and ship count", () => {
    render(panel());
    expect(screen.getByRole("button", { name: "Home Fleet" })).toBeTruthy();
    expect(screen.getByText("North Sea · 12")).toBeTruthy();
  });

  it("selects a fleet", () => {
    const onSelectFleet = vi.fn();
    render(panel({ onSelectFleet }));
    fireEvent.click(screen.getByRole("button", { name: "Home Fleet" }));
    expect(onSelectFleet).toHaveBeenCalledWith("home-fleet");
  });

  it("offers each legal destination as a button while the fleet is selected", () => {
    const onOrder = vi.fn();
    render(panel({ selectedFleet: fleet, onOrder }));
    fireEvent.click(screen.getByRole("button", { name: "Western Approaches" }));
    expect(onOrder).toHaveBeenCalledWith("home-fleet", "sea_western_approaches");
  });

  it("shows the engine's blocked reason verbatim and offers no destination", () => {
    const blocked: MapOrderFleet = {
      ...fleet,
      legalDestinations: [],
      blockedReason: { code: "SHIP_NOT_OPERATIONAL", message: "No operational ship in the fleet" },
    };
    render(panel({ fleets: [blocked], selectedFleet: blocked }));
    expect(screen.getByText("No operational ship in the fleet")).toBeTruthy();
    expect(screen.getByText("No legal destination this month.")).toBeTruthy();
  });

  it("shows a pending order and cancels it by command id", () => {
    const onCancelOrder = vi.fn();
    render(
      panel({
        pending: [
          {
            commandId: "cmd-7",
            fleetId: "home-fleet",
            fromMapAreaId: "area_north_sea",
            toMapAreaId: "area_western_approaches",
            destinationName: "Western Approaches",
          },
        ],
        onCancelOrder,
      }),
    );
    expect(screen.getByText(/Ordered: sails for Western Approaches/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    expect(onCancelOrder).toHaveBeenCalledWith("cmd-7");
  });

  it("asks which campaign area a dropped polygon meant when several share it", () => {
    const onChoose = vi.fn();
    const onCancelChoice = vi.fn();
    render(
      panel({
        selectedFleet: fleet,
        choices: [
          { areaId: "sea_a", mapAreaId: "area_shared", name: "Northern Sea" },
          { areaId: "sea_b", mapAreaId: "area_shared", name: "Southern Sea" },
        ],
        onChoose,
        onCancelChoice,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Southern Sea" }));
    expect(onChoose).toHaveBeenCalledWith("sea_b");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancelChoice).toHaveBeenCalled();
  });

  it("shows a rejection as an alert and a notice as a status", () => {
    const { rerender } = render(panel({ notice: "stale revision", noticeKind: "alert" }));
    expect(screen.getByRole("alert").textContent).toBe("stale revision");
    rerender(panel({ notice: "Order queued.", noticeKind: "status" }));
    expect(screen.getByRole("status").textContent).toBe("Order queued.");
  });

  it("says presence is not configured rather than inventing a value", () => {
    render(panel({ presence: { configured: false } }));
    expect(screen.getByText("Presence: not configured")).toBeTruthy();
  });

  it("renders the configured presence shortfall with its numbers and area name", () => {
    render(
      panel({
        presence: {
          configured: true,
          exempt: false,
          areas: [
            {
              areaId: "med",
              requiredTons: 40_000,
              presentTons: 28_000,
              shortfallTons: 12_000,
            },
            { areaId: "home", requiredTons: 10_000, presentTons: 10_000, shortfallTons: 0 },
          ],
        },
      }),
    );
    expect(
      screen.getByText("The Mediterranean: 12000 t short (required 40000, present 28000)"),
    ).toBeTruthy();
    expect(screen.queryByText(/required 10000/)).toBeNull();
  });

  it("names the blockades the player is party to", () => {
    render(
      panel({
        blockades: [{ key: "north", text: "France blockades Britain in the North Sea" }],
      }),
    );
    expect(screen.getByText("France blockades Britain in the North Sea")).toBeTruthy();
  });

  it("states what is not modelled instead of drawing a placeholder", () => {
    render(panel());
    expect(
      screen.getByText(
        "Foreign fleet positions are not known: intelligence is not modelled yet. Invasion range is not modelled yet.",
      ),
    ).toBeTruthy();
  });

  it("says when no fleet is under the player's command", () => {
    render(panel({ fleets: [] }));
    expect(screen.getByText("No fleets are under your command.")).toBeTruthy();
  });
});
