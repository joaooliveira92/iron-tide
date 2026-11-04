import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { TurnMessageDto, TurnSummaryEntry } from "../../../../shared/turn-message-contract.js";
import { setUiCatalogue } from "../../../content/uiCatalogue.js";
import {
  TurnSummaryFilterBar,
  TurnSummaryGroups,
  TurnSummaryHistory,
  TurnSummaryNoMatch,
  TurnSummaryProvider,
  TurnSummaryStatus,
  useTurnSummaryMeta,
} from "./index.js";

beforeEach(() => {
  setUiCatalogue({
    locale: "en-US",
    strings: {
      "messages.finance.budgetChanged.title": "Treasury updated",
      "messages.finance.budgetChanged.body": "{nationId} changed by {delta}.",
      "messages.war.declared.title": "War declared",
      "messages.war.declared.body": "War with {nationId}.",
      "ui.turnSummary.loading": "Loading turn summary…",
      "ui.turnSummary.empty": "No resolved turns yet.",
      "ui.turnSummary.searchPlaceholder": "Search",
      "ui.turnSummary.searchLabel": "Search the turn summary",
      "ui.turnSummary.allCategories": "All categories",
      "ui.turnSummary.categoryLabel": "Filter by category",
      "ui.turnSummary.allSeverities": "All severities",
      "ui.turnSummary.severityLabel": "Filter by severity",
      "ui.turnSummary.actionable": "Actionable ({count})",
      "ui.turnSummary.details": "Details",
      "ui.turnSummary.less": "Less",
      "ui.turnSummary.pin": "Pin",
      "ui.turnSummary.unpin": "Unpin",
      "ui.turnSummary.read": "Read",
      "ui.turnSummary.unread": "Unread",
      "ui.turnSummary.noMatch": "No messages match the current filters.",
      "ui.turnSummary.unavailableEntity": "This entity is no longer available.",
      "ui.turnSummary.category.DECISION": "Decisions",
      "ui.turnSummary.category.DIPLOMACY": "Diplomacy",
      "ui.turnSummary.category.WAR": "War",
      "ui.turnSummary.category.BATTLE": "Battles",
      "ui.turnSummary.category.CONSTRUCTION": "Construction",
      "ui.turnSummary.category.RESEARCH": "Research",
      "ui.turnSummary.category.INTELLIGENCE": "Intelligence",
      "ui.turnSummary.category.FINANCE": "Finance",
      "ui.turnSummary.category.SYSTEM": "System",
      "ui.turnSummary.severity.CRITICAL": "Critical",
      "ui.turnSummary.severity.HIGH": "High",
      "ui.turnSummary.severity.NORMAL": "Normal",
      "ui.turnSummary.severity.LOW": "Low",
    },
  });
});

afterEach(cleanup);

const message = (over: Partial<TurnMessageDto> & { id: string }): TurnMessageDto => ({
  turnId: "turn-1",
  occurredAt: "1880-02",
  phase: "construction_processing",
  category: "FINANCE",
  severity: "LOW",
  titleKey: "messages.finance.budgetChanged.title",
  bodyKey: "messages.finance.budgetChanged.body",
  interpolation: { nationId: "uk", delta: 5 },
  subjectRefs: [],
  effectRefs: [],
  blocking: false,
  requiresAcknowledgement: false,
  playerVisible: true,
  ...over,
});

const entry = (turnId: string, occurredAt: string, messages: readonly TurnMessageDto[]) =>
  ({
    turnId,
    projectionVersion: "1.0.0",
    occurredAt,
    rulesetVersion: "0.1.0",
    contentVersion: "0.5.0",
    messages,
  }) satisfies TurnSummaryEntry;

const emptyState = { pinnedIds: [] as string[], readIds: [] as string[] };

function Panel() {
  const { showHistory, showFilters } = useTurnSummaryMeta();
  return (
    <div>
      <TurnSummaryStatus />
      {showHistory && <TurnSummaryHistory />}
      {showFilters && <TurnSummaryFilterBar />}
      <TurnSummaryGroups />
      <TurnSummaryNoMatch />
    </div>
  );
}

describe("TurnSummaryProvider", () => {
  it("re-renders the groups from context when the history switches turn", () => {
    render(
      <TurnSummaryProvider
        summaries={[
          entry("turn-1", "1880-02", [message({ id: "m1", category: "FINANCE" })]),
          entry("turn-2", "1880-03", [
            message({
              id: "m2",
              category: "WAR",
              severity: "CRITICAL",
              titleKey: "messages.war.declared.title",
              bodyKey: "messages.war.declared.body",
              interpolation: { nationId: "fr" },
            }),
          ]),
        ]}
        loading={false}
        turnMessages={emptyState}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
      >
        <Panel />
      </TurnSummaryProvider>,
    );

    expect(screen.getByTestId("turn-message-group").getAttribute("data-category")).toBe("FINANCE");
    fireEvent.click(screen.getByRole("button", { name: "1880-03" }));
    expect(screen.getByTestId("turn-message-group").getAttribute("data-category")).toBe("WAR");
    expect(screen.getByTestId("severity-badge").textContent).toBe("Critical");
  });

  it("narrows the groups through the filter bar and reports when nothing matches", () => {
    render(
      <TurnSummaryProvider
        summaries={[
          entry("turn-1", "1880-02", [
            message({ id: "m1", category: "FINANCE" }),
            message({
              id: "m2",
              category: "WAR",
              titleKey: "messages.war.declared.title",
              bodyKey: "messages.war.declared.body",
              interpolation: { nationId: "fr" },
            }),
          ]),
        ]}
        loading={false}
        turnMessages={emptyState}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
      >
        <Panel />
      </TurnSummaryProvider>,
    );

    expect(screen.getAllByTestId("turn-message-group")).toHaveLength(2);
    fireEvent.change(screen.getByTestId("turn-search"), { target: { value: "zzz" } });
    expect(screen.queryByTestId("turn-message-group")).toBeNull();
    expect(screen.getByTestId("turn-summary-no-match")).toBeTruthy();
  });

  it("keeps only actionable messages behind the actionable filter", () => {
    render(
      <TurnSummaryProvider
        summaries={[
          entry("turn-1", "1880-02", [
            message({ id: "m1", category: "FINANCE" }),
            message({
              id: "m2",
              category: "WAR",
              severity: "CRITICAL",
              titleKey: "messages.war.declared.title",
              bodyKey: "messages.war.declared.body",
              interpolation: { nationId: "fr" },
            }),
          ]),
        ]}
        loading={false}
        turnMessages={emptyState}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
      >
        <Panel />
      </TurnSummaryProvider>,
    );

    fireEvent.click(screen.getByTestId("actionable-toggle"));
    const groups = screen.getAllByTestId("turn-message-group");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.getAttribute("data-category")).toBe("WAR");
    expect(screen.getByTestId("actionable-toggle").getAttribute("aria-pressed")).toBe("true");
  });

  it("routes pin and read toggles to the handlers with the message id", () => {
    const onTogglePinned = vi.fn();
    const onToggleRead = vi.fn();
    render(
      <TurnSummaryProvider
        summaries={[entry("turn-1", "1880-02", [message({ id: "m1" })])]}
        loading={false}
        turnMessages={emptyState}
        onTogglePinned={onTogglePinned}
        onToggleRead={onToggleRead}
      >
        <Panel />
      </TurnSummaryProvider>,
    );

    fireEvent.click(screen.getByTestId("toggle-pin"));
    fireEvent.click(screen.getByTestId("toggle-read"));
    expect(onTogglePinned).toHaveBeenCalledWith("m1");
    expect(onToggleRead).toHaveBeenCalledWith("m1");
  });

  it("marks pinned and read messages from the shared state", () => {
    render(
      <TurnSummaryProvider
        summaries={[entry("turn-1", "1880-02", [message({ id: "m1" })])]}
        loading={false}
        turnMessages={{ pinnedIds: ["m1"], readIds: ["m1"] }}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
      >
        <Panel />
      </TurnSummaryProvider>,
    );

    expect(screen.getByTestId("toggle-pin").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("toggle-read").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("toggle-pin").textContent).toBe("Unpin");
  });

  it("shows the historical record instead of opening an unavailable entity", () => {
    const onOpenEntity = vi.fn();
    render(
      <TurnSummaryProvider
        summaries={[
          entry("turn-1", "1880-02", [
            message({
              id: "m1",
              subjectRefs: [{ type: "ship", id: "s1" }],
              effectRefs: [
                {
                  target: { type: "ship", id: "s1" },
                  attribute: "hull",
                  previousValue: 10,
                  newValue: 4,
                  delta: -6,
                  visibility: "exact",
                },
              ],
            }),
          ]),
        ]}
        loading={false}
        turnMessages={emptyState}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
        onOpenEntity={onOpenEntity}
        isEntityAvailable={() => false}
      >
        <Panel />
      </TurnSummaryProvider>,
    );

    fireEvent.click(screen.getByTestId("entity-link"));
    expect(onOpenEntity).not.toHaveBeenCalled();
    expect(screen.getByTestId("entity-historical").textContent).toContain("hull: 10 → 4");

    fireEvent.click(screen.getByTestId("toggle-detail"));
    expect(screen.getByTestId("message-detail").textContent).toContain("ship:s1 hull: 10 → 4 (-6)");
  });

  it("opens the entity when it is available", () => {
    const onOpenEntity = vi.fn();
    render(
      <TurnSummaryProvider
        summaries={[
          entry("turn-1", "1880-02", [
            message({ id: "m1", subjectRefs: [{ type: "ship", id: "s1" }] }),
          ]),
        ]}
        loading={false}
        turnMessages={emptyState}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
        onOpenEntity={onOpenEntity}
        isEntityAvailable={() => true}
      >
        <Panel />
      </TurnSummaryProvider>,
    );

    fireEvent.click(screen.getByTestId("entity-link"));
    expect(onOpenEntity).toHaveBeenCalledWith({ type: "ship", id: "s1" });
    expect(screen.queryByTestId("entity-historical")).toBeNull();
  });

  it("treats an entity as openable when the screen supplies no availability check", () => {
    render(
      <TurnSummaryProvider
        summaries={[
          entry("turn-1", "1880-02", [
            message({ id: "m1", subjectRefs: [{ type: "ship", id: "s1" }] }),
          ]),
        ]}
        loading={false}
        turnMessages={emptyState}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
      >
        <Panel />
      </TurnSummaryProvider>,
    );

    fireEvent.click(screen.getByTestId("entity-link"));
    expect(screen.queryByTestId("entity-historical")).toBeNull();
  });

  it("shows the loading state and hides the filter bar while summaries are in flight", () => {
    render(
      <TurnSummaryProvider
        summaries={[]}
        loading
        turnMessages={emptyState}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
      >
        <Panel />
      </TurnSummaryProvider>,
    );

    expect(screen.getByText("Loading turn summary…")).toBeTruthy();
    expect(screen.queryByTestId("turn-summary-empty")).toBeNull();
    expect(screen.queryByTestId("turn-search")).toBeNull();
  });

  it("shows the empty state once no turn has resolved", () => {
    render(
      <TurnSummaryProvider
        summaries={[]}
        loading={false}
        turnMessages={emptyState}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
      >
        <Panel />
      </TurnSummaryProvider>,
    );

    expect(screen.getByTestId("turn-summary-empty").textContent).toBe("No resolved turns yet.");
  });
});
