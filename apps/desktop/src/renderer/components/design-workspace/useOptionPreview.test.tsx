import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { buildWorkshopView } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { DesignWorkspaceFixture } from "./DesignWorkspaceFixture.js";
import { loadDrawingBoardContent } from "./content.js";
import { useOptionPreview } from "./useOptionPreview.js";

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const view = buildWorkshopView(ref.draft, content.environmentFor(ref.month, ref.draft.nationId));
const other = content.hullForms.find((f) => f.id !== ref.draft.hull.hullFormId)!;

const wrapper = ({ children }: { readonly children: ReactNode }) => (
  <DesignWorkspaceFixture content={content} draft={ref.draft} view={view} month={ref.month}>
    {children}
  </DesignWorkspaceFixture>
);

describe("useOptionPreview", () => {
  it("returns the same deltas across renders while the highlighted option is unchanged", () => {
    const { result, rerender } = renderHook(
      () => useOptionPreview((hullFormId) => ({ kind: "set_hull", patch: { hullFormId } })),
      { wrapper },
    );
    act(() => result.current.setActive(other.id));
    const shown = result.current.deltas;
    expect(shown.length).toBeGreaterThan(0);
    rerender();
    rerender();
    expect(result.current.deltas).toBe(shown);
  });

  it("returns one stable empty list while nothing is highlighted", () => {
    const { result, rerender } = renderHook(
      () => useOptionPreview((hullFormId) => ({ kind: "set_hull", patch: { hullFormId } })),
      { wrapper },
    );
    const none = result.current.deltas;
    rerender();
    expect(result.current.deltas).toBe(none);
    expect(none).toEqual([]);
  });
});
