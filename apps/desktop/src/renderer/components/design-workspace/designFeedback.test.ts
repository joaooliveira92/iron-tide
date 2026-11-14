import { describe, expect, it } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { loadDrawingBoardContent } from "./content.js";
import { diffViews } from "./designFeedback.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const view = buildWorkshopView(ref.draft, env);

describe("diffViews", () => {
  it("reports nothing and equal hashes for identical views", () => {
    const feedback = diffViews(view, view, FORMAT);
    expect(feedback.aspects).toEqual([]);
    expect(feedback.findings).toEqual([]);
    expect(feedback.hashBefore).toBe(view.compiled.hash);
    expect(feedback.hashAfter).toBe(view.compiled.hash);
  });
});
