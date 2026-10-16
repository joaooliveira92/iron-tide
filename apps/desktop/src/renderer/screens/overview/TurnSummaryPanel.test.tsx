import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type {
  TurnMessageDto,
  TurnSummaryEntry,
} from "../../../shared/campaign-command-contract.js";
import { setUiCatalogue } from "../../content/uiCatalogue.js";
import { TurnSummaryPanel } from "./TurnSummaryPanel.js";

beforeAll(() => {
  setUiCatalogue({
    locale: "en-US",
    strings: {
      "messages.finance.budgetChanged.title": "Treasury updated",
      "messages.finance.budgetChanged.body": "{nationId} changed by {delta}.",
      "messages.construction.progress.title": "Construction progressed",
      "messages.construction.progress.body": "Work advanced on {count} project(s).",
      "messages.generic.body": "Something happened.",
    },
  });
});

afterEach(cleanup);

const message = (over: Partial<TurnMessageDto> & { id: string }): TurnMessageDto => ({
  turnId: "turn-1",
  occurredAt: "1880-02",
  phase: "construction_processing",
  category: "CONSTRUCTION",
  severity: "LOW",
  titleKey: "messages.construction.progress.title",
  bodyKey: "messages.construction.progress.body",
  interpolation: { count: 1 },
  subjectRefs: [{ type: "constructionProject", id: "p1" }],
  effectRefs: [],
  blocking: false,
  requiresAcknowledgement: false,
  playerVisible: true,
  ...over,
});

const summary = (messages: readonly TurnMessageDto[]): TurnSummaryEntry => ({
  turnId: "turn-1",
  projectionVersion: "1.0.0",
  occurredAt: "1880-02",
  rulesetVersion: "0.1.0",
  contentVersion: "0.5.0",
  messages,
});

const emptyState = { pinnedIds: [] as string[], readIds: [] as string[] };

describe("TurnSummaryPanel", () => {
  it("renders grouped, localized messages with a severity badge and an entity link", () => {
    render(
      <TurnSummaryPanel
        summaries={[
          summary([
            message({
              id: "m1",
              category: "FINANCE",
              severity: "CRITICAL",
              titleKey: "messages.finance.budgetChanged.title",
              bodyKey: "messages.finance.budgetChanged.body",
              interpolation: { nationId: "uk", delta: 5 },
              subjectRefs: [{ type: "nation", id: "uk" }],
            }),
          ]),
        ]}
        loading={false}
        defaultOpen
        turnMessages={emptyState}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
      />,
    );
    expect(screen.getByTestId("turn-message-group").getAttribute("data-category")).toBe("FINANCE");
    expect(screen.getByTestId("severity-badge").textContent).toBe("CRITICAL");
    expect(screen.getByText("uk changed by 5.")).toBeTruthy();
    expect(screen.getByTestId("entity-link").textContent).toContain("uk");
  });

  it("filters by search and restricts to actionable", () => {
    render(
      <TurnSummaryPanel
        summaries={[
          summary([
            message({ id: "m1" }),
            message({
              id: "m2",
              category: "FINANCE",
              severity: "CRITICAL",
              interpolation: { nationId: "uk" },
            }),
          ]),
        ]}
        loading={false}
        defaultOpen
        turnMessages={emptyState}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
      />,
    );
    expect(screen.getAllByTestId("turn-message")).toHaveLength(2);

    fireEvent.click(screen.getByTestId("actionable-toggle"));
    expect(screen.getAllByTestId("turn-message")).toHaveLength(1);

    fireEvent.change(screen.getByTestId("turn-search"), { target: { value: "zzz" } });
    expect(screen.getByTestId("turn-summary-no-match")).toBeTruthy();
  });

  it("expands an aggregate's detail and toggles pin/read without removing it", () => {
    const onTogglePinned = vi.fn();
    render(
      <TurnSummaryPanel
        summaries={[summary([message({ id: "m1", interpolation: { count: 3 } })])]}
        loading={false}
        defaultOpen
        turnMessages={emptyState}
        onTogglePinned={onTogglePinned}
        onToggleRead={() => undefined}
      />,
    );
    expect(screen.queryByTestId("message-detail")).toBeNull();
    fireEvent.click(screen.getByTestId("toggle-detail"));
    expect(screen.getByTestId("message-detail")).toBeTruthy();
    fireEvent.click(screen.getByTestId("toggle-pin"));
    expect(onTogglePinned).toHaveBeenCalledWith("m1");
    expect(screen.getAllByTestId("turn-message")).toHaveLength(1);
  });

  it("opens the entity a message concerns", () => {
    const onOpenEntity = vi.fn();
    render(
      <TurnSummaryPanel
        summaries={[summary([message({ id: "m1" })])]}
        loading={false}
        defaultOpen
        turnMessages={emptyState}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
        onOpenEntity={onOpenEntity}
      />,
    );
    fireEvent.click(screen.getByTestId("entity-link"));
    expect(onOpenEntity).toHaveBeenCalledWith({ type: "constructionProject", id: "p1" });
  });

  it("renders an empty state with no history", () => {
    render(
      <TurnSummaryPanel
        summaries={[]}
        loading={false}
        defaultOpen
        turnMessages={emptyState}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
      />,
    );
    expect(screen.getByTestId("turn-summary-empty")).toBeTruthy();
  });
});
