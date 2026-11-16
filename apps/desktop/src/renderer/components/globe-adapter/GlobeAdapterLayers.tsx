import { useMemo, useRef, useState } from "react";

import { ChevronDown } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { Registration } from "../ui/slate.js";
import { HeaderToolbar } from "../../shell/screen-header.js";
import { ChartLayersPanel } from "./ChartLayersPanel.js";
import { HarbourBook } from "./HarbourBook.js";
import { MAP_VARIANT_LAYOUT, type MapVariant } from "../world-map/map-variant-layout.js";
import { MapControlsPanel } from "../world-map/MapControlsPanel.js";
import { readPanelOpen, writePanelOpen } from "../shared/panel-memory.js";
import type { AreaOwnershipRow } from "../world-map/map-a11y.js";
import type { AreaTreeRow } from "../world-map/area-tree.js";
import type { LayerId, MapPrototypeState } from "../world-map/map-state.js";
import type { ProjectionId } from "../world-map/projection.js";
import { GlobeFrameMeter } from "./GlobeAdapterWidgets.js";
import type { EntityRow, EntitySelection } from "./entity-rows.js";

export interface GlobeAdapterLayersProps {
  readonly state: MapPrototypeState;
  readonly variant: MapVariant;
  readonly treeRows: readonly AreaTreeRow[];
  readonly ownershipRows: readonly AreaOwnershipRow[];
  readonly onSelect: (area: string | null) => void;
  readonly onToggleLayer: (layer: LayerId) => void;
  readonly onSetProjection: (projection: ProjectionId) => void;
  readonly onSetCentre: (centre: number) => void;
  readonly onReset: () => void;
  readonly entityRows?: readonly EntityRow[];
  readonly onSelectEntity?: (entity: EntitySelection) => void;
  readonly defaultControlsOpen?: boolean;
}

export function GlobeAdapterLayers({
  state,
  variant,
  treeRows,
  ownershipRows,
  onSelect,
  onToggleLayer,
  onSetProjection,
  onSetCentre,
  onReset,
  entityRows = [],
  onSelectEntity,
  defaultControlsOpen = true,
}: GlobeAdapterLayersProps) {
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
  const triggerClass =
    "flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border bg-muted/40 px-2 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring";

  if (!docked) {
    return (
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
    );
  }

  return (
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
  );
}
