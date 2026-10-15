import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { MAP_PANEL_SIZES, WorldMapPanel } from "./WorldMapPanel.js";

describe("WorldMapPanel", () => {
  beforeAll(() => {
    // jsdom has no ResizeObserver; the glass card measures itself with one.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(cleanup);

  it("starts compact and lets the player pick a size", () => {
    render(<WorldMapPanel sessionId="ses-1" />);
    const group = screen.getByRole("group", { name: "Map size" });
    expect(group.querySelectorAll("button")).toHaveLength(MAP_PANEL_SIZES.length);
    expect(screen.getByRole("button", { name: "Compact" }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    expect(screen.getByRole("button", { name: "Large" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Compact" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("loads the map lazily and tells the player about the full-screen shortcut", async () => {
    render(<WorldMapPanel sessionId="ses-1" />);
    expect(screen.getByText("World map")).toBeTruthy();
    expect(screen.getByText("F1 opens a larger map")).toBeTruthy();
    expect(await screen.findByRole("application", { name: /World map/ })).toBeTruthy();
  });

  it("selects the focused campaign area on the map so the host screen and the map agree", async () => {
    const { container } = render(
      <WorldMapPanel sessionId="ses-1" focusAreaId="eng_home_coast" title="Fleet positions" />,
    );
    expect(screen.getByText("Fleet positions")).toBeTruthy();
    await screen.findByRole("application", { name: /World map/ });
    // eng_home_coast is drawn on the North Sea polygon; that area is the pressed one.
    const pressed = container.querySelectorAll('path[role="button"][aria-pressed="true"]');
    expect(pressed).toHaveLength(1);
    expect(pressed[0]?.getAttribute("aria-label")).toMatch(/^North Sea:/);
  });

  it("ignores a focus area that has no polygon rather than selecting something wrong", async () => {
    const { container } = render(<WorldMapPanel sessionId="ses-1" focusAreaId="not_a_real_area" />);
    await screen.findByRole("application", { name: /World map/ });
    expect(container.querySelectorAll('path[role="button"][aria-pressed="true"]')).toHaveLength(0);
  });
});
