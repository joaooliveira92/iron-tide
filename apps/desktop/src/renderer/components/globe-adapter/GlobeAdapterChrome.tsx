import { useMemo, useRef, useState } from "react";

import { ChevronDown } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { Registration } from "../ui/slate.js";
import { HeaderToolbar } from "../../shell/screen-header.js";
import { ChartLayersPanel } from "./ChartLayersPanel.js";
import { HarbourBook } from "./HarbourBook.js";
import { MAP_VARIANT_LAYOUT, type MapVariant } from "../world-map/map-variant-layout.js";
import { AreaInspector } from "../world-map/AreaInspector.js";
import { MapControlsPanel } from "../world-map/MapControlsPanel.js";
import { MapLegend } from "../world-map/MapLegend.js";
import { RouteReadout } from "../world-map/RouteReadout.js";
import { readPanelOpen, writePanelOpen } from "../shared/panel-memory.js";
import type { AreaOwnershipRow } from "../world-map/map-a11y.js";
import type { AreaTreeRow } from "../world-map/area-tree.js";
import type { LayerId, MapPrototypeState, RouteReading } from "../world-map/map-state.js";
import type { AreaSummary } from "../world-map/map-state.js";
import type { ProjectionId } from "../world-map/projection.js";
import type { GlobeViewport } from "./adapter-layer-state.js";
import { GlobeFrameMeter, GlobeMinimap, GlobeScaleBar } from "./GlobeAdapterWidgets.js";

export interface GlobeAdapterChromeProps {
  readonly state: MapPrototypeState;
  readonly route: RouteReading | null;
  readonly viewport: GlobeViewport;
  readonly variant: MapVariant;
  readonly treeRows: readonly AreaTreeRow[];
  readonly ownershipRows: readonly AreaOwnershipRow[];
  readonly summary: AreaSummary | null;
  readonly nameFor: (nation: string | null) => string;
  readonly onSelect: (area: string | null) => void;
  readonly onToggleLayer: (layer: LayerId) => void;
  readonly onSetProjection: (projection: ProjectionId) => void;
  readonly onSetCentre: (centre: number) => void;
  readonly onReset: () => void;
  readonly onRecentre: (lon: number, lat: number) => void;
  readonly entityRows?: readonly {
    readonly id: string;
    readonly name: string;
    readonly kind: string;
    readonly areaId: string;
  }[];
  readonly onSelectEntity?: (entity: {
    readonly id: string;
    readonly name: string;
    readonly kind: string;
    readonly areaId: string;
  }) => void;
  readonly showMinimap?: boolean;
  readonly defaultControlsOpen?: boolean;
}

export function GlobeAdapterChrome({
  state,
  route,
  viewport,
  variant,
  treeRows,
  ownershipRows,
  summary,
  nameFor,
  onSelect,
  onToggleLayer,
  onSetProjection,
  onSetCentre,
  onReset,
  onRecentre,
  entityRows = [],
  onSelectEntity,
  showMinimap = true,
  defaultControlsOpen = true,
}: GlobeAdapterChromeProps) {
  const layout = MAP_VARIANT_LAYOUT[variant];
  const [controlsOpen, setControlsOpen] = useState(() =>
    readPanelOpen("globe-adapter-controls", defaultControlsOpen),
  );
  const meterRef = useRef<HTMLSpanElement | null>(null);
  const toggleControls = () => {
    setControlsOpen((open) => {
      writePanelOpen("globe-adapter-controls", !open);
      return !open;
    });
  };

  const docked = variant === "command";
  const [layersOpen, setLayersOpen] = useState(false);
  const [harbourOpen, setHarbourOpen] = useState(false);
  const areaNames = useMemo(
    () => new Map(ownershipRows.map((row) => [row.id, row.name] as const)),
    [ownershipRows],
  );
  const areaName = (areaId: string): string => areaNames.get(areaId) ?? areaId;
  const controlsPanel = (
    <MapControlsPanel
      className={`${layout.controlsPanel} pointer-events-auto`}
      state={state}
      onSetProjection={onSetProjection}
      onToggleLayer={onToggleLayer}
      onSetCentre={onSetCentre}
      onReset={onReset}
      meterRef={meterRef}
      inlineAreas={variant !== "command"}
      treeRows={treeRows}
      onFocusTreeRow={(row) => {
        if (row.mapAreaId !== null) onSelect(row.mapAreaId);
      }}
    />
  );
  const entityList = (
    <nav
      aria-label="Ports and fleets"
      data-testid="globe-adapter-entities"
      className="rounded border border-white/25 bg-black/80 p-2 text-xs text-white"
    >
      <ul className="grid max-h-40 gap-0.5 overflow-y-auto">
        {entityRows.map((entity) => (
          <li
            key={entity.id}
            className="[content-visibility:auto] [contain-intrinsic-size:auto_1.5rem]"
          >
            <button
              type="button"
              className="w-full rounded px-2 py-1 text-left hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={() => onSelectEntity?.(entity)}
            >
              {entity.name} <span className="opacity-70">({entity.kind})</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
  const triggerClass =
    "flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border bg-muted/40 px-2 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <>
      {docked && (
        <HeaderToolbar>
          <Popover open={layersOpen} onOpenChange={setLayersOpen}>
            <PopoverTrigger className={triggerClass}>
              Layers &amp; areas
              <ChevronDown aria-hidden="true" className="size-3 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
              <Registration />
              <ChartLayersPanel
                state={state}
                onSetProjection={onSetProjection}
                onToggleLayer={onToggleLayer}
                onSetCentre={onSetCentre}
                onReset={onReset}
                footer={<GlobeFrameMeter />}
              />
            </PopoverContent>
          </Popover>
          <Popover open={harbourOpen} onOpenChange={setHarbourOpen}>
            <PopoverTrigger className={triggerClass}>
              Ports and fleets
              <ChevronDown aria-hidden="true" className="size-3 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
              <Registration />
              <HarbourBook
                entities={entityRows}
                areaName={areaName}
                onSelect={(entity) => {
                  setHarbourOpen(false);
                  onSelectEntity?.(entity);
                }}
              />
            </PopoverContent>
          </Popover>
        </HeaderToolbar>
      )}
      {!docked && (
        <div className="pointer-events-auto absolute left-[calc(0.75rem+var(--chrome-left,0px))] top-[calc(0.75rem+var(--chrome-top,0px))] z-10 flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={controlsOpen}
            className="w-fit rounded border border-white/40 bg-black/75 px-2 py-1 text-xs text-white"
            onClick={toggleControls}
          >
            Layers &amp; areas
          </button>
          {controlsOpen && controlsPanel}
          <GlobeFrameMeter />
        </div>
      )}

      {!docked && (
        <div className="pointer-events-auto absolute right-[calc(0.75rem+var(--chrome-right,0px))] top-[calc(0.75rem+var(--chrome-top,0px))] z-10 flex max-h-[70%] w-72 flex-col gap-2 overflow-y-auto">
          <AreaInspector
            className="rounded-lg border p-3 text-xs shadow-lg backdrop-blur"
            summary={summary}
            nameFor={nameFor}
            onSelect={onSelect}
          />

          <nav
            aria-label="Map areas"
            data-testid="globe-adapter-area-list"
            className="rounded border border-white/25 bg-black/80 p-2 text-xs text-white"
          >
            <ul className="grid max-h-56 gap-0.5 overflow-y-auto">
              {ownershipRows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-pressed={row.selected}
                    aria-label={`${row.name}: ${row.owner ?? "Unclaimed"}, ${row.fleets} fleets${row.strength === null ? "" : `, ${row.strength}`}`}
                    title={row.name}
                    data-adapter-area={row.id}
                    onClick={() => onSelect(row.id)}
                    className="w-full rounded px-2 py-1 text-left hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-pressed:bg-white aria-pressed:text-black"
                  >
                    {row.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {entityList}
        </div>
      )}

      <div className="sr-only">
        <table data-testid="globe-adapter-area-table">
          <caption>Area control</caption>
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col">Controlled by</th>
              <th scope="col">Fleets</th>
              <th scope="col">Strength</th>
            </tr>
          </thead>
          <tbody>
            {ownershipRows.map((row) => (
              <tr key={row.id} aria-selected={row.selected}>
                <th scope="row">{row.name}</th>
                <td>{row.owner ?? "Unclaimed"}</td>
                <td>{row.fleets}</td>
                <td>{row.strength ?? "No ships"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pointer-events-auto absolute bottom-[calc(0.75rem+var(--chrome-bottom,0px)+var(--chrome-slip,0px))] right-[calc(0.75rem+var(--chrome-right,0px))] z-10 flex flex-col items-end gap-2">
        {showMinimap && <GlobeMinimap viewport={viewport} onRecentre={onRecentre} />}
        <div className="rounded border border-white/25 bg-black/75 px-2.5 py-1.5 text-white">
          <MapLegend showPossessions={state.layers.possessions} showFleets={state.layers.fleets} />
          <GlobeScaleBar zoom={viewport.zoom} />
          <p className="mt-1 text-xs text-white/60">
            Land climate: Köppen-Geiger V3, Beck et al. (2023), CC BY 4.0
          </p>
        </div>
      </div>

      <RouteReadout
        className={`${
          variant === "command"
            ? "absolute bottom-[calc(0.75rem+var(--chrome-bottom,0px)+var(--chrome-slip,0px))] left-1/2 -translate-x-1/2 rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur"
            : layout.routeReadout
        } pointer-events-auto z-10`}
        route={route}
      />
    </>
  );
}
