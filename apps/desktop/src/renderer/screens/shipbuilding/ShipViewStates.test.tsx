import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useState } from "react";
import { buildWorkshopView, type DesignDraft } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../components/design-workspace/content.js";
import { HullPlanPanel } from "../../components/design-workspace/panels/index.js";
import { ShipViewBoundary } from "../../components/design-workspace/workspace/ShipViewBoundary.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const refView = buildWorkshopView(ref.draft, content.environmentFor(ref.month));
const drawFor = (draft: DesignDraft, shipView: "top" | "side" | "iso" = "top") =>
  render(
    <HullPlanPanel
      draft={draft}
      content={content}
      view={refView}
      month={ref.month}
      edit={() => {}}
      shipView={shipView}
    />,
  );

describe("ship view states", () => {
  it("draws a bare hull when nothing is placed yet, in every view", () => {
    const bare = { ...ref.draft, placements: [] };
    const top = drawFor(bare);
    expect(screen.getByRole("img", { name: /Top-down plan.* 0 fittings placed/ })).toBeTruthy();
    top.unmount();
    const side = drawFor(bare, "side");
    expect(screen.getByRole("img", { name: /Side profile/ })).toBeTruthy();
    side.unmount();
    drawFor(bare, "iso");
    expect(screen.getByTestId("anatomy-ship")).toBeTruthy();
  });

  it("still draws an incomplete design whose hull form is not chosen yet", () => {
    drawFor({ ...ref.draft, hull: { ...ref.draft.hull, hullFormId: "NOT_A_FORM" } });
    expect(screen.getByRole("img", { name: /Top-down plan/ })).toBeTruthy();
  });

  it("contains a drawing failure to the ship view", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const Broken = (): never => {
      throw new Error("bad geometry");
    };
    render(
      <>
        <ShipViewBoundary resetKey={1}>
          <Broken />
        </ShipViewBoundary>
        <button type="button">Other control</button>
      </>,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/could not be shown/);
    expect(screen.getByRole("button", { name: "Other control" })).toBeTruthy();
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
