import type { DesignDraft, MountSide, PartCatalogueEntry } from "@bluewave/ship-design";
import { X } from "lucide-react";
import { cn } from "../../../../lib/utils.js";
import { Button } from "../../../ui/button.js";
import { SelectField } from "../../fields.js";
import { hasSide, NUDGE_PERMILLE } from "./placement-tools.js";
import { type PlanTool } from "./plan-tool.js";

export { IDLE_TOOL, type PlanTool, type PlanToolMode } from "./plan-tool.js";

const isMountSide = (v: string): v is MountSide => v === "CENTRE" || v === "PORT" || v === "STBD";

/**
 * The keyboard-reachable actions of the active plan tool, shown on the drawing: the nudge and side controls (move
 * mode), plus the notice for the last click or drag. The picker and Auto-place live in the plan's context menu.
 */
export function PlanToolOptions({
  tool,
  draft,
  entryOf,
  onNudge,
  onSide,
  notice,
  onDone,
}: {
  readonly tool: PlanTool;
  readonly draft: DesignDraft;
  readonly entryOf: (componentId: string) => PartCatalogueEntry | undefined;
  readonly onNudge: (deltaPermille: number) => void;
  readonly onSide: (side: MountSide) => void;
  readonly notice: string | null;
  /** Turns the active tool off (the "Done" button of the active-tool banner); omitted, no button is shown. */
  readonly onDone?: () => void;
}) {
  const active = tool.mode !== "off";
  const selected = draft.placements.find((p) => p.instanceId === tool.instanceId);
  const selectedEntry = selected ? entryOf(selected.componentId) : undefined;
  return (
    <div className="space-y-2" role="group" aria-label="Plan tool options">
      {tool.mode === "move" && selected !== undefined && (
        <div className="flex flex-wrap items-end gap-2">
          {(
            [
              -NUDGE_PERMILLE.large,
              -NUDGE_PERMILLE.step,
              NUDGE_PERMILLE.step,
              NUDGE_PERMILLE.large,
            ] as const
          ).map((delta) => (
            <Button
              key={delta}
              variant="outline"
              size="sm"
              aria-label={`Move ${Math.abs(delta)} permille ${delta < 0 ? "toward the bow" : "toward the stern"}`}
              onClick={() => onNudge(delta)}
            >
              {delta < 0 ? "◀" : ""} {Math.abs(delta)}‰ {delta > 0 ? "▶" : ""}
            </Button>
          ))}
          {hasSide(selectedEntry) && (
            <SelectField
              className="w-36"
              label="Side of the selected fitting"
              shortLabel="Side"
              value={selected.side ?? "CENTRE"}
              options={[
                { value: "CENTRE", label: "Centreline" },
                { value: "PORT", label: "Port" },
                { value: "STBD", label: "Starboard" },
              ]}
              onChange={(v) => {
                if (isMountSide(v)) onSide(v);
              }}
            />
          )}
        </div>
      )}
      <div
        className={cn(
          "flex min-h-8 items-center gap-2 rounded-md px-2 text-xs",
          active
            ? "border border-primary/40 bg-primary/10 text-foreground"
            : "text-muted-foreground",
        )}
      >
        {active && (
          <span className="shrink-0 font-semibold">
            {tool.mode === "place" ? "Placing" : "Moving"}
          </span>
        )}
        <p role="status" className="min-w-0 flex-1">
          {notice ??
            (tool.mode === "place"
              ? tool.componentId === ""
                ? "Right-click the plan, then Place, to choose a component and click the plan to drop it."
                : "Click the plan to place it. Stations snap to 10‰."
              : tool.mode === "move"
                ? "Click a fitting on the plan (or choose it from the plan's Move menu), then click where it should go or drag it there."
                : "Right-click the plan to place or move fittings.")}
        </p>
        {active && onDone !== undefined && (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onDone}>
            <X aria-hidden="true" />
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
