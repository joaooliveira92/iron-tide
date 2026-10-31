import type { IndexTab } from "../../components/slate/IndexTabs.js";
import { plural } from "../../components/design-workspace/index.js";
import { SECTION_ORDER, type DesignSectionId } from "./design-sections.js";
import type { SectionStatus } from "./section-status.js";

export const DESIGN_SECTION_SUMMARY: { readonly [K in DesignSectionId]: string } = {
  overview: "The design at a glance: priorities, cost and the brief it answers.",
  hull: "Dimensions, hull form, materials and the stability they give.",
  machinery: "Engines, boilers, fuel and the speed and range they deliver.",
  protection: "Armour, underwater protection and magazines.",
  armament: "Main, secondary and torpedo batteries, and their mounts.",
  systems: "Fire control, sensors, aviation and accommodation.",
  review: "Every finding in priority order, then rebuild and finish.",
};

export function statusDetail(status: SectionStatus): {
  readonly text: string;
  readonly attention: boolean;
} {
  switch (status.kind) {
    case "valid":
      return { text: "No problems", attention: false };
    case "warning":
      return { text: plural(status.count, "warning"), attention: true };
    case "issues":
      return { text: plural(status.count, "problem"), attention: true };
    case "not-configured":
      return { text: "Nothing fitted", attention: false };
  }
}

export function designIndexTabs(statuses: {
  readonly [K in DesignSectionId]: SectionStatus;
}): readonly (readonly IndexTab<DesignSectionId>[])[] {
  const tabOf = ({ id, label, icon }: (typeof SECTION_ORDER)[number]) => {
    const { text, attention } = statusDetail(statuses[id]);
    return { id, label, icon, detail: text, attention };
  };
  return [SECTION_ORDER.slice(0, 1), SECTION_ORDER.slice(1, 6), SECTION_ORDER.slice(6)].map(
    (group) => group.map(tabOf),
  );
}
