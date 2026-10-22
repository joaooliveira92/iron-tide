import { buildWorkshopView } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../content.js";
import { bowStyleFor, planFrame, sternStyleFor } from "./geometry.js";
import { profileFrame } from "./profile-geometry.js";
import { sectionLayout } from "./section-drawing.js";
import { type SectionId, type ZoneRange, sectionFacts } from "./sections.js";

export const content = loadDrawingBoardContent();
export const reference = content.references[0]!;
export const hullForm = content.hullForms.find((f) => f.id === reference.draft.hull.hullFormId)!;
export const view = buildWorkshopView(reference.draft, content.environmentFor(reference.month));
export const frame = planFrame(reference.draft.hull, {
  waterplaneCoeffBp: hullForm.waterplaneCoeffBp,
  lcbPermille: hullForm.lcbPermille,
  bow: bowStyleFor(hullForm.id),
  stern: sternStyleFor(hullForm.id),
});
export const profile = profileFrame(reference.draft.hull, hullForm.sheerBp, frame.bow, frame.stern);

export const sectionFactsFor = (id: SectionId, zones: readonly ZoneRange[] = hullForm.zones) =>
  sectionFacts(id, { draft: reference.draft, view, content, zones });

export const sectionLayoutFor = (id: SectionId, zones: readonly ZoneRange[] = hullForm.zones) =>
  sectionLayout(sectionFactsFor(id, zones), frame, profile, reference.draft, content, zones);
