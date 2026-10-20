import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useState } from "react";
import { DrawingBoard } from "./DrawingBoard.js";
import { loadDrawingBoardContent } from "../../../components/design-workspace/content.js";
import { HullPlanPanel } from "../../../components/design-workspace/panels/index.js";
import { buildWorkshopView, type DesignDraft } from "@bluewave/ship-design";
import { armMove, openPlanDisplay, openTab } from "./test-helpers.js";
import { ShipViewBoundary } from "../../../components/design-workspace/workspace/ShipViewBoundary.js";
import { ShipWorkspace } from "../../../components/design-workspace/workspace/ShipWorkspace.js";
import {
  readStoredSplit,
  SPLIT_DEFAULT,
  SPLIT_MAX,
  SPLIT_MIN,
  SPLIT_STORAGE_KEY,
  TAB_PANE_MIN,
} from "../../../components/design-workspace/workspace/useSplitWidth.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const TAB_NAMES = ["Arrangement", "Analysis", "Build", "History and files", "Hull and machinery"];
const shipView = () => screen.getByRole("region", { name: "Ship view" });
const plan = () => within(shipView()).getByRole("img", { name: /Top-down plan/ });
const fittings = () => Number(/(\d+) fittings placed/.exec(plan().getAttribute("aria-label")!)![1]);

describe("Drawing Board workspace", () => {
  it("keeps one ship drawing mounted, with its tool state, across all five tabs", async () => {
    render(<DrawingBoard />);
    const drawing = plan();
    await armMove();
    const clickLayer = screen.getByTestId("plan-click-layer");
    openPlanDisplay();
    fireEvent.click(screen.getByLabelText("Show gun arcs"));
    for (const tab of TAB_NAMES) {
      openTab(tab);
      expect(
        screen.getByRole("tab", { name: new RegExp(tab, "i") }).getAttribute("aria-selected"),
      ).toBe("true");
      // Same DOM node: the drawing was neither re-created nor re-mounted by the tab switch.
      expect(plan()).toBe(drawing);
      expect(drawing.isConnected).toBe(true);
      expect(screen.getByTestId("plan-click-layer")).toBe(clickLayer);
      expect(drawing.querySelectorAll("[data-arc]").length).toBe(0);
    }
    expect(screen.getAllByRole("img", { name: /Top-down plan/ })).toHaveLength(1);
  });

  it("keeps the ship view outside the tab panels", () => {
    render(<DrawingBoard />);
    for (const panel of screen.getAllByRole("tabpanel", { hidden: true }))
      expect(panel.contains(shipView())).toBe(false);
    expect(within(shipView()).queryByRole("tab")).toBeNull();
  });

  it("keeps a typed but uncommitted value through tab switches", () => {
    render(<DrawingBoard />);
    const power = screen.getByLabelText(/installed power/i) as HTMLInputElement;
    fireEvent.change(power, { target: { value: "4321" } });
    for (const tab of TAB_NAMES) openTab(tab);
    expect((screen.getByLabelText(/installed power/i) as HTMLInputElement).value).toBe("4321");
    expect(screen.getByLabelText(/installed power/i)).toBe(power);
  });

  it("redraws the ship at once when another tab changes the arrangement", () => {
    render(<DrawingBoard />);
    const before = fittings();
    openTab("Arrangement");
    fireEvent.click(screen.getAllByRole("button", { name: /^Remove / })[0]!);
    expect(fittings()).toBe(before - 1);
    openTab("History and files");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(fittings()).toBe(before);
  });

  it("lets every tab use the plan tools without leaving it", async () => {
    render(<DrawingBoard />);
    openTab("Analysis");
    await armMove();
    expect(screen.getByTestId("plan-click-layer")).toBeTruthy();
  });

  it("gives the ship view and the tab pane their own scroll containers on wide layouts", () => {
    render(<DrawingBoard />);
    const pane = screen.getByTestId("tab-pane");
    expect(pane.className).toMatch(/lg:overflow-y-auto/);
    expect(shipView().className).toMatch(/lg:overflow-y-auto/);
    expect(pane.contains(shipView())).toBe(false);
    expect(screen.getByTestId("ship-workspace").className).toMatch(/lg:overflow-hidden/);
  });
});

describe("narrow layouts", () => {
  it("folds the ship view away and back without unmounting it", () => {
    render(<DrawingBoard />);
    const drawing = plan();
    const toggle = screen.getByRole("button", { name: "Hide ship view" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const body = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(body.contains(drawing)).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("Show ship view");
    // Hidden on narrow screens only; wide layouts always show it.
    expect(body.className).toMatch(/(^| )hidden( |$)/);
    expect(body.className).toMatch(/lg:block/);
    expect(drawing.isConnected).toBe(true);
    fireEvent.click(toggle);
    expect(body.className).not.toMatch(/(^| )hidden( |$)/);
    expect(plan()).toBe(drawing);
  });
});

describe("resizable divider", () => {
  const divider = () => screen.getByRole("separator", { name: "Resize ship view" });
  const share = () => Number(divider().getAttribute("aria-valuenow"));

  it("starts at the default share and is keyboard focusable", () => {
    render(<DrawingBoard />);
    expect(share()).toBe(SPLIT_DEFAULT);
    divider().focus();
    expect(document.activeElement).toBe(divider());
    expect(divider().getAttribute("aria-controls")).toBe(
      screen.getByTestId("ship-view").getAttribute("id"),
    );
  });

  it("moves with the arrow keys, clamps at Home/End, resets on Enter, and remembers the width", () => {
    render(<DrawingBoard />);
    fireEvent.keyDown(divider(), { key: "ArrowRight" });
    expect(share()).toBe(SPLIT_DEFAULT + 2);
    fireEvent.keyDown(divider(), { key: "ArrowLeft" });
    fireEvent.keyDown(divider(), { key: "ArrowLeft" });
    expect(share()).toBe(SPLIT_DEFAULT - 2);
    expect(localStorage.getItem(SPLIT_STORAGE_KEY)).toBe(String(SPLIT_DEFAULT - 2));
    fireEvent.keyDown(divider(), { key: "End" });
    fireEvent.keyDown(divider(), { key: "ArrowRight" });
    expect(share()).toBe(SPLIT_MAX);
    fireEvent.keyDown(divider(), { key: "Home" });
    expect(share()).toBe(SPLIT_MIN);
    cleanup();
    render(<DrawingBoard />);
    expect(share()).toBe(SPLIT_MIN);
    fireEvent.keyDown(divider(), { key: "Enter" });
    expect(share()).toBe(SPLIT_DEFAULT);
  });

  it("reads only usable stored widths", () => {
    expect(readStoredSplit()).toBe(SPLIT_DEFAULT);
    localStorage.setItem(SPLIT_STORAGE_KEY, "nonsense");
    expect(readStoredSplit()).toBe(SPLIT_DEFAULT);
    localStorage.setItem(SPLIT_STORAGE_KEY, "95");
    expect(readStoredSplit()).toBe(SPLIT_MAX);
    localStorage.setItem(SPLIT_STORAGE_KEY, "45");
    expect(readStoredSplit()).toBe(45);
    localStorage.setItem(SPLIT_STORAGE_KEY, "12");
    expect(readStoredSplit()).toBe(SPLIT_MIN);
  });

  it("defaults wider than the original 40%, but keeps a width the player already chose", () => {
    expect(SPLIT_DEFAULT).toBeGreaterThan(40);
    render(<DrawingBoard />);
    expect(share()).toBe(SPLIT_DEFAULT);
    cleanup();
    localStorage.setItem(SPLIT_STORAGE_KEY, "40");
    render(<DrawingBoard />);
    expect(share()).toBe(40);
    expect(localStorage.getItem(SPLIT_STORAGE_KEY)).toBe("40");
  });

  it("caps the ship pane so the tab pane keeps its minimum width", () => {
    render(<DrawingBoard />);
    const workspace = screen.getByTestId("ship-workspace");
    expect(workspace.style.getPropertyValue("--tab-pane-min")).toBe(TAB_PANE_MIN);
    expect(workspace.style.getPropertyValue("--ship-pane")).toBe(`${SPLIT_DEFAULT}%`);
    expect(workspace.className).toContain("min(var(--ship-pane),calc(100%_-_var(--tab-pane-min)");
  });
});

describe("ship view states", () => {
  const content = loadDrawingBoardContent();
  const ref = content.references[0]!;
  const refView = buildWorkshopView(ref.draft, content.environmentFor(ref.month));
  // The plan draws from the draft; the compiled view only supplies gun arcs, so the reference's view serves.
  const drawFor = (draft: DesignDraft) =>
    render(
      <HullPlanPanel
        draft={draft}
        content={content}
        view={refView}
        month={ref.month}
        edit={() => {}}
      />,
    );

  it("draws a bare hull when nothing is placed yet", () => {
    drawFor({ ...ref.draft, placements: [] });
    expect(screen.getByRole("img", { name: /Top-down plan.* 0 fittings placed/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Side profile/ })).toBeTruthy();
  });

  it("still draws an incomplete design whose hull form is not chosen yet", () => {
    drawFor({ ...ref.draft, hull: { ...ref.draft.hull, hullFormId: "NOT_A_FORM" } });
    expect(screen.getByRole("img", { name: /Top-down plan/ })).toBeTruthy();
  });

  it("contains a drawing failure to the ship view and keeps the tabs usable", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const Broken = (): never => {
      throw new Error("bad geometry");
    };
    render(
      <ShipWorkspace
        ship={
          <ShipViewBoundary resetKey={1}>
            <Broken />
          </ShipViewBoundary>
        }
      >
        <button type="button">Tab content</button>
      </ShipWorkspace>,
    );
    expect(within(shipView()).getByRole("alert").textContent).toMatch(/could not be shown/);
    expect(screen.getByRole("button", { name: "Tab content" })).toBeTruthy();
    quiet.mockRestore();
  });

  it("redraws after a failure on retry or when the design changes", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    let fail = true;
    const Flaky = () => {
      if (fail) throw new Error("bad geometry");
      return <p>drawn</p>;
    };
    function Harness() {
      const [key, setKey] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setKey((k) => k + 1)}>
            Change design
          </button>
          <ShipViewBoundary resetKey={key}>
            <Flaky />
          </ShipViewBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Redraw ship" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Redraw ship" }));
    expect(screen.getByText("drawn")).toBeTruthy();
    fail = true;
    fireEvent.click(screen.getByRole("button", { name: "Change design" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Change design" }));
    expect(screen.getByText("drawn")).toBeTruthy();
    quiet.mockRestore();
  });
});
