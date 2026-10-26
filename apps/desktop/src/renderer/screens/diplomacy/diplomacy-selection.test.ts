import { describe, expect, it } from "vite-plus/test";
import { resolveSelectedNation, stepSelection } from "./diplomacy-selection.js";
import type { DiplomacyRelationRow } from "./diplomacy-view-model.js";

const row = (partnerNationId: string) => ({ partnerNationId }) as DiplomacyRelationRow;
const rows = [row("france"), row("germany"), row("italy")];

describe("resolveSelectedNation", () => {
  it("prefers the picked nation, then the drafted one, then the most threatening", () => {
    expect(resolveSelectedNation(rows, "italy", "germany")?.partnerNationId).toBe("italy");
    expect(resolveSelectedNation(rows, null, "germany")?.partnerNationId).toBe("germany");
    expect(resolveSelectedNation(rows, null, null)?.partnerNationId).toBe("france");
  });

  it("ignores ids that are no longer in the roster and handles an empty roster", () => {
    expect(resolveSelectedNation(rows, "gone", "also-gone")?.partnerNationId).toBe("france");
    expect(resolveSelectedNation([], "france", null)).toBeNull();
  });
});

describe("stepSelection", () => {
  it("moves through the roster and wraps at both ends", () => {
    expect(stepSelection(rows, "france", 1)).toBe("germany");
    expect(stepSelection(rows, "italy", 1)).toBe("france");
    expect(stepSelection(rows, "france", -1)).toBe("italy");
  });

  it("starts at the top when nothing is selected and returns null for an empty roster", () => {
    expect(stepSelection(rows, null, -1)).toBe("france");
    expect(stepSelection([], null, 1)).toBeNull();
  });
});
