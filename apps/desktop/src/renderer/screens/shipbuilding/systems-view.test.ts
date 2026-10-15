import { describe, expect, it } from "vite-plus/test";
import { applyEdit, COMPONENT_CATEGORIES, type ComponentCategory } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import { addSystemEdit, systemsModel, unavailableReason } from "./systems-view.js";

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const month = ref.month;
const techs = env.ctx.unlockedTechs;

const SYSTEM_CATEGORIES: ReadonlySet<ComponentCategory> = new Set(
  COMPONENT_CATEGORIES.filter((c) =>
    [
      "DIRECTOR",
      "RANGEFINDER",
      "RADAR",
      "SONAR",
      "COMMS",
      "AIRCRAFT_FACILITY",
      "ACCOMMODATION",
    ].includes(c),
  ),
);

describe("systems view model", () => {
  it("names why an installation is unavailable", () => {
    for (const entry of content.catalogue) {
      const reason = unavailableReason(entry, month, techs);
      if (entry.introduction.fromMonth > month) {
        expect(reason).toContain("until");
      } else if (entry.requires.some((t) => !techs.has(t))) {
        expect(reason).toContain("Requires");
      } else {
        expect(reason).toBeNull();
      }
    }
  });

  it("hides unavailable installations by default and reveals them with a reason on request", () => {
    const hidden = systemsModel(SYSTEM_CATEGORIES, ref.draft, content, month, techs, false);
    for (const g of hidden) for (const i of g.items) expect(i.available).toBe(true);

    const shown = systemsModel(SYSTEM_CATEGORIES, ref.draft, content, month, techs, true);
    const shownItems = shown.flatMap((g) => g.items);
    expect(shownItems.length).toBeGreaterThanOrEqual(hidden.flatMap((g) => g.items).length);
    for (const i of shownItems) {
      if (!i.available) expect(i.reason).not.toBeNull();
    }
  });

  it("adds an available installation as one draft edit in a legal zone", () => {
    const available = systemsModel(SYSTEM_CATEGORIES, ref.draft, content, month, techs, false)
      .flatMap((g) => g.items)
      .find((i) => i.available);
    expect(available).toBeTruthy();
    const edit = addSystemEdit(available!.componentId, ref.draft, content);
    expect(edit).not.toBeNull();
    const next = applyEdit(ref.draft, edit!);
    expect(next.placements.length).toBe(ref.draft.placements.length + 1);
    const placed = next.placements.find(
      (p) => p.instanceId === (edit as { placement: { instanceId: string } }).placement.instanceId,
    )!;
    const def = content.catalogue.find((c) => c.id === available!.componentId)!;
    if (def.allowedZones !== undefined) expect(def.allowedZones).toContain(placed.zoneId);
  });

  it("counts how many of an installation the design already carries", () => {
    const groups = systemsModel(
      new Set<ComponentCategory>(["ACCOMMODATION", "SPECIAL_EQUIPMENT"]),
      ref.draft,
      content,
      month,
      techs,
      true,
    );
    const items = groups.flatMap((g) => g.items);
    for (const i of items) {
      const count = ref.draft.placements.filter((p) => p.componentId === i.componentId).length;
      expect(i.fitted).toBe(count);
    }
  });
});
