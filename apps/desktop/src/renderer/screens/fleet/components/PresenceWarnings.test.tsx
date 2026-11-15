import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { explainPresenceShortfall, type PresenceWarningView } from "@bluewave/campaign-engine";
import { OrderSection, type OrderSectionProps } from "./OrderSection.js";
import { PresenceWarnings } from "./PresenceWarnings.js";

afterEach(cleanup);

const warning: PresenceWarningView = {
  areaId: "med_malta",
  requiredTons: 1200,
  presentTonsBefore: 8540,
  presentTonsAfter: 300,
  shortfallBefore: 0,
  shortfallAfter: 900,
  causeCommandIds: ["cmd-1"],
  explanation: explainPresenceShortfall(1200, 300, false, 900),
};

const areaName = (areaId: string) => (areaId === "med_malta" ? "Malta" : areaId);

describe("PresenceWarnings", () => {
  it("renders nothing without warnings", () => {
    const { container } = render(<PresenceWarnings warnings={[]} areaName={areaName} />);
    expect(container.innerHTML).toBe("");
  });

  it("names the station, the tonnage and the shortfall the queued orders would cause, with its explanation", () => {
    render(<PresenceWarnings warnings={[warning]} areaName={areaName} />);
    const row = screen.getByTestId("fleet-presence-warning-med_malta");
    expect(row.textContent).toContain("Malta");
    expect(row.textContent).toContain("300 t");
    expect(row.textContent).toContain("1200 t");
    expect(row.textContent).toContain("900 t");
    expect(screen.getByTestId("fleet-presence-warning-explanation-med_malta")).toBeTruthy();
  });

  it("shows beside the dispatch notice when the order section carries presence warnings", () => {
    const props: OrderSectionProps = {
      destinations: [{ id: "home", name: "Home" }],
      destinationAreaId: "home",
      onDestinationChange: () => undefined,
      order: {
        status: {
          divisionName: "Med",
          locationName: "Malta",
          routeFromName: null,
          routeToName: null,
        },
        pendingRoute: null,
      },
      actions: {
        busy: false,
        hasPendingRequest: false,
        onSubmit: () => undefined,
        onReplace: () => undefined,
        onCancel: () => undefined,
        onRefresh: () => undefined,
        onRetry: () => undefined,
      },
      notice: null,
      presence: { warnings: [warning], areaName },
    };
    render(<OrderSection {...props} />);
    expect(screen.getByTestId("fleet-presence-warnings")).toBeTruthy();
  });
});
