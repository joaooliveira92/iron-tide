import { Button } from "../ui/button.js";
import { AreaTreePanel } from "./AreaTreePanel.js";
import { CHART } from "./chart-theme.js";
import { LAYERS, type LayerId, type MapPrototypeState } from "./map-state.js";
import { PROJECTIONS, type ProjectionId } from "./projection.js";
import type { AreaTreeRow } from "./area-tree.js";
import { Tip } from "../../components/ui/tip.js";

export interface MapControlsPanelProps {
  readonly className: string;
  readonly state: MapPrototypeState;
  readonly onSetProjection: (projection: ProjectionId) => void;
  readonly onToggleLayer: (layer: LayerId) => void;
  readonly onSetCentre: (centre: number) => void;
  readonly onReset: () => void;
  readonly meterRef: React.RefObject<HTMLSpanElement | null>;
  readonly inlineAreas: boolean;
  readonly treeRows: readonly AreaTreeRow[];
  readonly onFocusTreeRow: (row: AreaTreeRow) => void;
}

export function MapControlsPanel({
  className,
  state,
  onSetProjection,
  onToggleLayer,
  onSetCentre,
  onReset,
  meterRef,
  inlineAreas,
  treeRows,
  onFocusTreeRow,
}: MapControlsPanelProps) {
  return (
    <div
      className={className}
      style={{
        background: "oklch(0.16 0.025 245 / 0.85)",
        borderColor: "oklch(0.4 0.02 245)",
        color: CHART.ink,
      }}
    >
      <div className="flex gap-1">
        {PROJECTIONS.map((option) => (
          <Tip label={option.note}>
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onSetProjection(option.id)}

              className="h-7 px-2 text-xs hover:bg-white/10"
              style={{
                background: state.projection === option.id ? "oklch(0.7 0.12 240)" : "transparent",
                color: state.projection === option.id ? "oklch(0.15 0.02 245)" : CHART.inkDim,
              }}
            >
              {option.name}
            </Button>
          </Tip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1" style={{ maxWidth: 220 }}>
        {LAYERS.map((layer) => (
          <Button
            key={layer.id}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onToggleLayer(layer.id)}
            className="h-7 border px-2 text-xs hover:bg-white/10"
            style={{
              background: state.layers[layer.id] ? "oklch(0.35 0.03 245)" : "transparent",
              color: state.layers[layer.id] ? CHART.ink : CHART.inkDim,
              borderColor: "oklch(0.4 0.02 245)",
            }}
          >
            {layer.label}
          </Button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs" style={{ color: CHART.inkDim }}>
        Centre
        <input
          type="range"
          min={-180}
          max={180}
          step={10}
          value={state.centre}
          onChange={(event) => onSetCentre(Number(event.target.value))}
          className="w-28"
        />
        <span className="tabular-nums">{state.centre}°</span>
      </label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onReset}
          className="h-7 border px-2 text-xs hover:bg-white/10"
          style={{ borderColor: "oklch(0.4 0.02 245)", color: CHART.inkDim }}
        >
          Reset view
        </Button>
        <span
          ref={meterRef}
          className="font-mono text-xs tabular-nums"
          style={{ color: CHART.inkDim }}
        />
      </div>
      {inlineAreas && (
        <details className="group" data-testid="area-list">
          <summary className="cursor-pointer select-none text-xs" style={{ color: CHART.inkDim }}>
            Areas ({treeRows.length})
          </summary>
          <div className="mt-2" style={{ width: 220, color: CHART.ink }}>
            <AreaTreePanel rows={treeRows} onSelectArea={onFocusTreeRow} />
          </div>
        </details>
      )}
    </div>
  );
}
