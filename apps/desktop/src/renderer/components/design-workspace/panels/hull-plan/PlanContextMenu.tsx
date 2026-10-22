import { useState, type ReactNode } from "react";
import type { DesignDraft, PartCatalogueEntry } from "@bluewave/ship-design";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../../../ui/context-menu.js";
import { componentCategoryMeta } from "../../componentCategory.js";
import type { PlanTool } from "./plan-tool.js";

const words = (s: string) => {
  const spaced = s.replaceAll("_", " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const SCROLLING = "max-h-80 overflow-y-auto";

function byCategory(available: readonly PartCatalogueEntry[]) {
  const groups = new Map<string, PartCatalogueEntry[]>();
  for (const entry of available)
    groups.set(entry.category, [...(groups.get(entry.category) ?? []), entry]);
  return [...groups]
    .map(([category, entries]) => ({
      category,
      label: words(category),
      entries: [...entries].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function PlanContextMenu({
  tool,
  onTool,
  draft,
  available,
  entryOf,
  onAutoPlace,
  fittingAt,
  children,
}: {
  readonly tool: PlanTool;
  readonly onTool: (next: PlanTool) => void;
  readonly draft: Pick<DesignDraft, "placements">;
  readonly available: readonly PartCatalogueEntry[];
  readonly entryOf: (componentId: string) => PartCatalogueEntry | undefined;
  readonly onAutoPlace: () => void;
  readonly fittingAt: (clientX: number, clientY: number) => string | null;
  readonly children: ReactNode;
}) {
  const [under, setUnder] = useState<string | null>(null);
  const underPlacement = draft.placements.find((p) => p.instanceId === under);
  const fittingLabel = (instanceId: string, componentId: string) =>
    `${entryOf(componentId)?.displayName ?? componentId} (${instanceId})`;
  const chosen = entryOf(tool.componentId);
  const active = tool.mode !== "off";
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            tabIndex={0}
            role="group"
            aria-label="Ship plan. Open the context menu to place or move fittings."
            className="rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onContextMenuCapture={(e) => setUnder(fittingAt(e.clientX, e.clientY))}
          />
        }
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-56">
        {underPlacement !== undefined && (
          <>
            <ContextMenuGroup>
              <ContextMenuLabel>
                {fittingLabel(underPlacement.instanceId, underPlacement.componentId)}
              </ContextMenuLabel>
              <ContextMenuItem
                onClick={() =>
                  onTool({ ...tool, mode: "move", instanceId: underPlacement.instanceId })
                }
              >
                Move this fitting
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuSub>
          <ContextMenuSubTrigger>Place</ContextMenuSubTrigger>
          <ContextMenuSubContent className={SCROLLING}>
            {available.length === 0 && (
              <ContextMenuItem disabled>Nothing can be fitted this month</ContextMenuItem>
            )}
            {byCategory(available).map((group) => (
              <ContextMenuSub key={group.category}>
                <ContextMenuSubTrigger>{group.label}</ContextMenuSubTrigger>
                <ContextMenuSubContent className={SCROLLING}>
                  {group.entries.map((entry) => {
                    const { icon: Icon } = componentCategoryMeta(entry.category);
                    return (
                      <ContextMenuItem
                        key={entry.id}
                        onClick={() => onTool({ ...tool, mode: "place", componentId: entry.id })}
                      >
                        <Icon aria-hidden="true" className="size-4" />
                        {entry.displayName}
                      </ContextMenuItem>
                    );
                  })}
                </ContextMenuSubContent>
              </ContextMenuSub>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem
          disabled={tool.mode !== "place" || chosen === undefined}
          onClick={onAutoPlace}
          title="Place the chosen component where the ship stays most level"
        >
          {chosen !== undefined && tool.mode === "place"
            ? `Auto-place ${chosen.displayName}`
            : "Auto-place"}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Move</ContextMenuSubTrigger>
          <ContextMenuSubContent className={SCROLLING}>
            {draft.placements.length === 0 && (
              <ContextMenuItem disabled>No fittings yet</ContextMenuItem>
            )}
            {draft.placements.map((p) => (
              <ContextMenuItem
                key={p.instanceId}
                onClick={() => onTool({ ...tool, mode: "move", instanceId: p.instanceId })}
              >
                {fittingLabel(p.instanceId, p.componentId)}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        {active && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onTool({ ...tool, mode: "off" })}>
              {tool.mode === "place" ? "Stop placing" : "Stop moving"}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
