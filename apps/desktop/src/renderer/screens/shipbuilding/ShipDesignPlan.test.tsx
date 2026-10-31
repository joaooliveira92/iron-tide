import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { loadDrawingBoardContent } from "../../components/design-workspace/content.js";
import {
  PLAN_H,
  PLAN_MID,
  PLAN_W,
  stationX,
} from "../../components/design-workspace/panels/hull-plan/geometry.js";
import { ShipbuildingWorkspace } from "./ShipbuildingWorkspace.js";
import { armMove, armPlace, historyEntries, planMenu } from "./test-helpers.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const placeable = content.components.find(
  (c) =>
    c.introduction.fromMonth <= "1895-06" &&
    (c.allowedZones === undefined || c.allowedZones.includes("CENTRAL_MACHINERY")),
)!;
const sized = (svg: Element) => {
  svg.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: PLAN_W,
      height: PLAN_H,
      right: PLAN_W,
      bottom: PLAN_H,
    }) as DOMRect;
};
const panel = () => screen.getByRole("region", { name: "Hull plan" });
const plan = () => within(panel()).getByRole("img", { name: /^Top-down plan/ });
const notice = () => within(panel()).getByRole("status").textContent;

describe("plan tools on the top view", () => {
  it("has no Place or Move buttons: the tools are reached from the plan's context menu", () => {
    render(<ShipbuildingWorkspace />);
    expect(screen.queryByRole("button", { name: "Place on plan" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move on plan" })).toBeNull();
  });

  it("is off by default: no click layer until a tool is chosen", () => {
    render(<ShipbuildingWorkspace />);
    expect(screen.queryByTestId("plan-click-layer")).toBeNull();
  });

  it("places a fitting by clicking the plan, with the zone and station from the point", async () => {
    render(<ShipbuildingWorkspace />);
    sized(plan());
    await armPlace(placeable);
    fireEvent.click(screen.getByTestId("plan-click-layer"), {
      clientX: stationX(300),
      clientY: PLAN_MID,
    });
    expect(notice()).toMatch(/Placed .* at 300‰/);
    expect(historyEntries()).toMatch(/Add .* to central machinery/);
  });

  it("moves a fitting with keyboard-reachable buttons, one undoable edit each", async () => {
    render(<ShipbuildingWorkspace />);
    await armMove("last");
    expect(screen.getByTestId("plan-selected-ring")).toBeTruthy();
    fireEvent.click(
      within(panel()).getByRole("button", { name: /Move 10 permille toward the stern/ }),
    );
    expect(notice()).toMatch(/10‰ toward the stern/);
    expect(historyEntries()).toMatch(/Move .* at \d+‰/);
  });

  it("offers to move the fitting under a right-click directly", async () => {
    render(<ShipbuildingWorkspace />);
    sized(plan());
    const dot = plan().querySelector<SVGElement>("[data-fitting]")!;
    fireEvent.contextMenu(screen.getByRole("group", { name: /^Ship plan/ }), {
      clientX: Number(dot.getAttribute("cx")),
      clientY: Number(dot.getAttribute("cy")),
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move this fitting" }));
    expect(screen.getByTestId("plan-selected-ring")).toBeTruthy();
  });

  it("picks a fitting by clicking it, and drags a fitting to a new station as one edit", async () => {
    render(<ShipbuildingWorkspace />);
    const svg = plan();
    sized(svg);
    await armMove("last");
    const layer = screen.getByTestId("plan-click-layer");
    const target = () => {
      const d = svg.querySelector<SVGElement>("[data-fitting]")!;
      return {
        id: d.getAttribute("data-fitting")!,
        x: Number(d.getAttribute("cx")),
        y: Number(d.getAttribute("cy")),
      };
    };
    const first = target();
    fireEvent.click(layer, { clientX: first.x, clientY: first.y });
    expect(notice()).toMatch(new RegExp(`^Picked ${first.id}`));
    const toX = first.x + (stationX(20) - stationX(0));
    fireEvent.pointerDown(layer, { clientX: first.x, clientY: first.y, pointerId: 1 });
    fireEvent.pointerMove(layer, { clientX: toX, clientY: first.y, pointerId: 1 });
    expect(screen.getByTestId("plan-drag-ghost")).toBeTruthy();
    fireEvent.pointerUp(layer, { clientX: toX, clientY: first.y, pointerId: 1 });
    fireEvent.click(layer, { clientX: toX, clientY: first.y });
    expect(screen.queryByTestId("plan-drag-ghost")).toBeNull();
    expect(notice()).toMatch(new RegExp(`^Moved ${first.id} to \\d+‰`));
    expect(historyEntries().match(/Move .* at \d+‰/g)).toHaveLength(1);
  });

  it("treats a shaky click on a fitting as a click, not a drag", async () => {
    render(<ShipbuildingWorkspace />);
    const svg = plan();
    sized(svg);
    await armMove("last");
    const layer = screen.getByTestId("plan-click-layer");
    const d = svg.querySelector<SVGElement>("[data-fitting]")!;
    const x = Number(d.getAttribute("cx"));
    const y = Number(d.getAttribute("cy"));
    fireEvent.pointerDown(layer, { clientX: x, clientY: y, pointerId: 1 });
    fireEvent.pointerMove(layer, { clientX: x + 2, clientY: y + 1, pointerId: 1 });
    expect(screen.queryByTestId("plan-drag-ghost")).toBeNull();
    fireEvent.pointerUp(layer, { clientX: x + 2, clientY: y + 1, pointerId: 1 });
    fireEvent.click(layer, { clientX: x + 2, clientY: y + 1 });
    expect(notice()).toMatch(/^Picked /);
  });

  it("auto-places a chosen component where the ship stays most level, as one edit", async () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.contextMenu(screen.getByRole("group", { name: /^Ship plan/ }));
    const idle = await screen.findByRole("menuitem", { name: "Auto-place" });
    expect(idle.getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(idle, { key: "Escape" });
    await armPlace(content.components.find((c) => c.id === "pumps_damage_control")!);
    fireEvent.contextMenu(screen.getByRole("group", { name: /^Ship plan/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Auto-place \S/ }));
    expect(notice()).toMatch(/^Placed .* at \d+‰, where the ship stays most level/);
    expect(historyEntries().match(/Add /g)).toHaveLength(1);
  });

  it("switches between the tools from the context menu, a switch clears the last notice, and Stop turns it off", async () => {
    render(<ShipbuildingWorkspace />);
    sized(plan());
    await armPlace(placeable);
    expect(notice()).toMatch(/^Click the plan to place it/);
    await armMove("last");
    expect(notice()).toMatch(/^Click a fitting on the plan/);
    await planMenu("Stop moving");
    expect(screen.queryByTestId("plan-click-layer")).toBeNull();
  });
});
