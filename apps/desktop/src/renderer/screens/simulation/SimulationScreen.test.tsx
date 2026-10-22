/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SimulationScreen } from "./SimulationScreen.js";

const hook = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("./hooks/useSimulationScreen.js", () => ({
  useSimulationScreen: () => hook.current,
}));

function makeHook(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    loading: false,
    error: null,
    activeTab: "overview",
    playerNationId: "uk",
    submarinePools: [],
    minePressure: [],
    landTargetDamage: [],
    commitResult: null,
    battleManifest: null,
    autoResolution: null,
    tacticalOutcome: null,
    battleLoading: false,
    battleError: null,
    setActiveTab: () => undefined,
    loadSnapshotData: async () => undefined,
    handleAdvanceTurn: async () => undefined,
    handleGenerateBattle: async () => undefined,
    handleAutoResolve: async () => undefined,
    handleTacticalResolve: async () => undefined,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("SimulationScreen", () => {
  it("composes the three tabs and registers the advance-turn primary action", () => {
    hook.current = makeHook();
    const onChange = vi.fn();
    render(<SimulationScreen sessionId="ses-1" onPrimaryActionChange={onChange} />);

    expect(screen.getByRole("tab", { name: /Strategic Overview/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Turn Report/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Battle Arena/ })).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: "Advance Turn (1 Month)", disabled: false }),
    );
  });

  it("marks the turn report with a new badge only once a month is committed", () => {
    hook.current = makeHook({ commitResult: { report: { month: { month: 1, year: 1880 } } } });
    render(<SimulationScreen sessionId="ses-1" onPrimaryActionChange={vi.fn()} />);

    expect(screen.getByText("new")).toBeTruthy();
  });

  it("surfaces a load error", () => {
    hook.current = makeHook({ error: "inspect failed" });
    render(<SimulationScreen sessionId="ses-1" onPrimaryActionChange={vi.fn()} />);

    expect(screen.getByText("inspect failed")).toBeTruthy();
  });

  it("disables the primary action while loading", () => {
    hook.current = makeHook({ loading: true });
    const onChange = vi.fn();
    render(<SimulationScreen sessionId="ses-1" onPrimaryActionChange={onChange} />);

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: "Processing turn…", disabled: true }),
    );
  });
});
