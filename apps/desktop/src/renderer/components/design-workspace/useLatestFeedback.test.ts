import {
  applyEdit,
  buildWorkshopView,
  type ArmourRegion,
  type WorkshopView,
} from "@bluewave/ship-design";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { loadDrawingBoardContent } from "./content.js";
import { useLatestFeedback } from "./useLatestFeedback.js";

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
const before = buildWorkshopView(ref.draft, env);
const BELT: ArmourRegion = {
  region: "BELT_UPPER",
  thicknessUm: 25_400,
  lengthMm: 20_000,
  heightMm: 1_000,
  materialId: "steel",
  cosObliquityBp: 10_000,
};
const armoured: WorkshopView = buildWorkshopView(
  applyEdit(ref.draft, { kind: "set_armour_region", region: BELT }),
  env,
);

describe("useLatestFeedback", () => {
  it("has no feedback and phase 0 before any edit", () => {
    const { result } = renderHook(() => useLatestFeedback(before, FORMAT));
    expect(result.current.feedback).toBeNull();
    expect(result.current.phase).toBe(0);
  });

  it("diffs the previous design against the new one when the compiled hash changes", () => {
    const { result, rerender } = renderHook(({ view }) => useLatestFeedback(view, FORMAT), {
      initialProps: { view: before },
    });
    rerender({ view: armoured });
    expect(armoured.compiled.hash).not.toBe(before.compiled.hash);
    expect(result.current.feedback?.hashBefore).toBe(before.compiled.hash);
    expect(result.current.feedback?.hashAfter).toBe(armoured.compiled.hash);
    expect(result.current.phase).toBe(1);
  });

  it("keeps the same feedback and phase when the hash is unchanged", () => {
    const { result, rerender } = renderHook(({ view }) => useLatestFeedback(view, FORMAT), {
      initialProps: { view: before },
    });
    rerender({ view: armoured });
    const first = result.current;
    rerender({ view: { ...armoured } });
    expect(result.current.feedback).toBe(first.feedback);
    expect(result.current.phase).toBe(first.phase);
  });

  it("alternates the phase on each further edit so the flash restarts", () => {
    const { result, rerender } = renderHook(({ view }) => useLatestFeedback(view, FORMAT), {
      initialProps: { view: before },
    });
    rerender({ view: armoured });
    rerender({ view: before });
    expect(result.current.phase).toBe(0);
    rerender({ view: armoured });
    expect(result.current.phase).toBe(1);
  });
});
