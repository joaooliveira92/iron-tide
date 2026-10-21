import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { useDesignSession } from "./useDesignSession.js";

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
