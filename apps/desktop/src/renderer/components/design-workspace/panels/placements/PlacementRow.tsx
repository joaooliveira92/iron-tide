import type {
  ComponentSummary,
  PartCatalogueEntry,
  PlacementSpec,
  ZoneId,
} from "@bluewave/ship-design";
import { Badge } from "../../../ui/badge.js";
import { ContextMenu, ContextMenuTrigger } from "../../../ui/context-menu.js";
import { NumberField } from "../../fields.js";
import { placementAttrs } from "../../selection/navigation.js";
import { ComponentHover } from "./ComponentHover.js";
import { PlacementActionsCell } from "./PlacementActionsCell.js";
import { PlacementContextMenuItems } from "./PlacementContextMenuItems.js";
import { PlacementSettingsCell } from "./PlacementSettingsCell.js";
import { PlacementSideField } from "./PlacementSideField.js";
import { zoneLabel } from "./placement-helpers.js";
import type { PlacementActions } from "./usePlacementsState.js";

export function PlacementRow({
  placement,
  entry,
  compiled,
  name,
  otherZones,
  selected,
  onSelect,
  actions,
}: {
  readonly placement: PlacementSpec;
  readonly entry: PartCatalogueEntry | undefined;
  readonly compiled: ComponentSummary | undefined;
  readonly name: string | undefined;
  readonly otherZones: readonly ZoneId[];
  readonly selected: boolean;
  readonly onSelect?: () => void;
  readonly actions: PlacementActions;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <tr
            role="row"
            className="border-t align-top @max-xl:grid @max-xl:grid-cols-2 @max-xl:items-start @max-xl:gap-x-2 @max-xl:py-2"
            {...placementAttrs(placement.instanceId)}
          />
        }
      >
        <th scope="row" className="p-1 text-left font-normal @max-xl:col-span-2">
          <ComponentHover
            entry={entry}
            placement={placement}
            compiled={compiled}
            onSelect={onSelect}
            selected={selected}
          />
          <div className="text-xs text-muted-foreground">
            {name !== undefined && (
              <Badge variant="secondary" className="mr-1">
                {name}
              </Badge>
            )}
            {placement.instanceId}
          </div>
        </th>
        <td className="p-1">
          <Badge variant="outline">{zoneLabel(placement.zoneId)}</Badge>
        </td>
        <td className="w-20 p-1 @max-xl:w-auto">
          <NumberField
            label={`Station of ${placement.instanceId}`}
            shortLabel="Station"
            unit="‰"
            value={placement.stationPermille}
            onCommit={(v) => actions.setStation(placement, v)}
          />
        </td>
        <PlacementSettingsCell placement={placement} entry={entry} actions={actions}>
          {name !== undefined && <PlacementSideField placement={placement} actions={actions} />}
        </PlacementSettingsCell>
        <PlacementActionsCell placement={placement} otherZones={otherZones} actions={actions} />
      </ContextMenuTrigger>
      <PlacementContextMenuItems placement={placement} otherZones={otherZones} actions={actions} />
    </ContextMenu>
  );
}
