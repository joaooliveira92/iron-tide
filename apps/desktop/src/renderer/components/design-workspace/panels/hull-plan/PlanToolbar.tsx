import type { DesignDraft, MountSide, PartCatalogueEntry } from "@bluewave/ship-design";
import { Move, SquarePlus, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../../ui/hover-card.js";
import { componentCategoryMeta } from "../../componentCategory.js";
import { SelectField } from "../../fields.js";
import { hasSide, NUDGE_PERMILLE } from "./placement-tools.js";
import { type PlanTool, type PlanToolMode } from "./plan-tool.js";

export { IDLE_TOOL, type PlanTool, type PlanToolMode } from "./plan-tool.js";

const isMountSide = (v: string): v is MountSide => v === "CENTRE" || v === "PORT" || v === "STBD";

type ToolMode = Extract<PlanToolMode, "place" | "move">;

/** The two plan tools. Each is one button: pressing it turns the tool on and opens its picker; pressing it again turns it off. */
const MODES: readonly {
  readonly mode: ToolMode;
  readonly name: string;
  readonly label: string;
  readonly Icon: LucideIcon;
  /** How to use the tool, shown on hover of the button (so the drawing's status line stays for notices). */
  readonly hint?: string;
}[] = [
  {
    mode: "place",
    name: "Place on plan",
    label: "Place",
    Icon: SquarePlus,
    hint: "Choose a component in the Place menu, then click the plan (near the centreline places it on the centreline, above port, below starboard), or use Auto-place there.",
  },
  { mode: "move", name: "Move on plan", label: "Move", Icon: Move },
];

/**
 * The plan tool switches, shown in the board toolbar. Each is a single button that both switches the tool on and
 * opens its picker; pressing it again turns the tool off. The drawing itself picks up the mode and shows the rest
 * of its options.
 */
export function PlanModeButtons({
  tool,
  onTool,
  draft,
  available,
  entryOf,
  onAutoPlace,
}: {
  readonly tool: PlanTool;
  readonly onTool: (next: PlanTool) => void;
  readonly draft: DesignDraft;
  /** Family-level catalogue entries that can be fitted this month. */
  readonly available: readonly PartCatalogueEntry[];
  readonly entryOf: (componentId: string) => PartCatalogueEntry | undefined;
  /** Places the chosen component at the most level legal station (place menu). */
  readonly onAutoPlace: () => void;
}) {
  const [open, setOpen] = useState<ToolMode | null>(null);
  const activate = (mode: ToolMode) => {
    if (tool.mode !== mode) onTool({ ...tool, mode });
    setOpen(mode);
  };
  const deactivate = () => {
    onTool({ ...tool, mode: "off" });
    setOpen(null);
  };
  return (
    <>
      {MODES.map(({ mode, name, label, Icon, hint }) => {
        const active = tool.mode === mode;
        const trigger = (
          <Button
            variant={active ? "default" : "outline"}
            aria-label={name}
            aria-pressed={active}
          />
        );
        const face = (
          <>
            <Icon aria-hidden="true" />
            {label}
          </>
        );
        return (
          <Popover
            key={mode}
            open={open === mode}
            onOpenChange={(next, details) => {
              if (details.reason === "trigger-press") {
                // The button is the tool's switch and its picker: it turns the tool on (and opens the picker), and
                // turns it off again when it is already on.
                if (tool.mode === mode) deactivate();
                else activate(mode);
                return;
              }
              // Any other close (Escape, a click on the drawing, the other menu) hides the picker but keeps the mode.
              if (!next) setOpen((current) => (current === mode ? null : current));
            }}
          >
            {hint === undefined ? (
              <PopoverTrigger render={trigger}>{face}</PopoverTrigger>
            ) : (
              <HoverCard>
                <HoverCardTrigger render={<PopoverTrigger render={trigger} />}>
                  {face}
                </HoverCardTrigger>
                <HoverCardContent className="w-72">{hint}</HoverCardContent>
              </HoverCard>
            )}
            <PopoverContent align="start" aria-label={name} className="w-72 space-y-3 text-sm">
              <div className="font-medium">{name}</div>
              <PlanToolPicker
                tool={tool}
                draft={draft}
                available={available}
                entryOf={entryOf}
                onChange={(next) => {
                  onTool(next);
                  // The place menu keeps its Auto-place action in view; the move menu's controls live on the panel,
                  // so only the move menu closes on a choice (the drawing stays reachable).
                  if (mode === "move") setOpen(null);
                }}
              />
              {mode === "place" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={tool.componentId === ""}
                  onClick={() => {
                    onAutoPlace();
                    setOpen(null);
                  }}
                  title="Place it where the ship stays most level"
                >
                  Auto-place
                </Button>
              )}
            </PopoverContent>
          </Popover>
        );
      })}
    </>
  );
}

/** The picker for the active mode, rendered inside the toolbar menu: the component to place, or the fitting to move. */
function PlanToolPicker({
  tool,
  draft,
  available,
  entryOf,
  onChange,
}: {
  readonly tool: PlanTool;
  readonly draft: DesignDraft;
  readonly available: readonly PartCatalogueEntry[];
  readonly entryOf: (componentId: string) => PartCatalogueEntry | undefined;
  readonly onChange: (next: PlanTool) => void;
}) {
  if (tool.mode === "place")
    return (
      <SelectField
        label="Component to place"
        value={tool.componentId}
        options={[
          { value: "", label: "Choose a component" },
          ...available.map((c) => {
            const { icon: Icon, description } = componentCategoryMeta(c.category);
            return {
              value: c.id,
              label: c.displayName,
              icon: <Icon aria-hidden="true" className="size-4" />,
              description,
            };
          }),
        ]}
        onChange={(componentId) => onChange({ ...tool, componentId })}
      />
    );
  if (tool.mode === "move")
    return (
      <SelectField
        label="Fitting to move"
        value={tool.instanceId}
        options={[
          { value: "", label: "Choose a fitting" },
          ...draft.placements.map((p) => {
            const entry = entryOf(p.componentId);
            const { icon: Icon, description } = componentCategoryMeta(entry?.category ?? "");
            return {
              value: p.instanceId,
              label: `${entry?.displayName ?? p.componentId} (${p.instanceId})`,
              icon: <Icon aria-hidden="true" className="size-4" />,
              description,
            };
          }),
        ]}
        onChange={(instanceId) => onChange({ ...tool, instanceId })}
      />
    );
  return null;
}

/**
 * The keyboard-reachable actions of the active plan tool, shown on the drawing: the nudge and side controls (move
 * mode), plus the notice for the last click or drag. The picker and Auto-place live in the toolbar menu.
 */
export function PlanToolOptions({
  tool,
  draft,
  entryOf,
  onNudge,
  onSide,
  notice,
}: {
  readonly tool: PlanTool;
  readonly draft: DesignDraft;
  readonly entryOf: (componentId: string) => PartCatalogueEntry | undefined;
  readonly onNudge: (deltaPermille: number) => void;
  readonly onSide: (side: MountSide) => void;
  readonly notice: string | null;
}) {
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
      {/* With nothing chosen, the guidance is the Place button's hover tooltip, so the status line stays quiet. */}
      <p role="status" className="min-h-4 text-xs text-muted-foreground">
        {notice ??
          (tool.mode === "place"
            ? tool.componentId === ""
              ? null
              : "Click the plan to place it. Stations snap to 10‰."
            : tool.mode === "move"
              ? "Click a fitting on the plan (or choose it above), then click where it should go or drag it there."
              : "Use the Place and Move tools in the toolbar to edit the arrangement from this drawing.")}
      </p>
    </div>
  );
}
