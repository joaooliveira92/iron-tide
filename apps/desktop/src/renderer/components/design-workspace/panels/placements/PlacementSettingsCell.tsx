import type { ReactNode } from "react";
import type { PartCatalogueEntry, PlacementSpec } from "@bluewave/ship-design";
import { NumberField } from "../../fields.js";
import type { PlacementActions } from "./usePlacementsState.js";

export function PlacementSettingsCell({
  placement,
  entry,
  actions,
  children,
}: {
  readonly placement: PlacementSpec;
  readonly entry: PartCatalogueEntry | undefined;
  readonly actions: Pick<PlacementActions, "setParam">;
  readonly children?: ReactNode;
}) {
  return (
    <td className="p-1 @max-xl:col-span-2">
      <div className="flex flex-wrap gap-2">
        {children}
        {Object.entries(entry?.parameters ?? {}).map(([name, r]) => (
          <NumberField
            key={name}
            className="w-24"
            label={`${name} of ${placement.instanceId}`}
            shortLabel={name}
            min={r.min}
            max={r.max}
            step={r.step}
            value={placement.params?.[name] ?? r.min}
            onCommit={(v) => actions.setParam(placement, name, v)}
          />
        ))}
      </div>
    </td>
  );
}
