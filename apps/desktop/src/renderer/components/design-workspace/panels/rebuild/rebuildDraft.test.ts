import { describe, expect, it } from "vite-plus/test";
import { loadDrawingBoardContent } from "../../content.js";
import { bulgeMassKg, failureText, withBulgeMass } from "./rebuildDraft.js";

const draft = loadDrawingBoardContent().references[0]!.draft;

describe("bulgeMassKg", () => {
  it("is zero unless the action is a bulge", () => {
    expect(bulgeMassKg("STANDARD", 5000)).toBe(0);
    expect(bulgeMassKg("REARMAMENT", 5000)).toBe(0);
  });

  it("floors and clamps the blister mass of a bulge", () => {
    expect(bulgeMassKg("BULGE", 1234.9)).toBe(1234);
    expect(bulgeMassKg("BULGE", -5)).toBe(0);
  });
});

describe("withBulgeMass", () => {
  it("returns the same draft when there is no blister mass", () => {
    expect(withBulgeMass(draft, 0)).toBe(draft);
  });

  it("adds the blister mass to the target displacement", () => {
    const bulged = withBulgeMass(draft, 1000);
    expect(bulged).not.toBe(draft);
    expect(bulged.hull.targetDisplacementKg).toBe(draft.hull.targetDisplacementKg + 1000);
  });
});

describe("failureText", () => {
  it("falls back to the reason when there are no diagnostics", () => {
    expect(failureText({ diagnostics: [], reason: "Not allowed." })).toBe("Not allowed.");
  });

  it("joins the diagnostics in order", () => {
    expect(failureText({ diagnostics: ["First.", "Second."], reason: "Ignored." })).toBe(
      "First. Second.",
    );
  });
});
