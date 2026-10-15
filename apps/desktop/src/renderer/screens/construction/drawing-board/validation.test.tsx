import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { buildWorkshopView, type Finding, type WorkshopView } from "@bluewave/ship-design";
import { batteryCards } from "../../../components/design-workspace/batteryView.js";
import { loadDrawingBoardContent } from "../../../components/design-workspace/content.js";
import { DrawingBoard } from "./DrawingBoard.js";
import { openPlanDisplay, openTab } from "./test-helpers.js";
import {
  bowStyleFor,
  fittingPoint,
  planFrame,
  sternStyleFor,
} from "../../../components/design-workspace/panels/hull-plan/geometry.js";
import { fixDestination } from "../../../components/design-workspace/selection/navigation.js";
import {
  boardFindings,
  findingsFor,
} from "../../../components/design-workspace/validation/boardFindings.js";
import { FINDINGS_VIEW_KEY } from "../../../components/design-workspace/validation/FindingsControl.js";
import { layoutMarkers } from "../../../components/design-workspace/validation/FindingMarkers.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month);
const view = buildWorkshopView(ref.draft, env);
const form = content.hullForms.find((f) => f.id === ref.draft.hull.hullFormId)!;
const frame = planFrame(ref.draft.hull, {
  waterplaneCoeffBp: form.waterplaneCoeffBp,
  lcbPermille: form.lcbPermille,
  bow: bowStyleFor(form.id),
  stern: sternStyleFor(form.id),
});
const batteries = batteryCards(view, ref.draft);
const outOfZone = {
  ...ref.draft,
  placements: ref.draft.placements.map((p) =>
    p.instanceId === "gun_12pdr" ? { ...p, stationPermille: 120 } : p,
  ),
};
const outView = buildWorkshopView(outOfZone, env);

/** A view whose findings are replaced, to test the adapter on findings the compile cannot produce today. */
const withFindings = (fs: Finding[]): WorkshopView => ({
  ...view,
  findingsBySeverity: { BLOCKING: [], CRITICAL: [], WARNING: fs, ADVISORY: [] },
});
const legacy: Finding = {
  id: "SOME_UNMIGRATED_RULE",
  severity: "WARNING",
  what: "mag_aft is damp.",
  why: "Old rule.",
  consequence: "c",
  remedies: [],
  evidence: { formulaId: "X", inputs: {}, threshold: 0, value: 1 },
};

const marker = (k: string) => document.querySelector<SVGGElement>(`[data-marker="${k}"]`);
const inspector = () => screen.queryByTestId("selection-inspector");
const commit = (label: RegExp, value: string) => {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

describe("finding adapter", () => {
  it("links migrated findings by their structured targets", () => {
    const fs = boardFindings(view, ref.draft, batteries);
    const fc = fs.find((f) => f.rule === "FC_INCOMPATIBLE")!;
    expect(fc.association).toBe("structured");
    expect(fc.entities).toEqual(
      expect.arrayContaining([{ kind: "fitting", instanceId: "gun_12pdr" }]),
    );
    expect(fc.settings).toBe("arrangement");
    expect(fs.filter((f) => f.rule === "MAGAZINE_UNPROTECTED").map((f) => f.entities)).toEqual(
      expect.arrayContaining([[{ kind: "fitting", instanceId: "mag_aft" }]]),
    );
  });

  it("keeps the same identity and links when the wording changes", () => {
    const fc = view.findingsBySeverity.WARNING.find((f) => f.id === "FC_INCOMPATIBLE")!;
    const [a] = boardFindings(withFindings([fc]), ref.draft, batteries);
    const [b] = boardFindings(
      withFindings([{ ...fc, what: "Reworded entirely.", why: "Also new." }]),
      ref.draft,
      batteries,
    );
    expect(b!.key).toBe(a!.key);
    expect(b!.entities).toEqual(a!.entities);
  });

  it("falls back to reading the wording only for unmigrated rules, and says so", () => {
    const [f] = boardFindings(withFindings([legacy]), ref.draft, batteries);
    expect(f!.association).toBe("inferred");
    expect(f!.entities).toEqual([{ kind: "fitting", instanceId: "mag_aft" }]);
    const [none] = boardFindings(
      withFindings([{ ...legacy, what: "Nothing named here." }]),
      ref.draft,
      batteries,
    );
    expect(none!.association).toBe("none");
    expect(none!.entities).toEqual([]);
  });

  it("expands a battery target to every mount of that battery", () => {
    const card = batteries.find((b) => b.mounts.length > 1)!;
    const [f] = boardFindings(
      withFindings([{ ...legacy, subject: { targets: [{ kind: "battery", key: card.row.key }] } }]),
      ref.draft,
      batteries,
    );
    expect(f!.entities.map((e) => (e.kind === "fitting" ? e.instanceId : e.kind))).toEqual(
      card.mounts.map((m) => m.instanceId),
    );
  });

  it("gives repeated rule-and-target pairs distinct, stable keys", () => {
    const fs = boardFindings(withFindings([legacy, legacy]), ref.draft, batteries);
    expect(fs.map((f) => f.key)).toEqual(["SOME_UNMIGRATED_RULE|", "SOME_UNMIGRATED_RULE|#1"]);
  });

  it("sends a fix to the fitting's own row, or to the rule's settings, never a guess", () => {
    const fs = boardFindings(outView, outOfZone, batteryCards(outView, outOfZone));
    const station = fs.find((f) => f.rule === "ARR-STATION-OUT-OF-ZONE")!;
    expect(station.entities).toEqual([
      { kind: "fitting", instanceId: "gun_12pdr" },
      { kind: "section", id: "forecastle" },
    ]);
    expect(fixDestination(station)?.target).toEqual({ kind: "placement", instanceId: "gun_12pdr" });
    const mag = fs.find((f) => f.rule === "MAGAZINE_UNPROTECTED")!;
    expect(fixDestination(mag)?.target).toEqual({ kind: "panel", panel: "protection" });
    expect(fixDestination({ ...station, settings: undefined })).toBeNull();
  });
});

describe("marker layout", () => {
  const fs = boardFindings(outView, outOfZone, batteryCards(outView, outOfZone));
  const groups = layoutMarkers(fs, frame, outOfZone, form.zones);

  it("puts a fitting's marker beside the fitting's own drawn position", () => {
    const g = groups.find((m) => m.entity.kind === "fitting" && m.entity.instanceId === "mag_aft")!;
    const i = outOfZone.placements.findIndex((p) => p.instanceId === "mag_aft");
    const p = outOfZone.placements[i]!;
    const at = fittingPoint(frame, p.stationPermille, p.side, i);
    expect(Math.hypot(g.x - at.x, g.y - at.y)).toBeGreaterThan(8);
    expect(Math.hypot(g.x - at.x, g.y - at.y)).toBeLessThan(30);
  });

  it("puts a section's marker within the section, under the hull", () => {
    const g = groups.find((m) => m.entity.kind === "section" && m.entity.id === "forecastle")!;
    const z = form.zones.find((q) => q.id === "FORECASTLE")!;
    expect(g.x).toBeGreaterThanOrEqual(frame.x(z.startPermille));
    expect(g.x).toBeLessThanOrEqual(frame.x(z.endPermille) + 13);
  });

  it("groups one entity's findings, most severe first, and keeps markers apart", () => {
    const gun = groups.find(
      (m) => m.entity.kind === "fitting" && m.entity.instanceId === "gun_12pdr",
    )!;
    expect(gun.findings.map((f) => f.severity)).toEqual(["BLOCKING", "WARNING"]);
    for (const a of groups)
      for (const b of groups)
        if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(12);
  });

  it("follows the drawing's geometry, so the overlay scales with the panel", () => {
    const svg = () => screen.getByTestId("finding-markers");
    render(<DrawingBoard />);
    // Same viewBox as the plan, stretched to the plan box: positions are in plan units, not pixels.
    expect(svg().getAttribute("viewBox")).toBe(
      screen.getByRole("img", { name: /Top-down plan/ }).getAttribute("viewBox"),
    );
    expect(svg().getAttribute("class")).toContain("size-full");
  });
});

describe("markers on the drawing", () => {
  it("shows a grouped marker with the highest severity and the count, and a useful name", () => {
    render(<DrawingBoard />);
    openTab("Arrangement");
    commit(/^Station of gun_12pdr /, "120");
    const m = marker("f:gun_12pdr")!;
    expect(m.getAttribute("data-severity")).toBe("BLOCKING");
    expect(m.getAttribute("data-count")).toBe("2");
    expect(m.getAttribute("aria-label")).toMatch(
      /^Blocking: .*outside zone.*\(.*mount .*\), 2 findings$/,
    );
    expect(marker("s:forecastle")?.getAttribute("data-severity")).toBe("BLOCKING");
  });

  it("is one tab stop with arrow-key movement, and Enter pins the entity and its finding", () => {
    render(<DrawingBoard />);
    const all = [
      ...screen.getByTestId("finding-markers").querySelectorAll<SVGGElement>("[data-marker]"),
    ];
    expect(all.filter((m) => m.tabIndex === 0)).toHaveLength(1);
    act(() => all[0]!.focus());
    fireEvent.keyDown(all[0]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(all[1]);
    fireEvent.keyDown(all[1]!, { key: "Enter" });
    const box = inspector()!;
    expect(box).not.toBeNull();
    expect(box.querySelector("[aria-current='true']")).not.toBeNull();
  });

  it("pins the fitting on click and shows its findings with values, rule and link kind", () => {
    render(<DrawingBoard />);
    fireEvent.click(marker("f:mag_aft")!);
    expect(document.querySelector('[data-target="mag_aft"]')?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    const list = within(inspector()!).getByRole("list", { name: "Findings for this selection" });
    expect(list.textContent).toMatch(/ADVISORY/);
    expect(list.textContent).toMatch(/Current .*%; needs at least .*%/);
    expect(list.textContent).toMatch(/Rule MAGAZINE_UNPROTECTED · linked by the rule/);
    expect(within(list).getByRole("button", { name: "Go to fix" })).toBeTruthy();
  });

  it("Go to fix opens the fitting's row and focuses its station; the pin survives", () => {
    render(<DrawingBoard />);
    openTab("Arrangement");
    commit(/^Station of gun_12pdr /, "120");
    openTab("Build");
    fireEvent.click(marker("f:gun_12pdr")!);
    const fixes = within(inspector()!).getAllByRole("button", { name: "Go to fix" });
    fireEvent.click(fixes[0]!);
    expect(screen.getByRole("tab", { name: /Arrangement/ }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(document.activeElement).toBe(screen.getByLabelText(/^Station of gun_12pdr /));
    expect(document.querySelector('[data-target="gun_12pdr"]')?.getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("Open in Analysis focuses the same finding; Show on ship comes back to it", () => {
    render(<DrawingBoard />);
    fireEvent.click(marker("f:mag_aft")!);
    fireEvent.click(within(inspector()!).getByRole("button", { name: "Open in Analysis" }));
    expect(screen.getByRole("tab", { name: /Analysis/ }).getAttribute("aria-selected")).toBe(
      "true",
    );
    const entry = document.activeElement!.closest("[data-finding-key]")!;
    expect(entry.getAttribute("data-finding-key")).toBe("MAGAZINE_UNPROTECTED|placement:mag_aft");
    expect(entry.getAttribute("data-nav-flash")).toBe("true");
    // From the Analysis entry back to the drawing: the other magazine this time.
    fireEvent.click(
      within(screen.getByRole("region", { name: "Validation" })).getAllByRole("button", {
        name: /MAGAZINE|mag_fwd|Magazine mag_fwd/,
      })[0]!,
    );
    const fwd = document.querySelector(
      '[data-finding-key="MAGAZINE_UNPROTECTED|placement:mag_fwd"]',
    )!;
    fireEvent.click(within(fwd as HTMLElement).getByRole("button", { name: "Show on ship" }));
    expect(document.querySelector('[data-target="mag_fwd"]')?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      inspector()!.querySelector("[aria-current='true']")?.getAttribute("data-inspector-finding"),
    ).toBe("MAGAZINE_UNPROTECTED|placement:mag_fwd");
  });

  it("lights the target while an Analysis entry has focus", () => {
    render(<DrawingBoard />);
    openTab("Analysis");
    const entry = document.querySelector<HTMLElement>(
      '[data-finding-key="MAGAZINE_UNPROTECTED|placement:mag_fwd"]',
    )!;
    act(() => entry.querySelector("button")!.focus());
    expect(document.querySelector('[data-target="mag_fwd"]')?.getAttribute("data-state")).toBe(
      "linked",
    );
  });
});

describe("live resolution", () => {
  it("removes a fixed finding's marker, keeps the entity pinned and notes the fix politely", () => {
    render(<DrawingBoard />);
    openTab("Arrangement");
    commit(/^Station of gun_12pdr /, "120");
    fireEvent.click(marker("f:gun_12pdr")!);
    expect(marker("f:gun_12pdr")?.getAttribute("data-severity")).toBe("BLOCKING");
    commit(
      /^Station of gun_12pdr /,
      String(ref.draft.placements.find((p) => p.instanceId === "gun_12pdr")!.stationPermille),
    );
    expect(marker("f:gun_12pdr")?.getAttribute("data-severity")).toBe("WARNING");
    expect(marker("s:forecastle")).toBeNull();
    expect(document.querySelector('[data-target="gun_12pdr"]')?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(inspector()!.querySelector("[aria-current='true']")).toBeNull();
    const note = screen.getByTestId("resolved-note");
    expect(note.getAttribute("aria-live")).toBe("polite");
    expect(note.textContent).toMatch(/^Resolved: .*outside zone/);
  });

  it("prunes the marker and the selection when the fitting itself is removed", () => {
    render(<DrawingBoard />);
    fireEvent.click(marker("f:mag_aft")!);
    openTab("Arrangement");
    fireEvent.click(screen.getByRole("button", { name: "Remove mag_aft" }));
    expect(marker("f:mag_aft")).toBeNull();
    expect(inspector()).toBeNull();
  });
});

describe("display controls", () => {
  it("filters by severity and hides all findings, as view state only", () => {
    render(<DrawingBoard />);
    expect(marker("f:mag_aft")).not.toBeNull();
    openPlanDisplay();
    fireEvent.click(screen.getByLabelText("Findings to show"));
    fireEvent.click(screen.getByRole("option", { name: "Blocking and critical" }));
    expect(marker("f:mag_aft")).toBeNull();
    expect(marker("f:gun_12pdr")).toBeNull();
    openPlanDisplay();
    fireEvent.click(screen.getByLabelText("Findings to show"));
    fireEvent.click(screen.getByRole("option", { name: "Advisories" }));
    expect(marker("f:mag_aft")).not.toBeNull();
    expect(marker("f:gun_12pdr")).toBeNull();
    openPlanDisplay();
    fireEvent.click(screen.getByLabelText("Show findings on the plan"));
    expect(screen.queryByTestId("finding-markers")).toBeNull();
    expect(JSON.parse(localStorage.getItem(FINDINGS_VIEW_KEY)!)).toEqual({
      visible: false,
      filter: "advisory",
    });
    expect(screen.getByText("No edits")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(true);
  });

  it("steps aside while Place or Move is active", () => {
    render(<DrawingBoard />);
    fireEvent.click(screen.getByRole("button", { name: "Place on plan" }));
    expect(screen.queryByTestId("finding-markers")).toBeNull();
    expect(screen.getByTestId("plan-click-layer")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Place on plan" }));
    expect(screen.getByTestId("finding-markers")).toBeTruthy();
  });

  it("pins the whole ship from the ship-level findings button", () => {
    render(<DrawingBoard />);
    expect(document.querySelector("[data-ship-findings]")).toBeNull();
    // Too little power: a ship-level finding (no part of the drawing carries it).
    commit(/installed power/i, "300");
    const ship = document.querySelector<HTMLButtonElement>("[data-ship-findings]")!;
    expect(ship.getAttribute("aria-label")).toMatch(/^Whole ship: \d+ finding/);
    fireEvent.click(ship);
    expect(within(inspector()!).getByRole("heading", { name: "Whole ship" })).toBeTruthy();
    const list = within(inspector()!).getByRole("list", { name: "Findings for this selection" });
    expect(list.textContent).toMatch(/PLANT_INSUFFICIENT/);
    const plant = list.querySelector<HTMLElement>(
      '[data-inspector-finding^="PLANT_INSUFFICIENT|"]',
    )!;
    expect(plant.textContent).toMatch(/Current .* kn; needs at least .* kn/);
    fireEvent.click(within(plant).getByRole("button", { name: "Go to fix" }));
    expect(
      screen
        .getByRole("region", { name: "Machinery, fuel and range" })
        .contains(document.activeElement),
    ).toBe(true);
  });
});

describe("Escape", () => {
  it("closes the opened finding, then the selection, one step per press", () => {
    render(<DrawingBoard />);
    fireEvent.click(marker("f:mag_aft")!);
    const m = marker("f:mag_aft")!;
    expect(inspector()!.querySelector("[aria-current='true']")).not.toBeNull();
    fireEvent.keyDown(m, { key: "Escape" });
    expect(inspector()).not.toBeNull();
    expect(inspector()!.querySelector("[aria-current='true']")).toBeNull();
    fireEvent.keyDown(m, { key: "Escape" });
    expect(inspector()).toBeNull();
  });
});

describe("one source of findings", () => {
  it("shows every finding of an entity in the inspector exactly as the Analysis tab lists it", () => {
    const fs = boardFindings(view, ref.draft, batteries);
    render(<DrawingBoard />);
    openTab("Analysis");
    const keys = [...document.querySelectorAll("[data-finding-key]")].map((e) =>
      e.getAttribute("data-finding-key"),
    );
    expect(keys).toEqual(fs.map((f) => f.key));
    expect(findingsFor({ kind: "fitting", instanceId: "mag_aft" }, fs)).toHaveLength(1);
  });
});
