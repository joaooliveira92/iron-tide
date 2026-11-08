import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { useDesignSession } from "./useDesignSession.js";

describe("opening a design", () => {
  it("makes the opened design the baseline, under its own name, with clean history", () => {
    const { result } = renderHook(() => useDesignSession(null));
    const other = result.current.state.content.references.find(
      (r) => r.id !== result.current.state.preset.id,
    )!;
    act(() => result.current.openDesign(other.draft, "Nelson Pilot"));
    const { state, env } = result.current;
    expect(state.developedFrom).toBe("Nelson Pilot");
    expect(state.editCount).toBe(0);
    expect(state.canUndo).toBe(false);
    expect(state.baseline.compiled.hash).toBe(buildWorkshopView(other.draft, env).compiled.hash);
  });

  it("keeps the baseline when a file or alternative is loaded into the same design", () => {
    const { result } = renderHook(() => useDesignSession(null));
    const before = result.current.state.developedFrom;
    const other = result.current.state.content.references.find(
      (r) => r.id !== result.current.state.preset.id,
    )!;
    act(() => result.current.loadDraft(other.draft));
    expect(result.current.state.developedFrom).toBe(before);
  });
});

describe("design session environment", () => {
  it("exposes exactly the nation-aware environment its view was compiled with", () => {
    const { result } = renderHook(() => useDesignSession(null));
    const { state, env } = result.current;
    expect(env).toBe(state.env);
    expect(env.ctx.navalProfile?.nationId).toBe(state.draft.nationId);
    expect(env.ctx.month).toBe(state.month);
    expect(buildWorkshopView(state.draft, env).compiled.hash).toBe(state.view.compiled.hash);
  });
});
