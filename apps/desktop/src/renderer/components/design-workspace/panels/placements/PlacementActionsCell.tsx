import { MoreHorizontal, Trash2 } from "lucide-react";
import type { PlacementSpec, ZoneId } from "@bluewave/ship-design";
import { Button, buttonVariants } from "../../../ui/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu.js";
import { Tip } from "../../../ui/tip.js";
import { cn } from "../../../../lib/utils.js";
import type { PlacementActions } from "./usePlacementsState.js";
import { zoneLabel } from "./placement-helpers.js";

export function PlacementActionsCell({
  placement,
  otherZones,
  actions,
}: {
  readonly placement: PlacementSpec;
  readonly otherZones: readonly ZoneId[];
  readonly actions: Pick<PlacementActions, "duplicate" | "moveTo" | "remove">;
}) {
  return (
    <td className="p-1 @max-xl:col-span-2 @max-xl:justify-self-end">
      <div className="flex items-center gap-1">
        <Tip label={`Remove ${placement.instanceId}`}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${placement.instanceId}`}
            onClick={() => actions.remove(placement)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </Tip>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`More actions for ${placement.instanceId}`}
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => actions.duplicate(placement)}>
              Duplicate
            </DropdownMenuItem>
            {otherZones.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Move to zone</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {otherZones.map((z) => (
                    <DropdownMenuItem key={z} onClick={() => actions.moveTo(placement, z)}>
                      {zoneLabel(z)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={() => actions.remove(placement)}>
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </td>
  );
}
