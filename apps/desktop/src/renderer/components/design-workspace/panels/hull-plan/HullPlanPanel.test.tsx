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
  it("is the hull plan panel: a described plan and profile, a legend and a schematic note", () => {
    draw();
    const panel = screen.getByRole("region", { name: "Hull plan" });
    expect(within(panel).getByRole("img", { name: /^Top-down plan/ })).toBeTruthy();
    expect(within(panel).getByRole("img", { name: /^Side profile/ })).toBeTruthy();
    expect(within(panel).getByRole("group", { name: "Drawing legend" })).toBeTruthy();
    expect(panel.textContent).toMatch(/Schematic, not a lines plan\./);
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
        shipView="compartments"
      />,
    );
    expect(strip().textContent).toMatch(/1.*2.*3.*4.*5.*6.*7.*8/);
  });

  it("starts with no plan tool active, explaining how to use one", () => {
    draw();
    const panel = screen.getByRole("region", { name: "Hull plan" });
    expect(screen.queryByTestId("plan-click-layer")).toBeNull();
    expect(within(panel).getByRole("status").textContent).toMatch(/Use the Place and Move tools/);
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
