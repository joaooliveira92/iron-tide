import { isBluewaveError } from "@bluewave/contracts";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { DARK_MAP_PALETTE } from "../map-palette.js";
import { useWorldMapLayer, WorldMapLayerProvider } from "./WorldMapLayerContext.js";

describe("WorldMapLayerContext", () => {
  it("exposes palette as meta and strokeFor as actions", () => {
    const strokeFor = () => "stroke";
    const { result } = renderHook(() => useWorldMapLayer(), {
      wrapper: ({ children }) => (
        <WorldMapLayerProvider palette={DARK_MAP_PALETTE} strokeFor={strokeFor}>
          {children}
        </WorldMapLayerProvider>
      ),
    });
    expect(result.current.meta.palette).toBe(DARK_MAP_PALETTE);
    expect(result.current.actions.strokeFor).toBe(strokeFor);
  });

  it("fails with a tagged error outside a provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let caught: unknown;
    try {
      renderHook(() => useWorldMapLayer());
    } catch (error) {
      caught = error;
    }
    quiet.mockRestore();
    expect(isBluewaveError(caught)).toBe(true);
  });
});
