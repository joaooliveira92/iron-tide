import { Layers, RotateCw } from "lucide-react";
import { Checkbox } from "../../../components/ui/checkbox.js";
import { Button, buttonVariants } from "../../../components/ui/button.js";
import { ButtonGroup } from "../../../components/ui/button-group.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover.js";
import { Slate } from "../../../components/slate/Slate.js";
import { cn } from "../../../lib/utils.js";
import {
  OVERLAY_ORDER,
  SHIP_VIEW_DEFS,
  VIEW_ORDER,
  type ShipOverlay,
  type ShipView,
} from "../../../components/design-workspace/panels/hull-plan/ship-view.js";
import { Tip } from "../../../components/ui/tip.js";
import { Separator } from "../../../components/ui/separator.js";
import {
  FindingsViewOptions,
  type FindingsView,
} from "../../../components/design-workspace/validation/FindingsControl.js";

export type IsoSide = "starboard" | "port";

export interface ViewToolbarProps {
  readonly view: ShipView;
  readonly onView: (view: ShipView) => void;
  readonly overlays: ReadonlySet<ShipOverlay>;
  readonly onToggleOverlay: (overlay: ShipOverlay) => void;
  readonly isoSide: IsoSide;
  readonly onIsoSide: (side: IsoSide) => void;
  readonly findingsView?: FindingsView;
  readonly onFindingsView?: (next: FindingsView) => void;
}

export function ViewToolbar({
  view,
  onView,
  overlays,
  onToggleOverlay,
  isoSide,
  onIsoSide,
  findingsView,
  onFindingsView,
}: ViewToolbarProps) {
  return (
    <Slate className="flex flex-wrap items-center gap-2 p-1.5">
      <ButtonGroup aria-label="Ship view">
        {VIEW_ORDER.map((v, index) => (
          <Tip key={v.id} label={v.hint}>
            <Button
              type="button"
              size="sm"
              variant={view === v.id ? "default" : "outline"}
              aria-pressed={view === v.id}
              aria-keyshortcuts={String(index + 1)}
              onClick={() => onView(v.id)}
            >
              {v.label}
            </Button>
          </Tip>
        ))}
      </ButtonGroup>
      {SHIP_VIEW_DEFS[view].editable && (
        <Popover>
          <PopoverTrigger
            title="Show or hide drawing layers"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Layers aria-hidden="true" className="size-4" />
            Layers
            <span className="text-muted-foreground tabular-nums">
              {overlays.size}/{OVERLAY_ORDER.length}
            </span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <div role="group" aria-label="Overlays" className="flex flex-col gap-1.5">
              {OVERLAY_ORDER.map((o) => (
                <div key={o.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    aria-label={o.label}
                    checked={overlays.has(o.id)}
                    onCheckedChange={() => onToggleOverlay(o.id)}
                  />
                  <span aria-hidden="true">{o.label}</span>
                </div>
              ))}
            </div>
            {findingsView !== undefined && onFindingsView !== undefined && (
              <>
                <Separator className="my-2" />
                <FindingsViewOptions
                  className="flex-col items-stretch gap-2"
                  view={findingsView}
                  onChange={onFindingsView}
                />
              </>
            )}
          </PopoverContent>
        </Popover>
      )}
      {view === "iso" && (
        <Tip label="Turn the ship to show its other side">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onIsoSide(isoSide === "starboard" ? "port" : "starboard")}
          >
            <RotateCw aria-hidden="true" className="mr-1 size-4" />
            {isoSide === "starboard" ? "Starboard side" : "Port side"}
          </Button>
        </Tip>
      )}
    </Slate>
  );
}
