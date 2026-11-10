import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { buildShipTypeRoster, type StarterDesign } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../content.js";
import { ShipTypeDetails, ShipTypeFacts } from "./ShipTypeDetails.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const starters: StarterDesign[] = content.references.flatMap((r) =>
  r.starterFor === undefined
    ? []
    : [{ id: r.id, name: r.name, month: r.month, starterFor: r.starterFor, draft: r.draft }],
);
const roster = buildShipTypeRoster(env, starters);
const classified = roster.find(
  (e) => e.requirements.status === "CLASSIFIED" && e.starter?.costMicro != null,
)!;
const unclassified = roster.find((e) => e.requirements.status === "UNCLASSIFIED")!;
const unpriced = roster.find((e) => e.costLevel === null);

describe("ShipTypeDetails", () => {
  it("lists the classification requirement rows of a classified type", () => {
    render(<ShipTypeDetails entry={classified} />);
    const list = screen.getByRole("list", { name: "Classification requirements" });
    const count =
      classified.requirements.status === "CLASSIFIED" ? classified.requirements.rows.length : 0;
    expect(count).toBeGreaterThan(0);
    expect(list.querySelectorAll("li")).toHaveLength(count);
  });

  it("says an unclassified type has no classification rules", () => {
    render(<ShipTypeDetails entry={unclassified} />);
    expect(screen.getByText(/no classification rules/i)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Classification requirements" })).toBeNull();
  });
});

describe("ShipTypeFacts", () => {
  it("shows the starter price in treasury terms and no envelope Varies", () => {
    render(<ShipTypeFacts entry={classified} />);
    expect(screen.getByText("Starter price")).toBeTruthy();
    expect(screen.queryByText("Varies")).toBeNull();
    expect(screen.queryByText("Displacement")).toBeNull();
  });

  it("derives the cost level from the roster, not the authored relative cost", () => {
    const level = ["Very low", "Low", "Moderate", "High", "Very high"][classified.costLevel! - 1]!;
    render(<ShipTypeFacts entry={classified} />);
    expect(screen.getByText("Relative cost").nextSibling?.textContent).toContain(level);
  });

  it("shows no level where there is no priced starter", () => {
    expect(unpriced).toBeDefined();
    render(<ShipTypeFacts entry={unpriced!} />);
    expect(screen.getAllByText("No priced starter").length).toBeGreaterThan(0);
  });
});
