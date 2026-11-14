import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type {
  EntityReferenceDto,
  TurnMessageDto,
  TurnSummaryEntry,
} from "../../../../shared/turn-message-contract.js";
import { authoredCatalogue } from "../../../../shared/authoredCatalogue.testing.js";
import { nationDisplayName } from "../../../content/presentationContent.js";
import { setUiCatalogue } from "../../../content/uiCatalogue.js";
import { TurnSummaryPanel } from "../TurnSummaryPanel.js";
import { createEntityLabeler } from "./entity-labels.js";

beforeEach(() => {
  setUiCatalogue(authoredCatalogue());
});

afterEach(cleanup);

const TECHNOLOGY_NAME = "Iron Hull Subdivision & Pumping";

const researchMessage = (refs: readonly EntityReferenceDto[]): TurnMessageDto => ({
  id: "research-1",
  turnId: "turn-1",
  occurredAt: "1880-02",
  phase: "construction_processing",
  category: "RESEARCH",
  severity: "LOW",
  titleKey: "messages.research.progressed.title",
  bodyKey: "messages.research.progressed.body",
  interpolation: { count: 16 },
  subjectRefs: refs,
  effectRefs: [
    {
      target: { type: "technology", id: "dc_iron_subdivision" },
      attribute: "points",
      previousValue: 1,
      newValue: 2,
      visibility: "exact",
    },
  ],
  blocking: false,
  requiresAcknowledgement: false,
  playerVisible: true,
});

const entry = (message: TurnMessageDto): TurnSummaryEntry => ({
  turnId: "turn-1",
  projectionVersion: "1.0.0",
  occurredAt: "1880-02",
  rulesetVersion: "0.1.0",
  contentVersion: "0.5.0",
  messages: [message],
});

const REFS: readonly EntityReferenceDto[] = [
  { type: "technology", id: "dc_iron_subdivision" },
  { type: "technology", id: "unnamed_technology" },
  { type: "nation", id: "austria_hungary" },
  { type: "nation", id: "atlantis" },
  { type: "constructionProject", id: "project-player-64e7f78dcf6c4bf2e2029f439d6657d4b5bd8b-1" },
  { type: "region", id: "area_adriatic" },
  { type: "battle", id: "battle-1" },
];

const labeler = createEntityLabeler({
  labels: { "technology:dc_iron_subdivision": TECHNOLOGY_NAME },
  regionName: (id) => (id === "area_adriatic" ? "Adriatic Sea" : null),
});

function renderPanel(isEntityAvailable?: (ref: EntityReferenceDto) => boolean) {
  render(
    <TurnSummaryPanel
      summaries={[entry(researchMessage(REFS))]}
      loading={false}
      turnMessages={{ pinnedIds: [], readIds: [] }}
      onTogglePinned={() => undefined}
      onToggleRead={() => undefined}
      entityLabel={labeler}
      {...(isEntityAvailable === undefined ? {} : { isEntityAvailable })}
    />,
  );
}

const chipTexts = () => screen.getAllByTestId("entity-link").map((node) => node.textContent);

describe("Turn summary entity chips (#727)", () => {
  it("shows display names for resolvable references and hides the rest", () => {
    renderPanel();
    expect(chipTexts()).toEqual([
      TECHNOLOGY_NAME,
      nationDisplayName("austria_hungary"),
      "Adriatic Sea",
    ]);
  });

  it("never prints a raw id or a type prefix on a chip", () => {
    renderPanel();
    const joined = chipTexts().join(" ");
    expect(joined).not.toMatch(
      /dc_iron_subdivision|austria_hungary|project-player|area_adriatic|atlantis|battle-1/,
    );
    expect(joined).not.toMatch(/technology:|nation:|constructionProject:|region:/);
  });

  it("shows the display name, not the raw id, in the historical record", () => {
    renderPanel(() => false);
    fireEvent.click(screen.getAllByTestId("entity-link")[0]!);
    const text = screen.getByTestId("entity-historical").textContent ?? "";
    expect(text).toContain(TECHNOLOGY_NAME);
    expect(text).not.toContain("dc_iron_subdivision");
  });

  it("names the target of an effect in the details instead of its raw id", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("toggle-detail"));
    const text = screen.getByTestId("message-detail").textContent ?? "";
    expect(text).toContain(TECHNOLOGY_NAME);
    expect(text).not.toContain("dc_iron_subdivision");
  });

  it("renders no chip row when no reference has a display name", () => {
    render(
      <TurnSummaryPanel
        summaries={[entry(researchMessage([{ type: "battle", id: "battle-1" }]))]}
        loading={false}
        turnMessages={{ pinnedIds: [], readIds: [] }}
        onTogglePinned={() => undefined}
        onToggleRead={() => undefined}
        entityLabel={labeler}
      />,
    );
    expect(screen.queryByTestId("entity-link")).toBeNull();
    expect(screen.queryByTestId("entity-chips")).toBeNull();
  });
});
