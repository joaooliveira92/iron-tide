/* @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  onSelect: vi.fn(),
  fixture: vi.fn((areaId: string): string | null => (areaId === "home" ? "fixture_home" : null)),
}));

vi.mock("../../../components/world-map/useWorldMapController.js", () => ({
  useWorldMapController: () => ({ onSelect: mocks.onSelect, camera: null }),
}));
vi.mock("../../../components/globe-adapter/MapSurface.js", () => ({
  MapSurface: () => null,
}));
vi.mock("../../../content/presentationContent.js", () => ({
  fixtureAreaId: mocks.fixture,
  nationHomeArea: () => "home",
}));

import { FleetMap } from "./FleetMap.js";

const base = { sessionId: "s", playerNationId: "uk", variant: "panel" } as const;

describe("fleet map focus", () => {
  afterEach(() => {
    cleanup();
    mocks.onSelect.mockClear();
  });

  it("selects the fixture area for a focused campaign area on mount", () => {
    render(<FleetMap {...base} focusAreaId="home" />);
    expect(mocks.onSelect).toHaveBeenCalledTimes(1);
    expect(mocks.onSelect).toHaveBeenCalledWith("fixture_home");
  });

  it("selects nothing without a focus or without a fixture for it", () => {
    render(<FleetMap {...base} focusAreaId={null} />);
    render(<FleetMap {...base} focusAreaId="unknown" />);
    expect(mocks.onSelect).not.toHaveBeenCalled();
  });

  it("selects again only when the focused area changes", () => {
    const { rerender } = render(<FleetMap {...base} focusAreaId="home" />);
    rerender(<FleetMap {...base} focusAreaId="home" />);
    expect(mocks.onSelect).toHaveBeenCalledTimes(1);
    rerender(<FleetMap {...base} focusAreaId={null} />);
    rerender(<FleetMap {...base} focusAreaId="home" />);
    expect(mocks.onSelect).toHaveBeenCalledTimes(2);
  });
});
