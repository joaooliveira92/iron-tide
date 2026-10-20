import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { batteryCards } from "../../../components/design-workspace/batteryView.js";
import { loadDrawingBoardContent } from "../../../components/design-workspace/content.js";
import { DrawingBoard } from "./DrawingBoard.js";
import { armMove, chooseOption, openTab } from "./test-helpers.js";
import {
  SECTION_IDS,
  SECTIONS,
} from "../../../components/design-workspace/panels/hull-plan/sections.js";
import {
  boardFindings,
  entityWarns,
  findingsFor,
} from "../../../components/design-workspace/validation/boardFindings.js";
import {
  fittingFacts,
  type EntityContext,
} from "../../../components/design-workspace/selection/facts.js";
import { destinationFor } from "../../../components/design-workspace/selection/navigation.js";
import { SelectionInspector } from "../../../components/design-workspace/selection/SelectionInspector.js";
import { createSelectionStore } from "../../../components/design-workspace/selection/store.js";
import { ShipSelectionProvider } from "../../../components/design-workspace/selection/useShipSelection.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const view = buildWorkshopView(ref.draft, content.environmentFor(ref.month));
const form = content.hullForms.find((f) => f.id === ref.draft.hull.hullFormId)!;
const ctx: EntityContext = {
  draft: ref.draft,
  view,
  content,
  zones: form.zones,
  batteries: batteryCards(view, ref.draft),
  findings: boardFindings(view, ref.draft, batteryCards(view, ref.draft)),
};

const strip = () => screen.getByRole("group", { name: "Hull sections" });
const label = (name: string) => within(strip()).getByRole("button", { name });
const fittings = () => screen.getByRole("toolbar", { name: "Fittings on the plan" });
const target = (id: string) => fittings().querySelector<SVGGElement>(`[data-target="${id}"]`)!;
const inspector = () => screen.queryByTestId("selection-inspector");
const pressed = () =>
  within(strip())
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") === "true")
    .map((b) => b.getAttribute("aria-label"));
const selectedZone = () =>
  document.querySelector("[data-testid='section-selected']")?.getAttribute("data-zone");

describe("selection store", () => {
  it("selects, replaces, clears, links and prunes without touching anything else", () => {
    const store = createSelectionStore();
    let renders = 0;
    store.subscribe(() => renders++);
    store.select({ kind: "section", id: "forecastle" });
    store.select({ kind: "section", id: "forecastle" });
    expect(renders).toBe(1);
    store.select({ kind: "fitting", instanceId: "gun_12pdr" });
    expect(store.get().selected).toEqual({ kind: "fitting", instanceId: "gun_12pdr" });
    store.setLinked([{ kind: "machinery-room", index: 0 }]);
    store.prune((e) => e.kind !== "fitting");
    expect(store.get().selected).toBeNull();
    expect(store.get().linked).toHaveLength(1);
    store.clear();
    expect(renders).toBe(4);
  });
});

describe("selecting sections", () => {
  it("pins each of the eight sections in turn, one at a time, with the inspector following", () => {
    render(<DrawingBoard />);
    for (const id of SECTION_IDS) {
      const name = SECTIONS[id].name;
      fireEvent.click(label(name));
      expect(pressed()).toEqual([name]);
      expect(selectedZone()).toBe(SECTIONS[id].zoneId);
      expect(within(inspector()!).getByRole("heading", { name })).toBeTruthy();
    }
  });

  it("stays pinned after the pointer leaves and across every tab", () => {
    render(<DrawingBoard />);
    const drawing = screen.getByRole("img", { name: /Top-down plan/ });
    fireEvent.click(label("Aft magazine"));
    fireEvent.pointerLeave(label("Aft magazine"));
    fireEvent.mouseLeave(label("Aft magazine"));
    for (const tab of [
      "Arrangement",
      "Analysis",
      "Build",
      "History and files",
      "Hull and machinery",
    ]) {
      openTab(tab);
      expect(pressed()).toEqual(["Aft magazine"]);
      expect(within(inspector()!).getByRole("heading", { name: "Aft magazine" })).toBeTruthy();
      expect(screen.getByRole("img", { name: /Top-down plan/ })).toBe(drawing);
    }
  });

  it("clears with Escape from the drawing, after an open preview card has closed first", async () => {
    render(<DrawingBoard />);
    fireEvent.click(label("Forecastle"));
    fireEvent.keyDown(label("Forecastle"), { key: "Escape" });
    expect(pressed()).toEqual([]);
    expect(inspector()).toBeNull();
    expect(selectedZone()).toBeUndefined();
    // With a preview card open, Escape belongs to the card: the pin survives it.
    fireEvent.click(label("Quarterdeck"));
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => label("Aft service").focus());
    await expect
      .poll(() =>
        document.querySelector("[data-testid='section-card']")?.getAttribute("data-section"),
      )
      .toBe("aft-service");
    fireEvent.keyDown(label("Aft service"), { key: "Escape" });
    expect(pressed()).toEqual(["Quarterdeck"]);
  });

  it("clears with the inspector's close button and returns focus to the section label", () => {
    render(<DrawingBoard />);
    fireEvent.click(label("Superstructure"));
    fireEvent.click(within(inspector()!).getByRole("button", { name: "Clear selection" }));
    expect(inspector()).toBeNull();
    expect(document.activeElement).toBe(label("Superstructure"));
  });

  it("clears when another ship is loaded", () => {
    render(<DrawingBoard />);
    fireEvent.click(label("Central machinery"));
    expect(inspector()).not.toBeNull();
    const other = content.references.find((r) => r.id !== ref.id)!;
    chooseOption("Starting design", other.name);
    expect(inspector()).toBeNull();
    expect(pressed()).toEqual([]);
  });

  it("never changes the design", () => {
    render(<DrawingBoard />);
    fireEvent.click(label("Forward service"));
    fireEvent.click(target("gun_12pdr"));
    expect(screen.getByText("No edits")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("selecting fittings", () => {
  it("selects a fitting by pointer, with a persistent ring, its facts, and its arcs untouched", () => {
    render(<DrawingBoard />);
    const arcs = document.querySelectorAll("[data-arc]").length;
    fireEvent.click(target("gun_12pdr"));
    expect(target("gun_12pdr").getAttribute("aria-pressed")).toBe("true");
    expect(target("gun_12pdr").getAttribute("data-state")).toBe("selected");
    expect(fittings().querySelectorAll("[data-testid='fitting-selected-ring']")).toHaveLength(1);
    const box = inspector()!;
    expect(within(box).getByText("Selected fitting")).toBeTruthy();
    expect(within(box).getByRole("heading").textContent).toMatch(/mount /);
    expect(within(box).getByText("Secondary battery, 3.0-inch")).toBeTruthy();
    expect(within(box).getByText(/Forecastle · 40‰ · centreline/)).toBeTruthy();
    expect(within(box).getByText(/\(mag_fwd\)/)).toBeTruthy();
    expect(document.querySelectorAll("[data-arc]").length).toBe(arcs);
    // Selecting another fitting replaces it.
    fireEvent.click(target("mag_fwd"));
    expect(target("gun_12pdr").getAttribute("aria-pressed")).toBe("false");
    expect(within(inspector()!).getByText("Protection margin")).toBeTruthy();
  });

  it("is keyboard operable: one tab stop, arrows walk bow to stern, Enter and Space select", () => {
    render(<DrawingBoard />);
    const stops = [...fittings().querySelectorAll<SVGGElement>("[data-target]")];
    expect(stops.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    expect(stops[0]!.getAttribute("data-target")).toBe("gun_12pdr");
    act(() => stops[0]!.focus());
    fireEvent.keyDown(stops[0]!, { key: "ArrowRight" });
    expect(document.activeElement?.getAttribute("data-target")).toBe("mag_fwd");
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(target("mag_fwd").getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    fireEvent.keyDown(document.activeElement!, { key: " " });
    expect(target("tubes").getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(inspector()).toBeNull();
    expect(target("tubes").getAttribute("aria-label")).toMatch(/14|tube/i);
  });

  it("is unavailable while a plan tool owns the drawing, so placing and moving work as before", async () => {
    render(<DrawingBoard />);
    await armMove();
    expect(fittings().getAttribute("aria-disabled")).toBe("true");
    expect(fittings().getAttribute("class")).toContain("pointer-events-none");
    expect(
      [...fittings().querySelectorAll<SVGGElement>("[data-target]")].every(
        (t) => t.tabIndex === -1,
      ),
    ).toBe(true);
    expect(screen.getByTestId("plan-click-layer")).toBeTruthy();
  });

  it("drops a selected fitting that is removed from the design", () => {
    render(<DrawingBoard />);
    fireEvent.click(target("dyn"));
    expect(inspector()).not.toBeNull();
    openTab("Arrangement");
    fireEvent.click(screen.getByRole("button", { name: "Remove dyn" }));
    expect(inspector()).toBeNull();
  });

  it("shows the warning state when findings name the selection", () => {
    render(<DrawingBoard />);
    openTab("Arrangement");
    const station = screen.getByLabelText(/^Station of gun_12pdr /);
    fireEvent.change(station, { target: { value: "500" } });
    fireEvent.blur(station);
    fireEvent.click(target("gun_12pdr"));
    expect(fittings().querySelector("[data-testid='selection-warning']")).not.toBeNull();
    expect(
      within(inspector()!).getByRole("list", { name: "Findings for this selection" }).textContent,
    ).toMatch(/outside zone/);
    fireEvent.click(label("Forecastle"));
    expect(
      document.querySelector("[data-testid='selection-layer'] [data-testid='selection-warning']"),
    ).not.toBeNull();
  });
});

describe("contextual inspector", () => {
  const renderInspector = (
    c: EntityContext,
    select: Parameters<ReturnType<typeof createSelectionStore>["select"]>[0],
  ) => {
    const store = createSelectionStore();
    store.select(select);
    render(
      <ShipSelectionProvider store={store}>
        <SelectionInspector ctx={c} onGoTo={() => {}} onClear={() => {}} />
      </ShipSelectionProvider>,
    );
  };

  it("lists the section's fittings, machinery rooms and fuel, each fitting and room selectable", () => {
    renderInspector(ctx, { kind: "section", id: "central-machinery" });
    const box = inspector()!;
    expect(within(box).getByText("Machinery")).toBeTruthy();
    expect(within(box).getByRole("button", { name: /Room at 400‰/ })).toBeTruthy();
    expect(within(box).getByText("Not stowed in this section")).toBeTruthy();
    expect(within(box).getByText("No fittings are placed in this section.")).toBeTruthy();
    fireEvent.click(within(box).getByRole("button", { name: /Room at 400‰/ }));
    expect(within(inspector()!).getByRole("heading", { name: "Machinery room 1" })).toBeTruthy();
    expect(within(inspector()!).getByText("65%")).toBeTruthy();
  });

  it("says plainly what the design does not provide", () => {
    const bare = {
      ...view,
      compiled: { ...view.compiled, weapons: null, armour: null, arrangement: null },
    };
    renderInspector({ ...ctx, view: bare }, { kind: "fitting", instanceId: "gun_12pdr" });
    expect(
      within(inspector()!).getAllByText("Not available for this design").length,
    ).toBeGreaterThan(0);
    cleanup();
    renderInspector({ ...ctx, view: bare }, { kind: "section", id: "forecastle" });
    expect(within(inspector()!).getAllByText("Not available for this design")).toHaveLength(3);
  });

  it("reads facts from the design and compile only", () => {
    const gun = fittingFacts("gun_12pdr", ctx)!;
    expect(gun.battery?.title).toBe("Secondary battery, 3.0-inch");
    expect(gun.magazine?.instanceId).toBe("mag_fwd");
    expect(gun.section).toBe("forecastle");
    expect(fittingFacts("nope", ctx)).toBeNull();
    const magAft = { kind: "fitting", instanceId: "mag_aft" } as const;
    expect(findingsFor(magAft, ctx.findings).map((f) => f.severity)).toEqual(["ADVISORY"]);
    expect(entityWarns(magAft, ctx.findings)).toBe(false);
  });
});

describe("drawing-to-form navigation", () => {
  it("maps every kind of entity to an explicit destination", () => {
    expect(destinationFor({ kind: "section", id: "central-machinery" }, ctx)).toMatchObject({
      tab: "hull",
      target: { kind: "panel", panel: "machinery" },
    });
    expect(destinationFor({ kind: "section", id: "forward-magazine" }, ctx)?.target).toEqual({
      kind: "panel",
      panel: "protection",
    });
    expect(destinationFor({ kind: "fitting", instanceId: "gun_12pdr" }, ctx)).toMatchObject({
      tab: "arrangement",
      target: { kind: "battery", key: "SECONDARY:76000" },
    });
    expect(destinationFor({ kind: "fitting", instanceId: "mag_fwd" }, ctx)?.target).toEqual({
      kind: "placement",
      instanceId: "mag_fwd",
    });
    expect(destinationFor({ kind: "machinery-room", index: 1 }, ctx)?.tab).toBe("hull");
    expect(destinationFor({ kind: "machinery-room", index: 9 }, ctx)).toBeNull();
    for (const id of SECTION_IDS)
      expect(destinationFor({ kind: "section", id }, ctx)).not.toBeNull();
  });

  it("opens the machinery settings, focuses a control there and outlines the group", () => {
    render(<DrawingBoard />);
    openTab("Build");
    fireEvent.click(label("Central machinery"));
    fireEvent.click(within(inspector()!).getByRole("button", { name: "Go to machinery settings" }));
    expect(
      screen.getByRole("tab", { name: /Hull and machinery/ }).getAttribute("aria-selected"),
    ).toBe("true");
    const panel = screen.getByRole("region", { name: "Machinery, fuel and range" });
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(panel.dataset["navFlash"]).toBe("true");
    // The selection survives the jump.
    expect(pressed()).toEqual(["Central machinery"]);
  });

  it("opens a gun's battery card and a magazine's own row", () => {
    render(<DrawingBoard />);
    fireEvent.click(target("gun_12pdr"));
    fireEvent.click(within(inspector()!).getByRole("button", { name: "Go to battery settings" }));
    expect(screen.getByRole("tab", { name: /Arrangement/ }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(document.activeElement).toBe(
      screen.getByLabelText("Rounds per gun, Secondary battery, 3.0-inch"),
    );
    fireEvent.click(target("mag_fwd"));
    fireEvent.click(within(inspector()!).getByRole("button", { name: "Go to fitting settings" }));
    expect(document.activeElement).toBe(screen.getByLabelText(/^Station of mag_fwd /));
    expect(target("mag_fwd").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("form-to-drawing linking", () => {
  it("lights a fitting while its row has focus, without replacing the pinned selection", () => {
    render(<DrawingBoard />);
    fireEvent.click(target("gun_12pdr"));
    openTab("Arrangement");
    act(() => screen.getByLabelText(/^Station of dyn /).focus());
    expect(target("dyn").getAttribute("data-state")).toBe("linked");
    expect(fittings().querySelectorAll("[data-testid='fitting-linked-ring']")).toHaveLength(1);
    expect(target("gun_12pdr").getAttribute("data-state")).toBe("selected");
    act(() => screen.getByLabelText(/^Station of dyn /).blur());
    expect(target("dyn").getAttribute("data-state")).toBe("default");
    expect(target("gun_12pdr").getAttribute("aria-pressed")).toBe("true");
  });

  it("lights all of a battery's mounts, and the machinery rooms from the machinery settings", () => {
    render(<DrawingBoard />);
    openTab("Arrangement");
    act(() => screen.getByLabelText("Rounds per gun, Secondary battery, 2.2-inch").focus());
    expect(target("gun_6pdr_a").getAttribute("data-state")).toBe("linked");
    expect(target("gun_6pdr_b").getAttribute("data-state")).toBe("linked");
    expect(target("gun_12pdr").getAttribute("data-state")).toBe("default");
    openTab("Hull and machinery");
    act(() => screen.getByLabelText(/Installed power/).focus());
    expect(document.querySelectorAll("[data-testid='room-linked']")).toHaveLength(2);
    act(() => (document.activeElement as HTMLElement).blur());
    expect(document.querySelectorAll("[data-testid='room-linked']")).toHaveLength(0);
  });

  it("draws preview, linked and selected sections differently, not by colour alone", async () => {
    render(<DrawingBoard />);
    fireEvent.click(label("Forecastle"));
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => label("Quarterdeck").focus());
    await expect
      .poll(() => document.querySelector("[data-testid='section-highlight']"))
      .not.toBeNull();
    const selected = document.querySelector("[data-testid='section-selected']")!;
    const preview = document.querySelector("[data-testid='section-highlight']")!;
    expect(selected.getAttribute("stroke-dasharray")).toBeNull();
    expect(preview.getAttribute("stroke-dasharray")).not.toBeNull();
    expect(Number(selected.getAttribute("stroke-width"))).toBeGreaterThan(
      Number(preview.getAttribute("stroke-width")),
    );
  });
});
