import { describe, expect, it } from "vite-plus/test";
import { buildShipTypeRoster, type StarterDesign } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import { referenceDeck } from "./reference-deck.js";

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const starters: StarterDesign[] = content.references.flatMap((r) =>
  r.starterFor === undefined
    ? []
    : [{ id: r.id, name: r.name, month: r.month, starterFor: r.starterFor, draft: r.draft }],
);

describe("referenceDeck", () => {
  const roster = buildShipTypeRoster(env, starters);
  const available = roster.filter((e) => e.availability.available);
  const deck = referenceDeck(env, starters, ref.draft.requirement.category);

  it("has one card per available ship type, in roster order", () => {
    expect(deck.entries.map((e) => e.definition.id)).toEqual(available.map((e) => e.definition.id));
    expect(deck.lockedCount).toBe(roster.length - available.length);
  });

  it("carries each starter's own draft for the card's profile image", () => {
    for (const e of deck.entries) {
      if (e.starter === null) {
        expect(e.draft).toBeNull();
        continue;
      }
      expect(e.draft).toBe(starters.find((s) => s.id === e.starter!.id)!.draft);
    }
    expect(deck.entries.some((e) => e.draft !== null)).toBe(true);
  });

  it("opens on the current design's type, which only it marks as current", () => {
    const at = deck.entries[deck.initialIndex]!;
    expect(at.definition.id).toBe(ref.draft.requirement.category);
    expect(deck.entries.filter((e) => e.current)).toEqual([at]);
  });

  it("can start only from a legal starter design", () => {
    for (const e of deck.entries) expect(e.startable).toBe(e.starter !== null && e.starter.legal);
  });

  it("opens on the first card when the current type is not offered", () => {
    expect(referenceDeck(env, starters, "NOT_A_TYPE").initialIndex).toBe(0);
  });
});
