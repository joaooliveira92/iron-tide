import { useState, type ReactNode } from "react";

import { cn } from "../../lib/utils.js";
import { CollapsiblePanel } from "../shared/CollapsiblePanel.js";
import { Button } from "../ui/button.js";
import { AreaInspector } from "./AreaInspector.js";
import { AreaTreePanel } from "./AreaTreePanel.js";
import { MapControlsPanel } from "./MapControlsPanel.js";
import { RouteReadout } from "./RouteReadout.js";
import type { AreaTreeRow } from "./area-tree.js";
import type { MapViewProps } from "./map-contract.js";
import { MAP_VARIANT_LAYOUT, type MapVariant } from "./map-variant-layout.js";
import type { MapCamera } from "./useMapCamera.js";
import type { WorldMapModel } from "./useWorldMapModel.js";

export interface MapDocksProps extends Pick<
  MapViewProps,
  "state" | "route" | "onSelect" | "onToggleLayer" | "onSetProjection" | "onSetCentre"
> {
  readonly variant: MapVariant;
  readonly camera: MapCamera;
  readonly model: WorldMapModel;
  readonly leftPanels?: ReactNode;
  readonly rightPanels?: ReactNode;
  readonly treeDefaultOpen: boolean;
  readonly onFocusArea: (id: string) => void;
}

export function MapDocks({
  variant,
  camera,
  model,
  state,
  route,
  onSelect,
  onToggleLayer,
  onSetProjection,
  onSetCentre,
  leftPanels,
  rightPanels,
  treeDefaultOpen,
  onFocusArea,
}: MapDocksProps) {
  const layout = MAP_VARIANT_LAYOUT[variant];
  const [toolsOpen, setToolsOpen] = useState(false);

  function focusTreeRow(row: AreaTreeRow): void {
    if (row.mapAreaId !== null) onFocusArea(row.mapAreaId);
  }

  return (
    <>
      <div className={layout.leftDock} data-testid={layout.docked ? "map-left-dock" : undefined}>
        {layout.layersButton !== null && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={layout.layersButton}
            aria-expanded={toolsOpen}
            title="Layers, projection and centre. Click an area to inspect it; shift-click two areas for a route reading."
            onClick={() => setToolsOpen((open) => !open)}
          >
            Layers &amp; areas
          </Button>
        )}
        <MapControlsPanel
          className={cn(
            layout.controlsPanel,
            layout.controlsHideWhenClosed && !toolsOpen && "hidden",
          )}
          state={state}
          onSetProjection={onSetProjection}
          onToggleLayer={onToggleLayer}
          onSetCentre={onSetCentre}
          onReset={camera.reset}
          meterRef={camera.meterRef}
          inlineAreas={layout.inlineAreas}
          treeRows={model.treeRows}
          onFocusTreeRow={focusTreeRow}
        />
        {layout.docked && (
          <CollapsiblePanel
            panelId="map-areas"
            title="Areas"
            badge={`(${model.treeRows.length})`}
            defaultOpen={treeDefaultOpen}
            testId="area-list"
          >
            <AreaTreePanel rows={model.treeRows} onSelectArea={focusTreeRow} />
          </CollapsiblePanel>
        )}
        {layout.docked && leftPanels}
      </div>

      <div className={layout.rightDock} data-testid={layout.docked ? "map-right-dock" : undefined}>
        {layout.docked && rightPanels}

        <AreaInspector
          className={cn(
            layout.inspector,
            layout.inspectorHideWhenEmpty && model.summary === null && "hidden",
          )}
          summary={model.summary}
          nameFor={model.nameFor}
          onSelect={onSelect}
        />
      </div>

      <RouteReadout className={layout.routeReadout} route={route} />
    </>
  );
}
