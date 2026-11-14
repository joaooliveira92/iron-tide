import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type {
  EffectReferenceDto,
  EntityReferenceDto,
  TurnMessageDto,
  TurnSummaryEntry,
} from "../../../../shared/turn-message-contract.js";
import { authoredCatalogue } from "../../../../shared/authoredCatalogue.testing.js";
import { nationDisplayName } from "../../../content/presentationContent.js";
import { setUiCatalogue } from "../../../content/uiCatalogue.js";
import { TurnSummaryPanel } from "../TurnSummaryPanel.js";
import { DEFAULT_FILTERS, filterTurnMessages } from "../turn-summary-format.js";
import { createEntityLabeler } from "./entity-labels.js";

beforeEach(() => {
  setUiCatalogue(authoredCatalogue());
});

afterEach(cleanup);

const labeler = createEntityLabeler({
  labels: { "technology:dc_iron_subdivision": "Iron Hull Subdivision" },
  regionName: () => null,
});

const effect = (target: EntityReferenceDto): EffectReferenceDto => ({
  target,
  attribute: "points",
  previousValue: 1,
  newValue: 2,
  visibility: "exact",
});

const treasuryMessage = (nationId: string, effects: readonly EffectReferenceDto[] = []) =>
  ({
    id: "finance-1",
    turnId: "turn-1",
    occurredAt: "1880-02",
    phase: "construction_processing",
    category: "FINANCE",
    severity: "NORMAL",
    titleKey: "messages.finance.budgetChanged.title",
    bodyKey: "messages.finance.budgetChanged.body",
    interpolation: { nationId, delta: 100, newTreasury: 900 },
    subjectRefs: [{ type: "nation", id: nationId }],
    effectRefs: effects,
    blocking: false,
    requiresAcknowledgement: false,
    playerVisible: true,
  }) satisfies TurnMessageDto;

const entry = (message: TurnMessageDto): TurnSummaryEntry => ({
  turnId: "turn-1",
  projectionVersion: "1.0.0",
  occurredAt: "1880-02",
  rulesetVersion: "0.1.0",
  contentVersion: "0.5.0",
  messages: [message],
});

function renderPanel(message: TurnMessageDto) {
  render(
    <TurnSummaryPanel
      summaries={[entry(message)]}
      loading={false}
      turnMessages={{ pinnedIds: [], readIds: [] }}
      onTogglePinned={() => undefined}
      onToggleRead={() => undefined}
      entityLabel={labeler}
    />,
  );
}

describe("Turn summary names in body, search and effect targets (#735)", () => {
  it("names the nation in the Treasury updated body instead of its raw id", () => {
    renderPanel(treasuryMessage("austria_hungary"));
    const body = screen.getByText(/treasury changed by/).textContent ?? "";
    expect(body).toContain(nationDisplayName("austria_hungary"));
    expect(body).not.toContain("austria_hungary");
  });

  it("keeps the raw id in the body when the nation has no display name", () => {
    renderPanel(treasuryMessage("atlantis"));
    expect(screen.getByText(/treasury changed by/).textContent).toContain("atlantis");
  });

  it("matches the search box against display names as well as raw ids", () => {
    const message = treasuryMessage("austria_hungary");
    const search = (text: string) =>
      filterTurnMessages([message], { ...DEFAULT_FILTERS, search: text }, labeler).length;
    expect(search(nationDisplayName("austria_hungary").toLowerCase())).toBe(1);
    expect(search("austria_hungary")).toBe(1);
    expect(search("zzz")).toBe(0);
  });

  it("matches display names of effect targets", () => {
    const message = treasuryMessage("austria_hungary", [
      effect({ type: "technology", id: "dc_iron_subdivision" }),
    ]);
    expect(
      filterTurnMessages([message], { ...DEFAULT_FILTERS, search: "iron hull" }, labeler),
    ).toHaveLength(1);
  });

  it("filters the rendered panel by a typed display name", () => {
    renderPanel(treasuryMessage("austria_hungary"));
    const input = screen.getByTestId("turn-search");
    fireEvent.change(input, { target: { value: nationDisplayName("austria_hungary") } });
    expect(screen.getAllByTestId("turn-message")).toHaveLength(1);
    fireEvent.change(input, { target: { value: "no such name" } });
    expect(screen.queryAllByTestId("turn-message")).toHaveLength(0);
  });

  it("falls back to the entity type for an effect target with no display name", () => {
    renderPanel(
      treasuryMessage("austria_hungary", [
        effect({ type: "battle", id: "battle-1" }),
        effect({ type: "nation", id: "ottoman_empire" }),
        effect({ type: "formation", id: "formation-1" }),
        effect({ type: "shipClass", id: "class-1" }),
      ]),
    );
    fireEvent.click(screen.getByTestId("toggle-detail"));
    const lines = Array.from(
      screen.getByTestId("message-detail").querySelectorAll("p"),
      (node) => node.textContent ?? "",
    );
    expect(lines[0]).toMatch(/^Battle points:/);
    expect(lines[1]).toMatch(/^Nation points:/);
    expect(lines[2]).toMatch(/^Formation points:/);
    expect(lines[3]).toMatch(/^Ship class points:/);
    expect(lines.join(" ")).not.toMatch(/battle-1|ottoman_empire|formation-1|class-1/);
  });

  it("keeps naming a resolvable effect target", () => {
    renderPanel(
      treasuryMessage("austria_hungary", [
        effect({ type: "technology", id: "dc_iron_subdivision" }),
      ]),
    );
    fireEvent.click(screen.getByTestId("toggle-detail"));
    expect(screen.getByTestId("message-detail").textContent).toMatch(
      /^Iron Hull Subdivision points:/,
    );
  });
});
