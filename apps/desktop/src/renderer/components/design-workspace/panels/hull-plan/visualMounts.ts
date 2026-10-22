import type { DesignDraft, WorkshopView } from "@bluewave/ship-design";
import {
  DEFAULT_ERA,
  nationStyleOf,
  visualEraOf,
  type NationStyle,
  type VisualEra,
  type VisualMountInput,
} from "@bluewave/ship-visual";

export interface VisualLook {
  readonly style: NationStyle;
  readonly era: VisualEra;
}

export function visualLook(nationId: string, month: string): VisualLook {
  return { style: nationStyleOf(nationId), era: visualEraOf(month) ?? DEFAULT_ERA };
}

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
