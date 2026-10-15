import { buildWorkshopView } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { loadDrawingBoardContent } from "../../content.js";
import type { BoardFinding } from "../../validation/boardFindings.js";
import { bowStyleFor, planFrame, sternStyleFor } from "./geometry.js";
import { planModel } from "./planModel.js";
import { SECTIONS } from "./sections.js";

const content = loadDrawingBoardContent();
const ref = content.references.find((r) => r.id === "majestic_like")!;
const form = content.hullForms.find((f) => f.id === ref.draft.hull.hullFormId)!;
const view = buildWorkshopView(ref.draft, content.environmentFor(ref.month));
const model = (given?: readonly BoardFinding[]) =>
  planModel(ref.draft, content, view, ref.month, given);

describe("planModel", () => {
  it("derives the plan frame from the hull form's lines", () => {
    const m = model();
    const frame = planFrame(ref.draft.hull, {
      waterplaneCoeffBp: form.waterplaneCoeffBp,
      lcbPermille: form.lcbPermille,
      bow: bowStyleFor(form.id),
      stern: sternStyleFor(form.id),
    });
    expect({
      lengthM: m.frame.lengthM,
      beamM: m.frame.beamM,
      maxHalf: m.frame.maxHalf,
      lcbPermille: m.frame.lcbPermille,
      bow: m.frame.bow,
      stern: m.frame.stern,
      x250: m.frame.x(250),
    }).toEqual({
      lengthM: frame.lengthM,
      beamM: frame.beamM,
      maxHalf: frame.maxHalf,
      lcbPermille: frame.lcbPermille,
      bow: frame.bow,
      stern: frame.stern,
      x250: frame.x(250),
    });
  });

  it("exposes the hull form's zones and looks components up by id", () => {
    const m = model();
    expect(m.zones).toBe(form.zones);
    const placed = ref.draft.placements[0]!;
    expect(m.entryOf(placed.componentId)?.id).toBe(placed.componentId);
    expect(m.entryOf("not_a_component")).toBeUndefined();
  });

  it("offers only the components available by the reference month", () => {
    const m = model();
    expect(m.available.every((c) => c.introduction.fromMonth <= ref.month)).toBe(true);
    expect(m.available.map((c) => c.id)).toEqual(
      content.catalogue.filter((c) => c.introduction.fromMonth <= ref.month).map((c) => c.id),
    );
  });

  it("uses the board's findings verbatim, or derives its own", () => {
    const given: readonly BoardFinding[] = [];
    expect(model(given).findings).toBe(given);
    expect(Array.isArray(model().findings)).toBe(true);
  });

  it("names fittings, sections, the ship and machinery rooms", () => {
    const m = model();
    const placed = ref.draft.placements[0]!;
    const target = m.targets.get(placed.instanceId)!;
    expect(target.name).toBe(m.entryOf(placed.componentId)?.displayName ?? placed.componentId);
    expect(m.entityName({ kind: "fitting", instanceId: placed.instanceId })).toContain(target.name);
    expect(m.entityName({ kind: "section", id: "forecastle" })).toBe(SECTIONS.forecastle.name);
    expect(m.entityName({ kind: "ship" })).toBe("whole ship");
    expect(m.entityName({ kind: "machinery-room", index: 0 })).toBe("machinery room 1");
  });

  it("collects only funnel-tagged placements as funnels", () => {
    const m = model();
    const funnelIds = new Set(
      content.catalogue.filter((c) => c.tags.includes("funnel")).map((c) => c.id),
    );
    expect(m.placedFunnels.map((f) => f.instanceId)).toEqual(
      ref.draft.placements.filter((p) => funnelIds.has(p.componentId)).map((p) => p.instanceId),
    );
  });

  it("summarises the drawing facts without inventing values", () => {
    const m = model();
    expect(m.facts.hullFormId).toBe(form.id);
    expect(m.facts.fittings).toBe(ref.draft.placements.length);
    expect(m.facts.funnels).toBe(m.placedFunnels.length);
    expect(m.facts.bow).toBe(m.frame.bow);
    expect(m.facts.superstructure).toBe(m.superstructure);
  });

  it("warns for an entity only when its findings are above advisory", () => {
    const placed = ref.draft.placements[0]!;
    const blocking = [
      {
        severity: "BLOCKING",
        entities: [{ kind: "fitting", instanceId: placed.instanceId }],
      } as unknown as BoardFinding,
    ];
    const m = model(blocking);
    expect(m.warns({ kind: "fitting", instanceId: placed.instanceId })).toBe(true);
    expect(m.warns({ kind: "fitting", instanceId: "not_placed" })).toBe(false);
    expect(typeof model().warns({ kind: "fitting", instanceId: placed.instanceId })).toBe(
      "boolean",
    );
  });
});
