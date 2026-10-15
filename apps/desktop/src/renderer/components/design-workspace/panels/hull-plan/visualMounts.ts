import type { DesignDraft, WorkshopView } from "@bluewave/ship-design";
import {
  DEFAULT_ERA,
  nationStyleOf,
  visualEraOf,
  type NationStyle,
  type VisualEra,
  type VisualMountInput,
} from "@bluewave/ship-visual";

/** The nation style and visual era a design is drawn in (ADR-0148). */
export interface VisualLook {
  readonly style: NationStyle;
  readonly era: VisualEra;
}

/** The designing nation's style in the design month's era; a malformed month draws in the default era. */
export function visualLook(nationId: string, month: string): VisualLook {
  return { style: nationStyleOf(nationId), era: visualEraOf(month) ?? DEFAULT_ERA };
}

/**
 * Every compiled placement as the ship-visual package reads it: station and side from the draft, category, calibre,
 * gun count and mount type from the compile (the armament identity when it resolved, else the component's own
 * parameters). Presentation only: nothing here feeds back into the design.
 */
export function visualMountInputs(draft: DesignDraft, view: WorkshopView): VisualMountInput[] {
  const compiled = new Map(view.compiled.components.map((c) => [c.instanceId, c]));
  return draft.placements.flatMap((p) => {
    const c = compiled.get(p.instanceId);
    if (c === undefined) return [];
    return [
      {
        instanceId: p.instanceId,
        stationPermille: p.stationPermille,
        side: p.side,
        category: c.category,
        mountType: c.armament?.mountType,
        gunCount: c.armament?.gunCount ?? c.params["barrels"] ?? 1,
        caliberUm: c.armament?.caliberUm ?? c.attr["caliberUm"],
      },
    ];
  });
}
