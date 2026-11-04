/* @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ResearchSelectionProvider, useResearchSelection } from "./ResearchSelection.js";

afterEach(cleanup);

function renderSelection() {
  return renderHook(() => useResearchSelection(), {
    wrapper: ({ children }: { readonly children: ReactNode }) => (
      <ResearchSelectionProvider initialFieldId="gunnery">{children}</ResearchSelectionProvider>
    ),
  });
}

describe("ResearchSelectionProvider", () => {
  it("starts on the initial field with nothing selected", () => {
    const { result } = renderSelection();
    expect(result.current.state).toEqual({
      fieldId: "gunnery",
      techId: null,
      techModalOpen: false,
    });
    expect(result.current.meta.isFieldSelected("gunnery")).toBe(true);
  });

  it("opens the technology modal on select and closes it when the same tech is selected again", () => {
    const { result } = renderSelection();
    act(() => result.current.actions.selectTech("t1"));
    expect(result.current.state.techId).toBe("t1");
    expect(result.current.state.techModalOpen).toBe(true);
    expect(result.current.meta.isTechSelected("t1")).toBe(true);
    act(() => result.current.actions.selectTech("t1"));
    expect(result.current.state.techModalOpen).toBe(false);
    expect(result.current.state.techId).toBe("t1");
  });

  it("clears the selected technology when the field changes", () => {
    const { result } = renderSelection();
    act(() => result.current.actions.selectTech("t1"));
    act(() => result.current.actions.selectField("armour"));
    expect(result.current.state.fieldId).toBe("armour");
    expect(result.current.state.techId).toBeNull();
  });

  it("refuses use outside a provider", () => {
    expect(() => renderHook(() => useResearchSelection())).toThrow(
      "RESEARCH_SELECTION_PROVIDER_MISSING",
    );
  });
});
