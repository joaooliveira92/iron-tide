import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { TurnMessageDto, TurnSummaryEntry } from "../../../shared/turn-message-contract.js";
import { authoredCatalogue } from "../../../shared/authoredCatalogue.testing.js";
import { setUiCatalogue } from "../../content/uiCatalogue.js";
import { TurnSummaryPanel } from "./TurnSummaryPanel.js";

beforeEach(() => {
  setUiCatalogue(authoredCatalogue());
});

afterEach(cleanup);

const base: TurnMessageDto = {
  id: "msg-1",
  turnId: "turn-1",
  occurredAt: "1880-02",
  phase: "construction_processing",
  category: "CONSTRUCTION",
  severity: "NORMAL",
  titleKey: "messages.construction.delivered.title",
  bodyKey: "messages.construction.delivered.body",
  interpolation: { shipName: "HMS Delivered", actualMonths: 4 },
  subjectRefs: [
    { type: "ship", id: "ship-con-1" },
    { type: "constructionProject", id: "con-1" },
  ],
  effectRefs: [],
  blocking: false,
  requiresAcknowledgement: false,
  playerVisible: true,
};

const summary = (messages: readonly TurnMessageDto[]): TurnSummaryEntry => ({
  turnId: "turn-1",
  projectionVersion: "1.0.0",
  occurredAt: "1880-02",
  rulesetVersion: "0.1.0",
  contentVersion: "0.5.0",
  messages,
});

const renderPanel = (
  messages: readonly TurnMessageDto[],
  onAssignToFleet?: (shipId: string) => void,
  assignableNationId?: string,
) =>
  render(
    <TurnSummaryPanel
      summaries={[summary(messages)]}
      loading={false}
      turnMessages={{ pinnedIds: [], readIds: [] }}
      onTogglePinned={() => undefined}
      onToggleRead={() => undefined}
      {...(onAssignToFleet === undefined ? {} : { onAssignToFleet })}
      {...(assignableNationId === undefined ? {} : { assignableNationId })}
    />,
  );

const withNation = (nationId: string): TurnMessageDto => ({
  ...base,
  subjectRefs: [...base.subjectRefs, { type: "nation", id: nationId }],
});

describe("TurnSummaryPanel Assign to fleet (#623)", () => {
  it("offers the link only on deliveries of the assignable nation", () => {
    const handler = vi.fn<(shipId: string) => void>();
    renderPanel([withNation("germany")], handler, "uk");
    expect(screen.queryByRole("button", { name: "Assign to fleet" })).toBeNull();
    cleanup();
    renderPanel([withNation("uk")], handler, "uk");
    expect(screen.getByRole("button", { name: "Assign to fleet" })).toBeTruthy();
  });

  it("offers Assign to fleet on a delivery message and passes the ship id", () => {
    const onAssignToFleet = vi.fn<(shipId: string) => void>();
    renderPanel([base], onAssignToFleet);
    fireEvent.click(screen.getByRole("button", { name: "Assign to fleet" }));
    expect(onAssignToFleet).toHaveBeenCalledExactlyOnceWith("ship-con-1");
  });

  it("offers no link on other messages", () => {
    renderPanel(
      [
        {
          ...base,
          titleKey: "messages.construction.rebuilt.title",
          bodyKey: "messages.construction.rebuilt.body",
        },
      ],
      vi.fn<(shipId: string) => void>(),
    );
    expect(screen.queryByRole("button", { name: "Assign to fleet" })).toBeNull();
  });

  it("offers no link when the panel has no handler", () => {
    renderPanel([base]);
    expect(screen.queryByRole("button", { name: "Assign to fleet" })).toBeNull();
  });
});
