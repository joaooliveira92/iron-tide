import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { HullPlanPanel } from "./HullPlanPanel.js";
import { content, reference, view } from "./test-fixtures.js";

afterEach(cleanup);

const draw = () =>
  render(
    <HullPlanPanel
      draft={reference.draft}
      content={content}
      view={view}
      month={reference.month}
      edit={() => {}}
      findings={[]}
    />,
  );

describe("HullPlanPanel", () => {
  it("is the hull plan panel: a described plan, a drawing key and a schematic note", () => {
    draw();
    const panel = screen.getByRole("region", { name: "Hull plan" });
    expect(within(panel).getByRole("img", { name: /^Top-down plan/ })).toBeTruthy();
    expect(within(panel).queryByRole("img", { name: /^Side profile/ })).toBeNull();
    expect(panel.textContent).toMatch(/Schematic, not a lines plan\./);
    expect(within(panel).getByRole("button", { name: "Drawing key" })).toBeTruthy();
  });

  it("draws one view at a time: top, side or isometric", () => {
    const { rerender } = draw();
    const show = (shipView: "top" | "side" | "iso") =>
      rerender(
        <HullPlanPanel
          draft={reference.draft}
          content={content}
          view={view}
          month={reference.month}
          edit={() => {}}
          findings={[]}
          shipView={shipView}
        />,
      );
    show("side");
    expect(screen.getByRole("img", { name: /^Side profile/ })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /^Top-down plan/ })).toBeNull();
    expect(screen.queryByTestId("anatomy-ship")).toBeNull();
    show("iso");
    expect(screen.getByTestId("anatomy-ship")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /^Side profile/ })).toBeNull();
    expect(screen.queryByRole("img", { name: /^Top-down plan/ })).toBeNull();
    show("top");
    expect(screen.getByRole("img", { name: /^Top-down plan/ })).toBeTruthy();
    expect(screen.queryByTestId("anatomy-ship")).toBeNull();
  });

  it("lights the highlighted fitting in the isometric drawing and turns it to the port side", () => {
    const fitting = reference.draft.placements[0]!.instanceId;
    const { rerender } = draw();
    const show = (isoSide: "starboard" | "port") =>
      rerender(
        <HullPlanPanel
          draft={reference.draft}
          content={content}
          view={view}
          month={reference.month}
          edit={() => {}}
          findings={[]}
          shipView="iso"
          isoSide={isoSide}
          highlightId={fitting}
        />,
      );
    show("starboard");
    expect(screen.getByTestId("anatomy-ship").getAttribute("data-azimuth")).toBe("135");
    expect(
      screen
        .getByTestId("anatomy-ship")
        .querySelector(`[data-part="${fitting}"]`)
        ?.hasAttribute("data-lit"),
    ).toBe(true);
    show("port");
    expect(screen.getByTestId("anatomy-ship").getAttribute("data-azimuth")).toBe("225");
  });

  it("drops its own heading inside the workspace, where the view toolbar names the drawing", () => {
    const { rerender } = draw();
    expect(screen.getByText("Hull plan")).toBeTruthy();
    rerender(
      <HullPlanPanel
        draft={reference.draft}
        content={content}
        view={view}
        month={reference.month}
        edit={() => {}}
        findings={[]}
        shipView="top"
      />,
    );
    expect(screen.queryByText("Hull plan")).toBeNull();
    expect(screen.getByRole("region", { name: "Hull plan" })).toBeTruthy();
  });

  it("numbers the section labels on the compartments view only", () => {
    const { rerender } = draw();
    const panel = () => screen.getByRole("region", { name: "Hull plan" });
    const strip = () => within(panel()).getByTestId("section-labels");
    expect(strip().textContent).not.toMatch(/^1/);
    rerender(
      <HullPlanPanel
        draft={reference.draft}
        content={content}
        view={view}
        month={reference.month}
        edit={() => {}}
        findings={[]}
        shipView="top"
        overlays={new Set(["compartments"])}
      />,
    );
    expect(strip().textContent).toMatch(/1.*2.*3.*4.*5.*6.*7.*8/);
  });

  it("starts with no plan tool active, explaining how to use one", () => {
    draw();
    const panel = screen.getByRole("region", { name: "Hull plan" });
    expect(screen.queryByTestId("plan-click-layer")).toBeNull();
    expect(within(panel).getByRole("status").textContent).toMatch(/Right-click the plan/);
  });

  it("draws and hides the gun arcs with the show-arcs checkbox", () => {
    draw();
    const panel = screen.getByRole("region", { name: "Hull plan" });
    const plan = within(panel).getByRole("img", { name: /^Top-down plan/ });
    const arcs = plan.querySelectorAll("[data-arc]").length;
    const checkbox = within(panel).getByLabelText("Show gun arcs");
    fireEvent.click(checkbox);
    expect(plan.querySelectorAll("[data-arc]")).toHaveLength(0);
    fireEvent.click(checkbox);
    expect(plan.querySelectorAll("[data-arc]")).toHaveLength(arcs);
  });
});
