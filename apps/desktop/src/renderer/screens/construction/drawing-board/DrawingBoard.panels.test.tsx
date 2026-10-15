import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { loadDrawingBoardContent } from "../../../components/design-workspace/content.js";
import { DrawingBoard } from "./DrawingBoard.js";
import {
  PLAN_H,
  PLAN_MID,
  PLAN_W,
  stationX,
} from "../../../components/design-workspace/panels/hull-plan/geometry.js";
import { chooseOption, openPlanTool, openTab, region } from "./test-helpers.js";

afterEach(cleanup);

/** The fittings' remove buttons, by their aria-label: a whole-board role-and-name query is slow in jsdom on a battleship. */
const removeButtons = () => document.querySelectorAll('button[aria-label^="Remove "]').length;
/** Label queries are scoped to `scope` when given: whole-board label lookups are slow in jsdom on a battleship. */
const commit = (label: string | RegExp, value: string, scope: HTMLElement = document.body) => {
  const input = within(scope).getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};
/** The ship-building parity panels (SB-2): brief, yards, armour, batteries, plan tools, plan and profile drawings. */
describe("DrawingBoard panels", () => {
  it("edits armour regions: size, plate, slope, and adds a new region from the hull", () => {
    render(<DrawingBoard />);
    chooseOption("Starting design", "Majestic-like battleship (1895)");
    const protection = () => region("Protection");
    expect(within(protection()).getByText("Coverage")).toBeTruthy();
    const regionsBefore = within(protection()).getAllByRole("listitem").length;
    commit(/Length of BELT_MAIN/, "10", protection());
    openTab("History");
    expect(
      within(region("Edit history")).getByText(/Armour: set belt main \(.* 10\.0 m ×/),
    ).toBeTruthy();
    // Inclined plate: the checkbox sets cos(30 degrees).
    fireEvent.click(within(protection()).getAllByRole("checkbox")[0]!);
    openTab("History");
    expect(within(region("Edit history")).getByText(/Armour: set .*, inclined\)/)).toBeTruthy();
    // Add a region that is not yet fitted: the list grows by one.
    fireEvent.click(within(protection()).getByRole("button", { name: "Add region" }));
    expect(within(protection()).getAllByRole("listitem").length).toBe(regionsBefore + 1);
  });

  it("offers the armour materials weakest first, disabling those not yet makeable", () => {
    render(<DrawingBoard />);
    chooseOption("Starting design", "Majestic-like battleship (1895)");
    const select = within(region("Protection")).getAllByLabelText(/Material of /)[0]!;
    fireEvent.click(select);
    const options = screen.getAllByRole("option");
    const values = options.map((o) => o.getAttribute("data-value"));
    expect(values.length).toBeGreaterThan(1);
    expect(values.indexOf("wrought_iron")).toBeLessThan(values.indexOf("harvey"));
    // The 1896 battleship cannot make Krupp plate yet (technology year 1900): offered, disabled, with the reason.
    const krupp = options.find((o) => o.getAttribute("data-value") === "krupp")!;
    expect(krupp.getAttribute("aria-disabled")).toBe("true");
    expect(krupp.textContent).toMatch(/needs hc_krupp_cemented_armor/);
    const current = options.find((o) => o.getAttribute("aria-selected") === "true")!;
    expect(current.getAttribute("aria-disabled")).toBeNull();
  });

  it("groups guns into named batteries, sets the mount side, and clears a battery as one undoable step", async () => {
    render(<DrawingBoard />);
    chooseOption("Starting design", "Majestic-like battleship (1895)");
    const batteries = () => region("Batteries");
    const main = within(batteries()).getAllByRole("listitem")[0]!;
    expect(main.textContent).toMatch(/Main battery, \d+\.\d-inch/);
    expect(within(batteries()).getAllByText(/^A · /).length).toBeGreaterThan(0);
    // Set a mount to port: its badge changes and the history says so.
    // Scoped to the panel: a whole-board label query is quadratic in jsdom on a battleship's many mounts.
    const side = region("Components and arrangement").querySelector<HTMLElement>(
      '[aria-label^="Side of "]',
    )!;
    fireEvent.click(side);
    fireEvent.click(screen.getByRole("option", { name: "Port" }));
    openTab("History");
    expect(within(region("Edit history")).getByText(/ to port$/)).toBeTruthy();
    // Clear the first battery: one confirmation, one history entry, one undo restores everything.
    openTab("Arrangement");
    const before = removeButtons();
    fireEvent.click(
      within(batteries()).getAllByRole("button", { name: /^Clear Main battery/ })[0]!,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Clear battery" }));
    expect(removeButtons()).toBeLessThan(before);
    fireEvent.click(screen.getByRole("button", { name: /undo/i }));
    expect(removeButtons()).toBe(before);
  });

  describe("plan tools", () => {
    const content = loadDrawingBoardContent();
    // The destroyer's hull puts station 300 in the central machinery zone.
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

    it("places a fitting by clicking the plan, with the zone and station from the point", () => {
      render(<DrawingBoard />);
      const panel = region("Hull plan");
      sized(within(panel).getByRole("img", { name: /^Top-down plan/ }));
      fireEvent.click(screen.getByRole("button", { name: "Place on plan" }));
      // Choosing nothing first says what to do instead of failing silently.
      fireEvent.click(screen.getByTestId("plan-click-layer"), {
        clientX: stationX(300),
        clientY: PLAN_MID,
      });
      expect(within(panel).getByRole("status").textContent).toMatch(/Choose a component/);
      // The picker lives in the toolbar menu, so reopen it to choose.
      openPlanTool("Place on plan");
      chooseOption("Component to place", placeable.displayName);
      fireEvent.click(screen.getByTestId("plan-click-layer"), {
        clientX: stationX(300),
        clientY: PLAN_MID,
      });
      expect(within(panel).getByRole("status").textContent).toMatch(/Placed .* at 300‰/);
      openTab("History");
      expect(within(region("Edit history")).getByText(/Add .* to central machinery/)).toBeTruthy();
    });

    it("moves a fitting with keyboard-reachable buttons, one undoable edit each", () => {
      render(<DrawingBoard />);
      const panel = region("Hull plan");
      fireEvent.click(screen.getByRole("button", { name: "Move on plan" }));
      fireEvent.click(screen.getByLabelText("Fitting to move"));
      fireEvent.click(screen.getAllByRole("option")[1]!);
      expect(screen.getByTestId("plan-selected-ring")).toBeTruthy();
      fireEvent.click(
        within(panel).getByRole("button", { name: /Move 10 permille toward the stern/ }),
      );
      expect(within(panel).getByRole("status").textContent).toMatch(/10‰ toward the stern/);
      openTab("History");
      expect(within(region("Edit history")).getByText(/Move .* at \d+‰/)).toBeTruthy();
    });

    it("picks a fitting by clicking it, and drags a fitting to a new station as one edit", () => {
      render(<DrawingBoard />);
      const panel = region("Hull plan");
      const svg = within(panel).getByRole("img", { name: /^Top-down plan/ });
      sized(svg);
      fireEvent.click(screen.getByRole("button", { name: "Move on plan" }));
      const layer = screen.getByTestId("plan-click-layer");
      const dot = svg.querySelector<SVGElement>("[data-fitting]");
      const target = () => {
        const d = svg.querySelector<SVGElement>("[data-fitting]")!;
        return {
          id: d.getAttribute("data-fitting")!,
          x: Number(d.getAttribute("cx")),
          y: Number(d.getAttribute("cy")),
        };
      };
      expect(dot).not.toBeNull();
      const first = target();
      // Click on it: it becomes the fitting to move.
      fireEvent.click(layer, { clientX: first.x, clientY: first.y });
      expect(within(panel).getByRole("status").textContent).toMatch(
        new RegExp(`^Picked ${first.id}`),
      );
      // Drag it 20 permille sternward along its own line (inside its zone): one move edit, a ghost while dragging.
      const toX = first.x + (stationX(20) - stationX(0));
      fireEvent.pointerDown(layer, { clientX: first.x, clientY: first.y, pointerId: 1 });
      fireEvent.pointerMove(layer, { clientX: toX, clientY: first.y, pointerId: 1 });
      expect(screen.getByTestId("plan-drag-ghost")).toBeTruthy();
      fireEvent.pointerUp(layer, { clientX: toX, clientY: first.y, pointerId: 1 });
      fireEvent.click(layer, { clientX: toX, clientY: first.y }); // the drop's own click must not act again
      expect(screen.queryByTestId("plan-drag-ghost")).toBeNull();
      expect(within(panel).getByRole("status").textContent).toMatch(
        new RegExp(`^Moved ${first.id} to \\d+‰`),
      );
      openTab("History");
      expect(within(region("Edit history")).getAllByText(/Move .* at \d+‰/)).toHaveLength(1);
    });

    it("auto-places a chosen component where the ship stays most level, as one edit", () => {
      render(<DrawingBoard />);
      const panel = region("Hull plan");
      fireEvent.click(screen.getByRole("button", { name: "Place on plan" }));
      openPlanTool("Place on plan");
      const auto = () => screen.getByRole("button", { name: "Auto-place" }) as HTMLButtonElement;
      expect(auto().disabled).toBe(true);
      chooseOption(
        "Component to place",
        content.components.find((c) => c.id === "pumps_damage_control")!.displayName,
      );
      expect(auto().disabled).toBe(false);
      fireEvent.click(auto());
      expect(within(panel).getByRole("status").textContent).toMatch(
        /^Placed .* at \d+‰, where the ship stays most level/,
      );
      openTab("History");
      expect(within(region("Edit history")).getAllByText(/^.*Add /)).toHaveLength(1);
    });

    it("treats a shaky click on a fitting as a click, not a drag", () => {
      render(<DrawingBoard />);
      const panel = region("Hull plan");
      const svg = within(panel).getByRole("img", { name: /^Top-down plan/ });
      sized(svg);
      fireEvent.click(screen.getByRole("button", { name: "Move on plan" }));
      const layer = screen.getByTestId("plan-click-layer");
      const d = svg.querySelector<SVGElement>("[data-fitting]")!;
      const x = Number(d.getAttribute("cx"));
      const y = Number(d.getAttribute("cy"));
      fireEvent.pointerDown(layer, { clientX: x, clientY: y, pointerId: 1 });
      fireEvent.pointerMove(layer, { clientX: x + 2, clientY: y + 1, pointerId: 1 });
      expect(screen.queryByTestId("plan-drag-ghost")).toBeNull();
      fireEvent.pointerUp(layer, { clientX: x + 2, clientY: y + 1, pointerId: 1 });
      fireEvent.click(layer, { clientX: x + 2, clientY: y + 1 });
      expect(within(panel).getByRole("status").textContent).toMatch(/^Picked /);
    });

    it("says what is missing instead of failing silently, and adds nothing", () => {
      render(<DrawingBoard />);
      const panel = region("Hull plan");
      sized(within(panel).getByRole("img", { name: /^Top-down plan/ }));
      fireEvent.click(screen.getByRole("button", { name: "Move on plan" }));
      fireEvent.click(screen.getByTestId("plan-click-layer"), {
        clientX: stationX(300),
        clientY: PLAN_MID,
      });
      expect(within(panel).getByRole("status").textContent).toMatch(
        /Choose a fitting to move first/,
      );
      openTab("History");
      expect(within(region("Edit history")).queryByText(/Move |Add /)).toBeNull();
    });

    it("is off by default: no click layer until a tool is chosen", () => {
      render(<DrawingBoard />);
      region("Hull plan");
      expect(screen.queryByTestId("plan-click-layer")).toBeNull();
    });

    it("keeps the plan display controls in the toolbar, not the panel", () => {
      render(<DrawingBoard />);
      const toolbar = screen.getByRole("group", { name: "Design toolbar" });
      const panel = region("Hull plan");
      expect(within(panel).queryByLabelText("Show gun arcs")).toBeNull();
      expect(within(panel).queryByLabelText("Findings to show")).toBeNull();
      // The toolbar's display popover holds them, and its checkbox drives the drawing.
      fireEvent.click(within(toolbar).getByRole("button", { name: "Plan display" }));
      const display = screen.getByRole("dialog", { name: "Plan display" });
      expect(within(display).getByLabelText("Findings to show")).toBeTruthy();
      const arcs = () => panel.querySelectorAll("[data-arc]").length;
      expect(arcs()).toBeGreaterThan(0);
      fireEvent.click(within(display).getByLabelText("Show gun arcs"));
      expect(arcs()).toBe(0);
    });

    it("switches from the board toolbar, one mode at a time, and a switch clears the last notice", () => {
      render(<DrawingBoard />);
      const panel = region("Hull plan");
      const toolbar = screen.getByRole("group", { name: "Design toolbar" });
      const place = within(toolbar).getByRole("button", { name: "Place on plan" });
      const move = within(toolbar).getByRole("button", { name: "Move on plan" });
      expect(within(panel).queryByRole("button", { name: /on plan$/ })).toBeNull();
      sized(within(panel).getByRole("img", { name: /^Top-down plan/ }));
      fireEvent.click(place);
      fireEvent.click(screen.getByTestId("plan-click-layer"), {
        clientX: stationX(300),
        clientY: PLAN_MID,
      });
      expect(within(panel).getByRole("status").textContent).toMatch(/Choose a component/);
      fireEvent.click(move);
      expect(place.getAttribute("aria-pressed")).toBe("false");
      expect(move.getAttribute("aria-pressed")).toBe("true");
      expect(within(panel).getByRole("status").textContent).toMatch(/^Click a fitting on the plan/);
      fireEvent.click(move);
      expect(move.getAttribute("aria-pressed")).toBe("false");
      expect(screen.queryByTestId("plan-click-layer")).toBeNull();
    });
  });

  it("shows the class code and lets the player declare the ship type, speed and range", () => {
    render(<DrawingBoard />);
    const brief = region("Design brief");
    expect(within(brief).getByLabelText(/^Class code DD/)).toBeTruthy();
    commit(/Required range/, "4321");
    expect((screen.getByLabelText(/Required range/) as HTMLInputElement).value).toBe("4321");
    chooseOption("Ship type", "CL · Protected cruiser");
    expect(screen.getByLabelText("Ship type").textContent).toContain("Protected cruiser");
    // Declaring a type the destroyer does not qualify for is blocked by DESIGN-22, and the history says why.
    openTab("History");
    expect(within(region("Edit history")).getByText(/Brief: category → CL/)).toBeTruthy();
  });

  it("gives every ship type in the brief an icon and a description, without changing its name", () => {
    render(<DrawingBoard />);
    region("Design brief");
    fireEvent.click(screen.getByLabelText("Ship type"));
    const options = screen.getAllByRole("option");
    // The six opening types (B, CA, CL, DD, KE, AMC); BB and the later types are not offered (ADR-0088).
    expect(options).toHaveLength(6);
    expect(screen.queryByRole("option", { name: /Dreadnought|Battlecruiser/ })).toBeNull();
    for (const option of options) {
      expect(option.querySelector("svg")).not.toBeNull();
      expect(option.getAttribute("aria-describedby")).toBeTruthy();
    }
    const protectedCruiser = screen.getByRole("option", { name: "CL · Protected cruiser" });
    expect(protectedCruiser.textContent).toMatch(/trade protection/);
  });

  it("lists the shipyards in the forecast with exactly one yard that builds it", () => {
    render(<DrawingBoard />);
    openTab("Analysis");
    const forecast = region("Cost and construction forecast");
    const yards = within(forecast).getByRole("list", { name: "Shipyards" });
    const rows = within(yards).getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => /Builds here/.test(r.textContent ?? ""))).toHaveLength(1);
  });

  it("draws a distinct, described plan and profile that agree on the funnels", () => {
    render(<DrawingBoard />);
    const panel = region("Hull plan");
    const plan = within(panel).getByRole("img", { name: /^Top-down plan/ });
    const profile = within(panel).getByRole("img", { name: /^Side profile/ });
    expect(plan).not.toBe(profile);
    for (const view of [plan, profile]) {
      expect(view.getAttribute("aria-label")).toMatch(/schematic/);
      expect(view.getAttribute("aria-label")).toMatch(/ram bow|spoon bow|plumb bow/);
    }
    const planFunnels = plan.querySelectorAll('[data-testid="hull-funnel"]').length;
    const profileFunnels = profile.querySelectorAll('[data-testid="profile-funnel"]').length;
    expect(profileFunnels).toBe(planFunnels);
    const stated = /(\d+) funnels?|no funnels/.exec(plan.getAttribute("aria-label") ?? "");
    expect(stated).not.toBeNull();
    expect(stated![1] === undefined ? 0 : Number(stated![1])).toBe(planFunnels);
    expect(profile.querySelector('[data-testid="profile-hull"]')).not.toBeNull();
  });

  it("explains the drawing through keyboard-reachable legend chips that open a popover", async () => {
    render(<DrawingBoard />);
    const panel = region("Hull plan");
    const legend = within(panel).getByRole("group", { name: "Drawing legend" });
    const bow = within(legend).getByRole("button", { name: /^(Ram|Spoon|Plumb) bow \(Bow:/ });
    expect(bow.tagName).toBe("BUTTON");
    fireEvent.click(bow);
    const dialog = await screen.findByText(/drawing choice per hull form/i);
    expect(dialog).toBeTruthy();
    expect(screen.getByText("Drawing convention")).toBeTruthy();
  });
});
