import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const debugFlag = vi.hoisted(() => ({ on: false }));
vi.mock("./debug-flag.js", () => ({
  get DEBUG_MODE() {
    return debugFlag.on;
  },
}));

import { BottomNav } from "./BottomNav.js";
import { CAMPAIGN_NAVIGATION_SECTIONS } from "./campaign-navigation.js";

describe("BottomNav (proof of concept)", () => {
  afterEach(cleanup);

  it("lists exactly the sidebar's screens, in sidebar order, as a labelled landmark", () => {
    render(<BottomNav screen="overview" onSelect={() => undefined} />);
    const nav = screen.getByRole("navigation", { name: "Campaign" });
    const labels = within(nav)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels).toEqual([
      ...CAMPAIGN_NAVIGATION_SECTIONS.flatMap((section) =>
        section.items.map((item) => item.shortLabel),
      ),
      "Ship design",
    ]);
  });

  it("marks only the current screen with aria-current and gives every entry a tooltip", () => {
    render(<BottomNav screen="treasury" onSelect={() => undefined} />);
    const current = screen.getAllByRole("button").filter((b) => b.ariaCurrent === "page");
    expect(current.map((b) => b.textContent)).toEqual(["Treasury"]);
    const items = CAMPAIGN_NAVIGATION_SECTIONS.flatMap((section) => section.items);
    for (const [index, item] of items.entries()) {
      const button = screen.getAllByRole("button")[index];
      expect(button?.getAttribute("title")).toBe(item.label);
      expect(button?.getAttribute("aria-label")).toBe(item.label);
    }
  });

  it("uses short labels that never truncate, while full names stay available", () => {
    render(<BottomNav screen="overview" onSelect={() => undefined} />);
    expect(screen.getByRole("button", { name: "Research & Technology" }).textContent).toBe(
      "Research",
    );
    expect(screen.getByRole("button", { name: "Diplomacy & War" }).textContent).toBe("Diplomacy");
    expect(screen.getByRole("button", { name: "Campaign Preferences" }).textContent).toBe("Prefs");
    for (const item of CAMPAIGN_NAVIGATION_SECTIONS.flatMap((section) => section.items)) {
      expect(item.shortLabel.length).toBeLessThanOrEqual(10);
    }
  });

  it("selects a screen when activated", () => {
    const onSelect = vi.fn();
    render(<BottomNav screen="overview" onSelect={onSelect} />);
    screen.getByRole("button", { name: "Fleet" }).click();
    expect(onSelect).toHaveBeenCalledWith("fleet");
  });

  it("opens the Ship design workspace modal from the bottom bar without navigating", () => {
    const onSelect = vi.fn();
    render(<BottomNav screen="overview" onSelect={onSelect} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ship design" }));
    expect(within(screen.getByRole("dialog")).getByText("Ship design")).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders nothing outside the campaign (new-game wizard, file picker)", () => {
    const { container } = render(<BottomNav screen="new-game-nation" onSelect={() => undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the engine session id in debug builds only (ADR-0058)", () => {
    const SESSION = "ecfd0892-05b3-4baf-aa64-295c439a19c1";
    debugFlag.on = false;
    const { unmount } = render(
      <BottomNav screen="overview" onSelect={() => undefined} footer={SESSION} />,
    );
    expect(screen.queryByText(SESSION)).toBeNull();
    unmount();
    debugFlag.on = true;
    render(<BottomNav screen="overview" onSelect={() => undefined} footer={SESSION} />);
    expect(screen.getByText(SESSION)).toBeTruthy();
  });
});
