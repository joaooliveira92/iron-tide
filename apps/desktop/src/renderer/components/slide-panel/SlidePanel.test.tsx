/* @vitest-environment jsdom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { PANEL_TRANSITION_MS } from "./constants.js";
import { SlidePanel } from "./SlidePanel.js";

function stubMatchMedia(reduced: boolean): void {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: reduced,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
}

describe("SlidePanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubMatchMedia(false);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders its children inside a region named by aria-labelledby when open", () => {
    render(
      <SlidePanel isOpen aria-labelledby="panel-title">
        <h2 id="panel-title">Dossier</h2>
      </SlidePanel>,
    );
    expect(screen.getByRole("region", { name: "Dossier" })).toBeTruthy();
  });

  it("stays mounted for the exit transition, then unmounts once closed", () => {
    const { rerender } = render(
      <SlidePanel isOpen aria-labelledby="panel-title">
        <h2 id="panel-title">Dossier</h2>
      </SlidePanel>,
    );

    rerender(
      <SlidePanel isOpen={false} aria-labelledby="panel-title">
        <h2 id="panel-title">Dossier</h2>
      </SlidePanel>,
    );
    expect(screen.queryByText("Dossier")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(PANEL_TRANSITION_MS);
    });
    expect(screen.queryByText("Dossier")).toBeNull();
  });

  it("starts shifted out and eases in after mount when animateOnMount is set", () => {
    render(
      <SlidePanel isOpen animateOnMount aria-labelledby="panel-title">
        <h2 id="panel-title">Dossier</h2>
      </SlidePanel>,
    );
    const region = screen.getByRole("region", { name: "Dossier" });
    expect(region.className).toContain("opacity-0");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(region.className).toContain("opacity-100");
  });

  it("is in the page flow, not pinned over its parent, when placed inline", () => {
    render(
      <SlidePanel isOpen placement="inline" aria-labelledby="panel-title">
        <h2 id="panel-title">Dossier</h2>
      </SlidePanel>,
    );
    const region = screen.getByRole("region", { name: "Dossier" });
    expect(region.className).not.toContain("absolute");
  });
});
