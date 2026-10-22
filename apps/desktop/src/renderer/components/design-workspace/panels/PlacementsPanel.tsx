import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  ZONE_IDS,
  type ComponentCategory,
  type DesignDraft,
  type MountSide,
  type PartCatalogueEntry,
  type PlacementSpec,
  type WorkshopView,
  type ZoneId,
} from "@bluewave/ship-design";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../../ui/context-menu.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../ui/hover-card.js";
import { buttonVariants } from "../../ui/button.js";
import { cn } from "../../../lib/utils.js";
import { KG_PER_TONNE } from "../../../lib/presentation-format/index.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { componentFacts, componentsByCategory } from "../componentFacts.js";
import type { DrawingBoardContent } from "../content.js";
import { NumberField, SelectField } from "../fields.js";
import { Panel } from "./Panel.js";
import type { Edit } from "./types.js";
import { placementAttrs } from "../selection/navigation.js";

const zoneLabel = (z: string) => z.replaceAll("_", " ").toLowerCase();

function midStation(content: DrawingBoardContent, draft: DesignDraft, zone: ZoneId): number {
  const z = content.hullForms
    .find((f) => f.id === draft.hull.hullFormId)
    ?.zones.find((q) => q.id === zone);
  return z ? Math.floor((z.startPermille + z.endPermille) / 2) : 500;
}

function ComponentHover({
  entry,
  placement,
  view,
  onSelect,
  selected,
}: {
  readonly entry: PartCatalogueEntry | undefined;
  readonly placement: PlacementSpec;
  readonly view: WorkshopView;
  readonly onSelect?: () => void;
  readonly selected?: boolean;
}) {
  const format = usePresentationFormat();
  if (!entry) return <span>{placement.componentId}</span>;
  const facts = componentFacts(
    entry,
    view.compiled.components.find((c) => c.instanceId === placement.instanceId),
  );
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={onSelect === undefined ? undefined : selected === true}
          />
        }
        className={cn(
          "cursor-help text-left underline decoration-dotted underline-offset-2",
          selected === true && "font-medium text-foreground",
        )}
      >
        {facts.name}
      </HoverCardTrigger>
      <HoverCardContent className="space-y-2 text-sm">
        <div className="font-medium">{facts.name}</div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{facts.category}</Badge>
          {facts.tags.map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 tabular-nums">
          <dt className="text-muted-foreground">Available from</dt>
          <dd className="text-right">{facts.introduced}</dd>
          {facts.obsolete !== null && (
            <>
              <dt className="text-muted-foreground">Obsolete from</dt>
              <dd className="text-right">{facts.obsolete}</dd>
            </>
          )}
          {facts.placed !== null && (
            <>
              <dt className="text-muted-foreground">Weight as fitted</dt>
              <dd className="text-right">
                {format.measurement(facts.placed.weightT * KG_PER_TONNE, "mass", {
                  maximumFractionDigits: 1,
                })}
              </dd>
              <dt className="text-muted-foreground">Cost as fitted</dt>
              <dd className="text-right">{format.money(facts.placed.costGbp)}</dd>
            </>
          )}
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}

const isMountSide = (v: string): v is MountSide => v === "CENTRE" || v === "PORT" || v === "STBD";

export function PlacementsPanel({
  draft,
  content,
  month,
  view,
  names,
  edit,
  categories,
  title = "Components and arrangement",
  onSelect,
  selectedInstanceId,
}: {
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly month: string;
  readonly view: WorkshopView;
  readonly names: ReadonlyMap<string, string>;
  readonly edit: Edit;
  readonly categories?: ReadonlySet<ComponentCategory>;
  readonly title?: string;
  readonly onSelect?: (instanceId: string) => void;
  readonly selectedInstanceId?: string | null;
}) {
  const catalogueById = new Map(content.catalogue.map((e) => [e.id, e]));
  const shown = (entry: PartCatalogueEntry | undefined) =>
    categories === undefined || (entry !== undefined && categories.has(entry.category));
  const placements = draft.placements.filter((p) => shown(catalogueById.get(p.componentId)));
  const catalogue = content.catalogue.filter((e) => shown(e));
  const [zoneId, setZoneId] = useState<ZoneId>("SUPERSTRUCTURE");
  const nextId = (componentId: string) => {
    let n = 1;
    while (draft.placements.some((p) => p.instanceId === `${componentId}_${n}`)) n++;
    return `${componentId}_${n}`;
  };
  const zonesFor = (entry: PartCatalogueEntry | undefined) =>
    (entry?.allowedZones as ZoneId[] | undefined) ?? [...ZONE_IDS];
  const add = (entry: PartCatalogueEntry) => {
    const zones = zonesFor(entry);
    const zone = zones.includes(zoneId) ? zoneId : zones[0]!;
    edit({
      kind: "add_placement",
      placement: {
        instanceId: nextId(entry.id),
        componentId: entry.id,
        zoneId: zone,
        stationPermille: midStation(content, draft, zone),
      },
    });
  };
  const duplicate = (p: PlacementSpec) =>
    edit({ kind: "add_placement", placement: { ...p, instanceId: nextId(p.componentId) } });
  const moveTo = (p: PlacementSpec, zone: ZoneId) =>
    edit({
      kind: "move_placement",
      instanceId: p.instanceId,
      zoneId: zone,
      stationPermille: midStation(content, draft, zone),
    });
  const remove = (p: PlacementSpec) => edit({ kind: "remove_placement", instanceId: p.instanceId });

  return (
    <Panel title={title}>
      <div className="@container overflow-x-auto">
        <table role="table" className="w-full table-fixed text-sm @max-xl:block">
          <thead role="rowgroup" className="@max-xl:sr-only">
            <tr role="row" className="text-left text-xs text-muted-foreground">
              <th role="columnheader" className="w-[30%] p-1">
                Fitting
              </th>
              <th className="w-24 p-1">Zone</th>
              <th className="w-20 p-1">Station</th>
              <th className="p-1">Settings</th>
              <th className="w-20 p-1">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup" className="@max-xl:block">
            {placements.map((p) => {
              const d = catalogueById.get(p.componentId);
              const otherZones = zonesFor(d).filter((z) => z !== p.zoneId);
              return (
                <ContextMenu key={p.instanceId}>
                  <ContextMenuTrigger
                    render={
                      <tr
                        role="row"
                        className="border-t align-top @max-xl:grid @max-xl:grid-cols-2 @max-xl:items-start @max-xl:gap-x-2 @max-xl:py-2"
                        {...placementAttrs(p.instanceId)}
                      />
                    }
                  >
                    <th scope="row" className="p-1 text-left font-normal @max-xl:col-span-2">
                      <ComponentHover
                        entry={catalogueById.get(p.componentId)}
                        placement={p}
                        view={view}
                        onSelect={onSelect === undefined ? undefined : () => onSelect(p.instanceId)}
                        selected={selectedInstanceId === p.instanceId}
                      />
                      <div className="text-xs text-muted-foreground">
                        {names.has(p.instanceId) && (
                          <Badge variant="secondary" className="mr-1">
                            {names.get(p.instanceId)}
                          </Badge>
                        )}
                        {p.instanceId}
                      </div>
                    </th>
                    <td className="p-1">
                      <Badge variant="outline">{zoneLabel(p.zoneId)}</Badge>
                    </td>
                    <td className="w-20 p-1 @max-xl:w-auto">
                      <NumberField
                        label={`Station of ${p.instanceId}`}
                        shortLabel="Station"
                        unit="‰"
                        value={p.stationPermille}
                        onCommit={(v) =>
                          edit({
                            kind: "move_placement",
                            instanceId: p.instanceId,
                            zoneId: p.zoneId,
                            stationPermille: v,
                          })
                        }
                      />
                    </td>
                    <td className="p-1 @max-xl:col-span-2">
                      <div className="flex flex-wrap gap-2">
                        {names.has(p.instanceId) && (
                          <SelectField
                            className="w-36"
                            label={`Side of ${p.instanceId}`}
                            shortLabel="Side"
                            value={p.side ?? "CENTRE"}
                            options={[
                              { value: "CENTRE", label: "Centreline" },
                              { value: "PORT", label: "Port" },
                              { value: "STBD", label: "Starboard" },
                            ]}
                            onChange={(v) => {
                              if (isMountSide(v))
                                edit({ kind: "set_side", instanceId: p.instanceId, side: v });
                            }}
                          />
                        )}
                        {Object.entries(d?.parameters ?? {}).map(([name, r]) => (
                          <NumberField
                            key={name}
                            className="w-24"
                            label={`${name} of ${p.instanceId}`}
                            shortLabel={name}
                            min={r.min}
                            max={r.max}
                            step={r.step}
                            value={p.params?.[name] ?? r.min}
                            onCommit={(v) =>
                              edit({
                                kind: "set_param",
                                instanceId: p.instanceId,
                                param: name,
                                value: v,
                              })
                            }
                          />
                        ))}
                      </div>
                    </td>
                    <td className="p-1 @max-xl:col-span-2 @max-xl:justify-self-end">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${p.instanceId}`}
                          title={`Remove ${p.instanceId}`}
                          onClick={() => remove(p)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={`More actions for ${p.instanceId}`}
                            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => duplicate(p)}>
                              Duplicate
                            </DropdownMenuItem>
                            {otherZones.length > 0 && (
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Move to zone</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {otherZones.map((z) => (
                                    <DropdownMenuItem key={z} onClick={() => moveTo(p, z)}>
                                      {zoneLabel(z)}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive onClick={() => remove(p)}>
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => duplicate(p)}>Duplicate</ContextMenuItem>
                    {otherZones.length > 0 && (
                      <ContextMenuSub>
                        <ContextMenuSubTrigger>Move to zone</ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                          {otherZones.map((z) => (
                            <ContextMenuItem key={z} onClick={() => moveTo(p, z)}>
                              {zoneLabel(z)}
                            </ContextMenuItem>
                          ))}
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem destructive onClick={() => remove(p)}>
                      Remove
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-t pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "default" }))}>
            Add component
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-96 overflow-y-auto">
            {componentsByCategory(catalogue).map((g, i) => (
              <DropdownMenuGroup key={g.category}>
                {i > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>{g.category}</DropdownMenuLabel>
                {g.items.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    disabled={c.introduction.fromMonth > month}
                    onClick={() => add(c)}
                  >
                    {c.displayName}
                    {c.introduction.fromMonth > month && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        from {c.introduction.fromMonth}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <SelectField
          className="min-w-44"
          label="Add to zone"
          value={zoneId}
          options={ZONE_IDS.map((z) => ({ value: z, label: zoneLabel(z) }))}
          onChange={(v) => setZoneId(v as ZoneId)}
        />
      </div>
    </Panel>
  );
}
