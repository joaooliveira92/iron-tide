import { useEffect, useMemo, useRef, useState } from "react";

import { ChevronDown } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { Registration } from "../ui/slate.js";
import { HeaderToolbar } from "../../shell/screen-header.js";
import { ChartLayersPanel } from "./ChartLayersPanel.js";
import { HarbourBook } from "./HarbourBook.js";
import { AREAS } from "../world-map/map-geometry.js";
import { MAP_VARIANT_LAYOUT, type MapVariant } from "../world-map/map-variant-layout.js";
import { AreaInspector } from "../world-map/AreaInspector.js";
import { MapControlsPanel } from "../world-map/MapControlsPanel.js";
import { MapLegend } from "../world-map/MapLegend.js";
import { RouteReadout } from "../world-map/RouteReadout.js";
import { useFrameMeter } from "../world-map/useFrameMeter.js";
import { readPanelOpen, writePanelOpen } from "../shared/panel-memory.js";
import { formatFixed } from "../../lib/presentation-format/index.js";
import type { AreaOwnershipRow } from "../world-map/map-a11y.js";
import type { AreaTreeRow } from "../world-map/area-tree.js";
import type { LayerId, MapPrototypeState, RouteReading } from "../world-map/map-state.js";
import type { AreaSummary } from "../world-map/map-state.js";
import type { ProjectionId } from "../world-map/projection.js";
import {
  minimapToLatitude,
  minimapToLongitude,
  minimapViewportRect,
  scaleBarForZoom,
  type GlobeViewport,
} from "./adapter-layer-state.js";

const MINIMAP_WIDTH = 176;
const MINIMAP_HEIGHT = 88;

function worldPath(): string {
  let path = "";
  for (const area of AREAS) {
    let first = true;
    for (const [lon, lat] of area.ring) {
      const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
      const x = ((wrapped + 180) / 360) * MINIMAP_WIDTH;
      const y = ((90 - Math.max(-90, Math.min(90, lat))) / 180) * MINIMAP_HEIGHT;
      path += `${first ? "M" : "L"}${formatFixed(x, { locale: "en-US", digits: 1 })} ${formatFixed(y, { locale: "en-US", digits: 1 })}`;
      first = false;
    }
    path += "Z";
  }
  return path;
}

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
  readonly showAreas?: boolean;
  readonly defaultControlsOpen?: boolean;
}

function GlobeMinimap({
  viewport,
  onRecentre,
}: {
  readonly viewport: GlobeViewport;
  readonly onRecentre: (lon: number, lat: number) => void;
}) {
  const path = useMemo(worldPath, []);
  const rect = minimapViewportRect(viewport, MINIMAP_WIDTH, MINIMAP_HEIGHT);
  return (
    <svg
      aria-label="World minimap. Choose a point to recentre the map."
      role="img"
      data-testid="globe-adapter-minimap"
      className="cursor-crosshair touch-none rounded-md border border-white/30"
      style={{ background: "#00cce0", width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`}
      onPointerDown={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        onRecentre(
          minimapToLongitude(event.clientX - box.left, box.width),
          minimapToLatitude(event.clientY - box.top, box.height),
        );
      }}
    >
      <path d={path} fill="#fcf4f0" fillOpacity={1} />
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="#5fc0ff"
        fillOpacity={0.16}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    </svg>
  );
}

export function GlobeScaleBar({ zoom }: { readonly zoom: number }) {
  const bar = scaleBarForZoom(zoom, 140);
  return (
    <div className="pointer-events-none flex flex-col items-start gap-0.5" aria-hidden="true">
      <span className="text-xs tabular-nums text-white/80">{bar.nauticalMiles} nm</span>
      <div
        className="h-1.5 border-x border-b border-white/70"
        style={{ width: `${Math.round(bar.pixels)}px` }}
      />
    </div>
  );
}

function GlobeFrameMeter() {
  const meterRef = useRef<HTMLSpanElement | null>(null);
  const meter = useFrameMeter(meterRef);
  const { sample } = meter;
  useEffect(() => {
    let frame = requestAnimationFrame(function tick() {
      sample();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [sample]);
  return (
    <span
      ref={meterRef}
      data-testid="globe-adapter-frame-meter"
      className="font-mono text-xs tabular-nums text-white/70"
    />
  );
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
  showAreas = true,
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
      inlineAreas={showAreas}
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
          <li key={entity.id}>
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
          {showAreas && (
            <AreaInspector
              className="rounded-lg border p-3 text-xs shadow-lg backdrop-blur"
              summary={summary}
              nameFor={nameFor}
              onSelect={onSelect}
            />
          )}

          {showAreas && (
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
          )}

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
