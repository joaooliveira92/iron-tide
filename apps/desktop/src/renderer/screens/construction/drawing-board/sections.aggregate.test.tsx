/**
 * Aggregate test for the section strip and card (metadata, derived facts, labels, card), which all read one
 * fixture. Per-module tests live beside each module; add focused cases there, not here.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { buildWorkshopView, type DesignDraft, type WorkshopView } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../../components/design-workspace/content.js";
import { DrawingBoard } from "./DrawingBoard.js";
import { openPlanDisplay, openTab } from "./test-helpers.js";
import {
  bowStyleFor,
  planFrame,
  sternStyleFor,
  stationX,
  PLAN_W,
} from "../../../components/design-workspace/panels/hull-plan/geometry.js";
import {
  SectionCard,
  type SectionCardContext,
} from "../../../components/design-workspace/panels/hull-plan/SectionCard.js";
import {
  SECTION_CLOSE_DELAY,
  SECTION_OPEN_DELAY,
  SectionLabels,
} from "../../../components/design-workspace/panels/hull-plan/SectionLabels.js";
import {
  SECTION_IDS,
  SECTIONS,
  sectionFacts,
  sectionSpan,
} from "../../../components/design-workspace/panels/hull-plan/sections.js";

/**
 * The hull-plan section strip uses base-ui's hover card, whose open/close runs on
 * a timer and whose floating-ui positioner repositions on rAF. Under real timers
 * those callbacks fire after the tests' synchronous events, so React warns that
 * updates were not wrapped in `act` (hundreds of lines per run). Fake timers make
 * the flush deterministic: hover interactions advance the delay inside `act`, and
 * any stragglers are drained in `afterEach` before unmount (test-hygiene INC-1).
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame"] });
});
afterEach(async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SECTION_OPEN_DELAY + SECTION_CLOSE_DELAY + 40);
  });
  vi.useRealTimers();
  cleanup();
});

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const form = content.hullForms.find((f) => f.id === ref.draft.hull.hullFormId)!;
const view = buildWorkshopView(ref.draft, content.environmentFor(ref.month));
const ctxFor = (draft: DesignDraft = ref.draft, v: WorkshopView = view): SectionCardContext => ({
  draft,
  view: v,
  content,
  zones: form.zones,
  frame: planFrame(draft.hull, {
    waterplaneCoeffBp: form.waterplaneCoeffBp,
    lcbPermille: form.lcbPermille,
    bow: bowStyleFor(form.id),
    stern: sternStyleFor(form.id),
  }),
  sheerBp: form.sheerBp,
});

const NAMES = [
  "Forecastle",
  "Forward magazine",
  "Forward service",
  "Central machinery",
  "Superstructure",
  "Aft service",
  "Aft magazine",
  "Quarterdeck",
];
const strip = () => screen.getByRole("group", { name: "Hull sections" });
const label = (name: string) => within(strip()).getByRole("button", { name });
const card = () => document.querySelector<HTMLElement>("[data-testid='section-card']");
const highlight = () => document.querySelector("[data-testid='section-highlight']");
/** Keyboard focus as a user tabbing in produces it, flushed through the hover open delay inside `act`. */
const tabTo = async (el: HTMLElement) => {
  fireEvent.keyDown(document.body, { key: "Tab" });
  await act(async () => {
    el.focus();
    await vi.advanceTimersByTimeAsync(SECTION_OPEN_DELAY + 1);
  });
};

describe("section metadata", () => {
  it("covers every section once, bow to stern, with distinct zones and full names", () => {
    expect(SECTION_IDS.map((id) => SECTIONS[id].name)).toEqual(NAMES);
    expect(new Set(SECTION_IDS.map((id) => SECTIONS[id].zoneId)).size).toBe(8);
  });

  it("places each section where the plan draws it, as a share of the drawing width", () => {
    for (const z of form.zones) {
      const span = sectionSpan(z);
      expect(span.leftPct).toBeCloseTo((stationX(z.startPermille) / PLAN_W) * 100, 6);
      expect(span.leftPct + span.widthPct).toBeCloseTo((stationX(z.endPermille) / PLAN_W) * 100, 6);
    }
  });

  it("collects only the fittings, rooms and bunkers that are in the section", () => {
    for (const id of SECTION_IDS) {
      const f = sectionFacts(id, ctxFor());
      const zoneId = SECTIONS[id].zoneId;
      expect(f.fittings.map((x) => x.instanceId)).toEqual(
        ref.draft.placements.filter((p) => p.zoneId === zoneId).map((p) => p.instanceId),
      );
      expect(f.fittings.map((x) => x.n)).toEqual(f.fittings.map((_, i) => i + 1));
      expect(f.fuelStationPermille !== undefined).toBe(ref.draft.machinery.fuelZoneId === zoneId);
      expect(f.load?.weightKg).toBe(
        view.compiled.arrangement?.zones.find((z) => z.zoneId === zoneId)?.weightKg,
      );
    }
    const machinery = sectionFacts("central-machinery", ctxFor());
    expect(machinery.machineryRooms.length).toBeGreaterThan(0);
  });
});

describe("section cards", () => {
  it("draws a different, design-driven schematic for each of the eight sections", () => {
    const markup = SECTION_IDS.map((id) => {
      render(<SectionCard id={id} ctx={ctxFor()} />);
      const drawing = within(card()!).getByRole("img", { name: /Detailed drawing of the/ });
      expect(drawing.getAttribute("data-section")).toBe(id);
      expect(within(card()!).getByRole("heading", { name: SECTIONS[id].name })).toBeTruthy();
      const html = drawing.outerHTML.replace(/section-[a-zA-Z0-9-]*?(plan|profile|hatch)/g, "$1");
      cleanup();
      return html;
    });
    expect(new Set(markup).size).toBe(8);
  });

  it("follows the design: removing a fitting removes it from its section's card", () => {
    const placed = ref.draft.placements.find((p) => p.zoneId === "FWD_MAGAZINE")!;
    const fewer = { ...ref.draft, placements: ref.draft.placements.filter((p) => p !== placed) };
    render(<SectionCard id="forward-magazine" ctx={ctxFor()} />);
    const before = card()!.querySelectorAll("[data-fitting]").length;
    cleanup();
    render(<SectionCard id="forward-magazine" ctx={ctxFor(fewer)} />);
    expect(card()!.querySelectorAll("[data-fitting]").length).toBe(before - 1);
  });

  it("says plainly when the hull form defines no such section", () => {
    render(<SectionCard id="quarterdeck" ctx={{ ...ctxFor(), zones: [] }} />);
    expect(within(card()!).getByRole("note").textContent).toMatch(/does not define a quarterdeck/);
    expect(within(card()!).queryByRole("img")).toBeNull();
    expect(within(card()!).getByRole("heading", { name: "Quarterdeck" })).toBeTruthy();
  });

  it("says plainly when there is no arrangement result to report", () => {
    const noArrangement = { ...view, compiled: { ...view.compiled, arrangement: null } };
    render(<SectionCard id="forecastle" ctx={ctxFor(ref.draft, noArrangement)} />);
    expect(within(card()!).getByRole("note").textContent).toMatch(/not available/);
    expect(within(card()!).getByRole("img", { name: /Detailed drawing/ })).toBeTruthy();
  });
});

describe("section labels on the hull plan", () => {
  it("renders all eight sections as keyboard-reachable buttons named in full", async () => {
    render(<DrawingBoard />);
    const buttons = within(strip()).getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(NAMES);
    await act(async () => {
      for (const b of buttons) {
        expect(b.tagName).toBe("BUTTON");
        expect(b.tabIndex).toBe(0);
        b.focus();
        expect(document.activeElement).toBe(b);
      }
      await vi.advanceTimersByTimeAsync(SECTION_OPEN_DELAY + 1);
    });
  });

  it("aligns each label with its section's span of the drawing", () => {
    render(<DrawingBoard />);
    expect(strip().dataset["aligned"]).toBe("true");
    for (const id of SECTION_IDS) {
      const zone = form.zones.find((z) => z.id === SECTIONS[id].zoneId)!;
      const span = sectionSpan(zone);
      const style = label(SECTIONS[id].name).style;
      expect(parseFloat(style.left)).toBeCloseTo(span.leftPct + span.widthPct / 2, 4);
      expect(style.width).toContain(`${span.widthPct}%`);
    }
  });

  it("follows the zones it is given, and falls back to an even row without them", () => {
    const zones = form.zones.map((z) => (z.id === "FORECASTLE" ? { ...z, endPermille: 120 } : z));
    const { rerender } = render(<SectionLabels zones={zones} renderCard={() => null} />);
    const left = parseFloat(label("Forecastle").style.left);
    expect(left).toBeCloseTo(
      sectionSpan(zones[0]!).leftPct + sectionSpan(zones[0]!).widthPct / 2,
      4,
    );
    rerender(<SectionLabels zones={[]} renderCard={() => null} />);
    expect(strip().dataset["aligned"]).toBe("false");
    expect(within(strip()).getAllByRole("button")).toHaveLength(8);
  });

  it("opens the section's card on keyboard focus and highlights the section on the plan", async () => {
    render(<DrawingBoard />);
    await tabTo(label("Forward magazine"));
    screen.getByRole("heading", { name: "Forward magazine" });
    expect(card()!.dataset["section"]).toBe("forward-magazine");
    expect(highlight()?.getAttribute("data-zone")).toBe("FWD_MAGAZINE");
    await act(async () => {
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      await vi.advanceTimersByTimeAsync(SECTION_CLOSE_DELAY + 1);
    });
    expect(highlight()).toBeNull();
  });

  it("swaps to the next section's content when focus moves along the strip", async () => {
    render(<DrawingBoard />);
    await tabTo(label("Forecastle"));
    screen.getByRole("heading", { name: "Forecastle" });
    await tabTo(label("Forward magazine"));
    screen.getByRole("heading", { name: "Forward magazine" });
    expect(screen.queryByRole("heading", { name: "Forecastle" })).toBeNull();
    expect(document.querySelectorAll("[data-testid='section-card']")).toHaveLength(1);
    expect(highlight()?.getAttribute("data-zone")).toBe("FWD_MAGAZINE");
  });

  it("gives tap and click users the same details without hover, in the inspector", () => {
    render(<DrawingBoard />);
    fireEvent.click(label("Quarterdeck"));
    // A tap pins the section: the plan shows the selected state and the inspector holds the details, so the
    // preview card is closed rather than left covering them.
    expect(
      document.querySelector("[data-testid='section-selected']")?.getAttribute("data-zone"),
    ).toBe("QUARTERDECK");
    const inspector = screen.getByTestId("selection-inspector");
    expect(within(inspector).getByRole("heading", { name: "Quarterdeck" })).toBeTruthy();
    expect(within(inspector).getByText(/‰ · .* m from the bow/)).toBeTruthy();
    expect(card()).toBeNull();
  });

  it("renders the card outside the Drawing Board, so no panel overflow can clip it", async () => {
    render(<DrawingBoard />);
    await tabTo(label("Superstructure"));
    expect(card()?.dataset["section"]).toBe("superstructure");
    expect(screen.getByTestId("drawing-board").contains(card())).toBe(false);
  });

  it("keeps the labels, their card and the plan tools working on every tab", async () => {
    render(<DrawingBoard />);
    const drawing = screen.getByRole("img", { name: /Top-down plan/ });
    openPlanDisplay();
    fireEvent.click(screen.getByLabelText("Show gun arcs"));
    // Close the display popover (it hands focus back to its trigger) before tabbing to a label.
    fireEvent.click(screen.getByRole("button", { name: "Plan display" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SECTION_OPEN_DELAY + 1);
    });
    expect(screen.queryByRole("dialog", { name: "Plan display" })).toBeNull();
    for (const tab of ["Arrangement", "Analysis", "Build", "History and files"]) {
      openTab(tab);
      expect(screen.getByRole("img", { name: /Top-down plan/ })).toBe(drawing);
      expect(drawing.querySelectorAll("[data-arc]")).toHaveLength(0);
    }
    await tabTo(label("Aft service"));
    expect(card()?.dataset["section"]).toBe("aft-service");
    expect(screen.getByRole("button", { name: "Place on plan" })).toBeTruthy();
  });
});
