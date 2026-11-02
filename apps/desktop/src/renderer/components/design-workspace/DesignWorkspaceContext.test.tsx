import { buildWorkshopView } from "@bluewave/ship-design";
import { cleanup, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { loadDrawingBoardContent } from "./content.js";
import {
  DesignWorkspaceProvider,
  useDesignActions,
  useDesignState,
} from "./DesignWorkspaceContext.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const reference = content.references[0]!;
const env = content.environmentFor(reference.month);
const view = buildWorkshopView(reference.draft, env);
const errorFor = () => undefined;

function wrapperWith(edit: () => void) {
  return ({ children }: { readonly children: ReactNode }) => (
    <DesignWorkspaceProvider
      draft={reference.draft}
      view={view}
      content={content}
      ctx={env.ctx}
      month={reference.month}
      edit={edit}
      errorFor={errorFor}
    >
      {children}
    </DesignWorkspaceProvider>
  );
}

describe("DesignWorkspaceProvider", () => {
  it("exposes the design state to descendants", () => {
    const { result } = renderHook(() => useDesignState(), { wrapper: wrapperWith(vi.fn()) });
    expect(result.current.draft).toBe(reference.draft);
    expect(result.current.view).toBe(view);
    expect(result.current.month).toBe(reference.month);
  });

  it("exposes the supplied actions", () => {
    const edit = vi.fn();
    const { result } = renderHook(() => useDesignActions(), { wrapper: wrapperWith(edit) });
    expect(result.current.edit).toBe(edit);
    expect(result.current.errorFor).toBe(errorFor);
  });

  it("keeps the actions identity when only the state changes", () => {
    const edit = vi.fn();
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useDesignActions());
      return null;
    }
    const tree = (month: string) => (
      <DesignWorkspaceProvider
        draft={reference.draft}
        view={view}
        content={content}
        ctx={env.ctx}
        month={month}
        edit={edit}
        errorFor={errorFor}
      >
        <Probe />
      </DesignWorkspaceProvider>
    );
    const { rerender } = render(tree("1890-01"));
    rerender(tree("1895-06"));
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });

  it("refuses to be read outside a provider", () => {
    const silence = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useDesignState())).toThrow("DESIGN_WORKSPACE_PROVIDER_MISSING");
    expect(() => renderHook(() => useDesignActions())).toThrow("DESIGN_WORKSPACE_PROVIDER_MISSING");
    silence.mockRestore();
  });
});
