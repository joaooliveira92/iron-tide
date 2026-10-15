import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { StarterDesign } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../../components/design-workspace/index.js";
import { referenceDeck } from "../reference-deck.js";
import { ReferenceDesignBrowser } from "./ReferenceDesignBrowser.js";

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const starters: StarterDesign[] = content.references.flatMap((r) =>
  r.starterFor === undefined
    ? []
    : [{ id: r.id, name: r.name, month: r.month, starterFor: r.starterFor, draft: r.draft }],
);
const deck = referenceDeck(env, starters, ref.draft.requirement.category);

function draw() {
  const onStart = vi.fn();
  render(
    <ReferenceDesignBrowser
      env={env}
      starters={starters}
      content={content}
      month={ref.month}
      currentCategory={ref.draft.requirement.category}
      onStart={onStart}
    />,
  );
  return { onStart, listbox: screen.getByRole("listbox", { name: "Ship types" }) };
}

const detailHeading = () =>
  within(screen.getByRole("region", { name: "Ship type details" })).getByRole("heading", {
    level: 2,
  }).textContent;

describe("ReferenceDesignBrowser", () => {
  it("offers one card per available ship type, each with its starter's profile drawing", () => {
    const { listbox } = draw();
    const options = within(listbox).getAllByRole("option", { hidden: true });
    expect(options).toHaveLength(deck.entries.length);
    const withDraft = deck.entries.filter((e) => e.draft !== null).length;
    expect(listbox.querySelectorAll("[data-testid='starter-profile']")).toHaveLength(withDraft);
    expect(listbox.querySelectorAll("[data-testid='profile-mount']").length).toBeGreaterThan(0);
  });

  it("opens on the current design's type and details it", () => {
    draw();
    const current = deck.entries[deck.initialIndex]!.definition;
    expect(detailHeading()).toContain(current.name);
  });

  it("previews on arrow keys without starting", () => {
    const { onStart, listbox } = draw();
    fireEvent.keyDown(listbox, { key: "ArrowRight" });
    const next = deck.entries[(deck.initialIndex + 1) % deck.entries.length]!.definition;
    expect(detailHeading()).toContain(next.name);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("starts from the focused type's starter on Enter or the detail's action", () => {
    const { onStart, listbox } = draw();
    const focused = deck.entries[deck.initialIndex]!;
    fireEvent.keyDown(listbox, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: `Start from ${focused.starter!.name}` }));
    expect(onStart.mock.calls).toEqual([[focused.starter!.id], [focused.starter!.id]]);
  });
});
