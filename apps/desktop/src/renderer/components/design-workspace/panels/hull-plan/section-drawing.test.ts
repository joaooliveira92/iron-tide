import { buildWorkshopView } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { loadDrawingBoardContent } from "../../content.js";
import { bowStyleFor, planFrame, sternStyleFor } from "./geometry.js";
import { profileFrame } from "./profile-geometry.js";
import { PAD_X, SECTION_W, sectionLayout } from "./section-drawing.js";
import { SECTION_IDS, SECTIONS, sectionFacts, type SectionId, type ZoneRange } from "./sections.js";

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const form = content.hullForms.find((f) => f.id === ref.draft.hull.hullFormId)!;
const view = buildWorkshopView(ref.draft, content.environmentFor(ref.month));
const frame = planFrame(ref.draft.hull, {
  waterplaneCoeffBp: form.waterplaneCoeffBp,
  lcbPermille: form.lcbPermille,
  bow: bowStyleFor(form.id),
  stern: sternStyleFor(form.id),
});
const profile = profileFrame(ref.draft.hull, form.sheerBp, frame.bow, frame.stern);
const layoutFor = (id: SectionId, zones: readonly ZoneRange[] = form.zones) =>
  sectionLayout(
    sectionFacts(id, { draft: ref.draft, view, content, zones }),
    frame,
    profile,
    ref.draft,
    content,
    zones,
  );

describe("sectionLayout", () => {
  it("returns nothing when the hull form defines no zone for the section", () => {
    expect(layoutFor("quarterdeck", [])).toBeNull();
  });

  it("places the section's span inside the card's drawing area", () => {
    const layout = layoutFor("central-machinery")!;
    expect(layout).not.toBeNull();
    expect(layout.x0).toBeGreaterThanOrEqual(PAD_X);
    expect(layout.x1).toBeLessThanOrEqual(SECTION_W - PAD_X);
    expect(layout.x1).toBeGreaterThan(layout.x0);
    expect(layout.a).toBeGreaterThan(0);
  });

  it("uses one uniform scale on both axes and both bands, so neither view is distorted", () => {
    for (const id of SECTION_IDS) {
      const layout = layoutFor(id)!;
      expect(layout.ky).toBeCloseTo(layout.a, 9);
      expect(layout.kp).toBeCloseTo(layout.a, 9);
    }
  });

  it("keeps the section and a sliver of each neighbour inside the window it shows", () => {
    for (const id of SECTION_IDS) {
      const layout = layoutFor(id)!;
      expect(layout.s).toBeLessThanOrEqual(layout.zone.startPermille);
      expect(layout.e).toBeGreaterThanOrEqual(layout.zone.endPermille);
      expect(layout.x0).toBeGreaterThanOrEqual(PAD_X);
      expect(layout.x1).toBeLessThanOrEqual(SECTION_W - PAD_X);
    }
  });

  it("ticks only inside the hull and on a documented step", () => {
    const layout = layoutFor("aft-service")!;
    expect([10, 25, 50]).toContain(layout.step);
    for (const tick of layout.ticks) {
      expect(tick).toBeGreaterThanOrEqual(0);
      expect(tick).toBeLessThanOrEqual(1000);
    }
    expect(layout.ticks.length).toBeGreaterThan(0);
  });

  it("is deterministic and names the section", () => {
    const a = layoutFor("forecastle")!;
    const b = layoutFor("forecastle")!;
    expect(a.label).toBe(b.label);
    expect(a.label).toContain(SECTIONS.forecastle.name.toLowerCase());
    expect(a.x0).toBe(b.x0);
    expect(a.X(500)).toBe(b.X(500));
    expect(a.pY(profile.waterlineY)).toBe(b.pY(profile.waterlineY));
  });

  it("draws each of the eight sections with a distinct label", () => {
    const labels = SECTION_IDS.map((id) => layoutFor(id)!.label);
    expect(new Set(labels).size).toBe(SECTION_IDS.length);
  });
});
