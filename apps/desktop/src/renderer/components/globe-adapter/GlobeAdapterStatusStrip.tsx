import { NATURAL_EARTH_HIERARCHY } from "./tile-hierarchy.js";
import type { CameraProjection } from "./camera-contract.js";

export interface GlobeAdapterStatusStripProps {
  readonly label: string;
  readonly projection: CameraProjection;
  readonly onToggleProjection: () => void;
  readonly onNorth: () => void;
}

export function GlobeAdapterStatusStrip({
  label,
  projection,
  onToggleProjection,
  onNorth,
}: GlobeAdapterStatusStripProps) {
  return (
    <div className="absolute left-2 top-2 z-20 flex items-center gap-2 rounded bg-black/75 px-2 py-1 font-mono text-xs text-white">
      <span data-testid="globe-adapter-status">{label}</span>
      <button
        type="button"
        className="rounded border border-white/40 px-1"
        onClick={onToggleProjection}
      >
        {projection === "globe" ? "Mercator" : "Globe"}
      </button>
      <button type="button" className="rounded border border-white/40 px-1" onClick={onNorth}>
        North
      </button>
      <span className="opacity-70">z{NATURAL_EARTH_HIERARCHY.sourceMaxZoom} source</span>
    </div>
  );
}
