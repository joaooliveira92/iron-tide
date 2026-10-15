import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { MovementCommand } from "@bluewave/campaign-engine";
import type { OrderStatusView } from "../fleet-screen-state.js";
import { OrderSection, type OrderSectionActions, type OrderSectionProps } from "./OrderSection.js";

afterEach(cleanup);

const route: MovementCommand = {
  commandId: "cmd_1",
  divisionId: "fleet_home",
  fromAreaId: "home",
  toAreaId: "channel",
  status: "submitted",
  submittedAtRevision: 4,
};

function status(overrides: Partial<OrderStatusView> = {}): OrderStatusView {
  return {
    divisionName: "Home Fleet",
    locationName: "English Home Waters",
    routeFromName: null,
    routeToName: null,
    ...overrides,
  };
}

function orderActions(overrides: Partial<OrderSectionActions> = {}): OrderSectionActions {
  return {
    busy: false,
    hasPendingRequest: false,
    onSubmit: vi.fn(),
    onReplace: vi.fn(),
    onCancel: vi.fn(),
    onRefresh: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

function makeProps(overrides: Partial<OrderSectionProps> = {}): OrderSectionProps {
  return {
    destinations: [
      { id: "home", name: "English Home Waters" },
      { id: "channel", name: "English Channel" },
    ],
    destinationAreaId: "channel",
    onDestinationChange: vi.fn(),
    order: { status: status(), pendingRoute: null },
    actions: orderActions(),
    notice: null,
    ...overrides,
  };
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Submit movement command" }) as HTMLButtonElement;
}

describe("OrderSection", () => {
  it("asks for a division and blocks the order until one is selected", () => {
    render(
      <OrderSection
        {...makeProps({ order: { status: status({ divisionName: null }), pendingRoute: null } })}
      />,
    );
    expect(screen.getByText("Select a division.")).toBeTruthy();
    expect(submitButton().disabled).toBe(true);
  });

  it("names the selected division and where it is when it has no pending route", () => {
    render(<OrderSection {...makeProps()} />);
    const summary = screen.getByText(/with no pending route/);
    expect(summary.textContent).toContain("Home Fleet");
    expect(summary.textContent).toContain("English Home Waters");
    expect(submitButton().disabled).toBe(false);
  });

  it("summarises a pending route and offers replace and cancel", () => {
    const actions = orderActions();
    render(
      <OrderSection
        {...makeProps({
          order: {
            status: status({
              routeFromName: "English Home Waters",
              routeToName: "English Channel",
            }),
            pendingRoute: route,
          },
          actions,
        })}
      />,
    );
    expect(screen.getByText(/has a pending route/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Replace pending route" }));
    expect(actions.onReplace).toHaveBeenCalledWith("cmd_1");
    fireEvent.click(screen.getByRole("button", { name: "Cancel pending route" }));
    expect(actions.onCancel).toHaveBeenCalledWith("cmd_1");
  });

  it("disables submit when no destination is chosen", () => {
    render(<OrderSection {...makeProps({ destinationAreaId: null })} />);
    expect(submitButton().disabled).toBe(true);
  });

  it("offers retry only while a request outcome is unknown", () => {
    const { rerender } = render(<OrderSection {...makeProps()} />);
    expect(screen.queryByRole("button", { name: "Retry pending request" })).toBeNull();
    const actions = orderActions({ hasPendingRequest: true });
    rerender(<OrderSection {...makeProps({ actions })} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry pending request" }));
    expect(actions.onRetry).toHaveBeenCalled();
  });

  it("shows a notice only when the engine reported one", () => {
    const { rerender } = render(<OrderSection {...makeProps()} />);
    expect(screen.queryByText("Order queued.")).toBeNull();
    rerender(<OrderSection {...makeProps({ notice: "Order queued." })} />);
    expect(screen.getByText("Order queued.")).toBeTruthy();
  });
});
