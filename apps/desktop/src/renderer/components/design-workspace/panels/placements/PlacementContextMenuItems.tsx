import type { PlacementSpec, ZoneId } from "@bluewave/ship-design";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "../../../ui/context-menu.js";
import type { PlacementActions } from "./usePlacementsState.js";
import { zoneLabel } from "./placement-helpers.js";

export function PlacementContextMenuItems({
  placement,
  otherZones,
  actions,
}: {
  readonly placement: PlacementSpec;
  readonly otherZones: readonly ZoneId[];
  readonly actions: Pick<PlacementActions, "duplicate" | "moveTo" | "remove">;
}) {
  return (
    <ContextMenuContent>
      <ContextMenuItem onClick={() => actions.duplicate(placement)}>Duplicate</ContextMenuItem>
      {otherZones.length > 0 && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>Move to zone</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {otherZones.map((z) => (
              <ContextMenuItem key={z} onClick={() => actions.moveTo(placement, z)}>
                {zoneLabel(z)}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem destructive onClick={() => actions.remove(placement)}>
        Remove
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
