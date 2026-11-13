import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { TurnSummaryEntry } from "../../../../shared/turn-message-contract.js";
import { authoredCatalogue } from "../../../../shared/authoredCatalogue.testing.js";
import { setUiCatalogue } from "../../../content/uiCatalogue.js";
import { NO_ENTITY_LABELS } from "../turn-summary/entity-labels.js";
import { OverviewHeaderReports } from "./OverviewHeaderReports.js";

beforeEach(() => {
  setUiCatalogue(authoredCatalogue());
});

afterEach(cleanup);

const summaries: readonly TurnSummaryEntry[] = [
  {
    turnId: "turn-1",
    projectionVersion: "1.0.0",
    occurredAt: "1880-02",
    rulesetVersion: "0.1.0",
    contentVersion: "0.5.0",
    messages: [
      {
        id: "msg-1",
        turnId: "turn-1",
        occurredAt: "1880-02",
        phase: "construction_processing",
        category: "CONSTRUCTION",
        severity: "NORMAL",
        titleKey: "messages.construction.delivered.title",
        bodyKey: "messages.construction.delivered.body",
        interpolation: { shipName: "HMS Delivered", actualMonths: 4 },
        subjectRefs: [{ type: "ship", id: "ship-con-1" }],
        effectRefs: [],
        blocking: false,
        requiresAcknowledgement: false,
        playerVisible: true,
      },
    ],
  },
];

describe("OverviewHeaderReports Assign to fleet (#623)", () => {
  it("forwards the delivery link to the turn summary panel", () => {
    const onAssignToFleet = vi.fn<(shipId: string) => void>();
    render(
      <OverviewHeaderReports
        reports={[]}
        areaName={(id) => id}
        summaries={summaries}
        summariesLoading={false}
        turnMessages={{ pinnedIds: [], readIds: [] }}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
        onOpenEntity={() => undefined}
        onAssignToFleet={onAssignToFleet}
        isEntityAvailable={() => true}
        entityLabel={NO_ENTITY_LABELS}
      />,
    );
    fireEvent.click(screen.getByTestId("home-turn-summary"));
    fireEvent.click(screen.getByRole("button", { name: "Assign to fleet" }));
    expect(onAssignToFleet).toHaveBeenCalledExactlyOnceWith("ship-con-1");
  });
});
