import type { ComponentCategory, SettingGroup } from "@bluewave/ship-design";
import type { BoardFinding } from "../../components/design-workspace/validation/boardFindings.js";
import { CATEGORY_PLACE, DESIGN_SECTIONS, type DesignSectionId } from "./design-sections.js";

export type SectionStatus =
  | { readonly kind: "valid" }
  | { readonly kind: "warning"; readonly count: number }
  | { readonly kind: "issues"; readonly count: number }
  | { readonly kind: "not-configured" };

export type StatusFinding = Pick<BoardFinding, "severity" | "settings" | "entities">;

const SETTINGS_SECTION: { readonly [K in SettingGroup]: DesignSectionId | null } = {
  brief: "overview",
  hull: "hull",
  machinery: "machinery",
  armour: "protection",
  arrangement: null,
};

const FITTED_SECTIONS: readonly DesignSectionId[] = ["armament", "systems"];

function sectionsOf(
  f: StatusFinding,
  fittings: ReadonlyMap<string, ComponentCategory>,
): Set<DesignSectionId> {
  const owners = new Set<DesignSectionId>(["review"]);
  if (f.settings === undefined) return owners;
  const section = SETTINGS_SECTION[f.settings];
  if (section !== null) return owners.add(section);
  for (const e of f.entities) {
    const category = e.kind === "fitting" ? fittings.get(e.instanceId) : undefined;
    if (category !== undefined) owners.add(CATEGORY_PLACE[category].section);
  }
  return owners;
}

export function sectionStatuses(
  findings: readonly StatusFinding[],
  fittings: ReadonlyMap<string, ComponentCategory>,
): { readonly [K in DesignSectionId]: SectionStatus } {
  const issues = new Map<DesignSectionId, number>();
  const warnings = new Map<DesignSectionId, number>();
  for (const f of findings) {
    const tally =
      f.severity === "BLOCKING" || f.severity === "CRITICAL"
        ? issues
        : f.severity === "WARNING"
          ? warnings
          : null;
    if (tally === null) continue;
    for (const s of sectionsOf(f, fittings)) tally.set(s, (tally.get(s) ?? 0) + 1);
  }
  const fitted = new Set([...fittings.values()].map((c) => CATEGORY_PLACE[c].section));
  const statusOf = (id: DesignSectionId): SectionStatus => {
    const n = issues.get(id) ?? 0;
    if (n > 0) return { kind: "issues", count: n };
    const w = warnings.get(id) ?? 0;
    if (w > 0) return { kind: "warning", count: w };
    if (FITTED_SECTIONS.includes(id) && !fitted.has(id)) return { kind: "not-configured" };
    return { kind: "valid" };
  };
  return Object.fromEntries(DESIGN_SECTIONS.map((id) => [id, statusOf(id)])) as {
    readonly [K in DesignSectionId]: SectionStatus;
  };
}
