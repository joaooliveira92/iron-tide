/* @vitest-environment jsdom */
import type { ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { BluewaveError } from "@bluewave/contracts";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { FleetFocusProvider, useFleetFocus } from "./fleet-focus.js";

function wrapper({ children }: { readonly children: ReactNode }) {
  return <FleetFocusProvider>{children}</FleetFocusProvider>;
}

describe("fleet focus", () => {
  afterEach(cleanup);

  it("starts without a focused ship", () => {
    const { result } = renderHook(() => useFleetFocus(), { wrapper });
    expect(result.current.focusShipId).toBeNull();
  });

  it("holds the focused ship until cleared", () => {
    const { result } = renderHook(() => useFleetFocus(), { wrapper });
    act(() => result.current.focusShip("ship-con-1"));
    expect(result.current.focusShipId).toBe("ship-con-1");
    act(() => result.current.clearFocus());
    expect(result.current.focusShipId).toBeNull();
  });

  it("throws outside the provider", () => {
    expect(() => renderHook(() => useFleetFocus())).toThrow(BluewaveError);
  });
});
