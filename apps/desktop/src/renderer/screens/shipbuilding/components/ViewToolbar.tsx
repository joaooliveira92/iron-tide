import { Checkbox } from "../../../components/ui/checkbox.js";
import { Layers } from "lucide-react";
import { Button, buttonVariants } from "../../../components/ui/button.js";
import { ButtonGroup } from "../../../components/ui/button-group.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover.js";
import { cn } from "../../../lib/utils.js";
import {
  OVERLAY_ORDER,
  VIEW_ORDER,
  type ShipOverlay,
  type ShipView,
} from "../../../components/design-workspace/panels/hull-plan/ship-view.js";

export interface ViewToolbarProps {
  readonly view: ShipView;
  readonly onView: (view: ShipView) => void;
  readonly overlays: ReadonlySet<ShipOverlay>;
  readonly onToggleOverlay: (overlay: ShipOverlay) => void;
}

export function ViewToolbar({ view, onView, overlays, onToggleOverlay }: ViewToolbarProps) {
  return (
    <>
      <ButtonGroup aria-label="Ship view">
        {VIEW_ORDER.map((v) => (
          <Button
            key={v.id}
            type="button"
            size="sm"
            variant={view === v.id ? "default" : "outline"}
            aria-pressed={view === v.id}
            title={v.hint}
            onClick={() => onView(v.id)}
          >
            {v.label}
          </Button>
        ))}
      </ButtonGroup>
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
        <PopoverContent align="start" className="w-56 p-2">
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
        </PopoverContent>
      </Popover>
    </>
  );
}
