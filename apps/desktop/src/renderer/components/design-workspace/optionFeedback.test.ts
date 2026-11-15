import { describe, expect, it, vi } from "vite-plus/test";
import { buildWorkshopView, type DraftEdit } from "@bluewave/ship-design";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { loadDrawingBoardContent } from "./content.js";
import { createOptionFeedbackCache, previewOptionFeedback } from "./optionFeedback.js";

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

const otherHull = content.hullForms.find((f) => f.id !== ref.draft.hull.hullFormId)!;
const hullEdit: DraftEdit = { kind: "set_hull", patch: { hullFormId: otherHull.id } };
const powerEdit: DraftEdit = {
  kind: "set_machinery",
  patch: { installedKw: ref.draft.machinery.installedKw + 100 },
};
const invalid: DraftEdit = { kind: "remove_placement", instanceId: "no-such-instance" };

describe("previewOptionFeedback", () => {
  it("returns toned aspect changes for an edit without committing it", () => {
    const before = ref.draft.hull.hullFormId;
    const feedback = previewOptionFeedback(ref.draft, env, view, hullEdit, FORMAT);
    expect(feedback).not.toBeNull();
    expect(feedback!.hashBefore).toBe(view.compiled.hash);
    expect(feedback!.hashAfter).not.toBe(view.compiled.hash);
    expect(feedback!.aspects.length).toBeGreaterThan(0);
    for (const a of feedback!.aspects) expect(["better", "worse", "neutral"]).toContain(a.tone);
    expect(ref.draft.hull.hullFormId).toBe(before);
  });

  it("returns null rather than throwing when the edit cannot be applied", () => {
    expect(previewOptionFeedback(ref.draft, env, view, invalid, FORMAT)).toBeNull();
  });
});

describe("createOptionFeedbackCache", () => {
  it("builds a view once per option and draft hash, however often it is asked", () => {
    const preview = vi.fn(previewOptionFeedback);
    const cache = createOptionFeedbackCache(preview);
    const first = cache.feedbackFor(ref.draft, env, view, hullEdit, FORMAT);
    const again = cache.feedbackFor(ref.draft, env, view, hullEdit, FORMAT);
    expect(preview).toHaveBeenCalledTimes(1);
    expect(again).toBe(first);
    cache.feedbackFor(ref.draft, env, view, powerEdit, FORMAT);
    expect(preview).toHaveBeenCalledTimes(2);
  });

  it("remembers a failed build as null without retrying it", () => {
    const preview = vi.fn(previewOptionFeedback);
    const cache = createOptionFeedbackCache(preview);
    expect(cache.feedbackFor(ref.draft, env, view, invalid, FORMAT)).toBeNull();
    expect(cache.feedbackFor(ref.draft, env, view, invalid, FORMAT)).toBeNull();
    expect(preview).toHaveBeenCalledTimes(1);
  });

  it("starts afresh once the draft hash changes", () => {
    const preview = vi.fn(previewOptionFeedback);
    const cache = createOptionFeedbackCache(preview);
    cache.feedbackFor(ref.draft, env, view, hullEdit, FORMAT);
    const moved = { ...ref.draft, machinery: { ...ref.draft.machinery, installedKw: 1 } };
    const movedView = buildWorkshopView(moved, env);
    expect(movedView.compiled.hash).not.toBe(view.compiled.hash);
    cache.feedbackFor(moved, env, movedView, hullEdit, FORMAT);
    cache.feedbackFor(moved, env, movedView, hullEdit, FORMAT);
    expect(preview).toHaveBeenCalledTimes(2);
  });

  it("does not build until an option is asked for", () => {
    const preview = vi.fn(previewOptionFeedback);
    createOptionFeedbackCache(preview);
    expect(preview).not.toHaveBeenCalled();
  });
});
