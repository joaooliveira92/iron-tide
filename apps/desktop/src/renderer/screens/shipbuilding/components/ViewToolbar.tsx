import { Checkbox } from "../../../components/ui/checkbox.js";
import { Button } from "../../../components/ui/button.js";
import {
  OVERLAY_ORDER,
  VIEW_ORDER,
  type ShipOverlay,
  type ShipView,
} from "../../../components/design-workspace/panels/hull-plan/ship-view.js";

export interface ViewToolbarProps {
  readonly view: ShipView;
  /** Switches the drawing; the chosen view's overlays are turned on and the others off. */
  readonly onView: (view: ShipView) => void;
  readonly overlays: ReadonlySet<ShipOverlay>;
  /** Switches one overlay, leaving every other exactly as it was. */
  readonly onToggleOverlay: (overlay: ShipOverlay) => void;
}

/**
 * The central workspace's controls: the view selector above the drawing and the independent overlay toggles
 * beside it. Presentation only; the drawing reads their values.
 */
export function ViewToolbar({ view, onView, overlays, onToggleOverlay }: ViewToolbarProps) {
  return (
    <>
      <div role="group" aria-label="Ship view" className="flex flex-wrap items-center gap-1">
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
      </div>
      <div
        role="group"
        aria-label="Overlays"
        className="flex flex-wrap items-center gap-x-3 gap-y-1"
      >
        {OVERLAY_ORDER.map((o) => (
          <div key={o.id} className="flex items-center gap-1.5 text-xs">
            <Checkbox
              aria-label={o.label}
              checked={overlays.has(o.id)}
              onCheckedChange={() => onToggleOverlay(o.id)}
            />
            <span aria-hidden="true">{o.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
