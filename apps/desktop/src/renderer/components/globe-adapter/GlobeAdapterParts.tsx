import type { CameraProjection } from "./camera-contract.js";
import type { HoverTooltip } from "./map-interactions.js";
import { NATURAL_EARTH_HIERARCHY, type TileHierarchy } from "./tile-hierarchy.js";

export interface EntityRow {
  readonly id: string;
  readonly name: string;
  readonly kind: "port" | "fleet";
  readonly areaId: string;
}

export function GlobeStatusBar({
  statusLabel,
  projection,
  onToggleProjection,
  onNorth,
}: {
  readonly statusLabel: string;
  readonly projection: CameraProjection;
  readonly onToggleProjection: () => void;
  readonly onNorth: () => void;
}) {
  return (
    <div className="absolute left-2 top-2 z-20 flex items-center gap-2 rounded bg-black/75 px-2 py-1 font-mono text-xs text-white">
      <span data-testid="globe-adapter-status">{statusLabel}</span>
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

export function GlobeHoverTooltip({ tooltip }: { readonly tooltip: HoverTooltip | null }) {
  if (tooltip === null) return null;
  return (
    <div
      role="tooltip"
      data-testid="globe-adapter-tooltip"
      className="pointer-events-none absolute z-30 max-w-64 rounded bg-black/85 px-2 py-1 text-xs text-white"
      style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
    >
      {tooltip.text}
    </div>
  );
}

export function GlobeLiveRegion({ message }: { readonly message: string }) {
  return (
    <div aria-live="polite" role="status" data-testid="globe-adapter-live" className="sr-only">
      {message}
    </div>
  );
}

export function GlobeEntityTable({ rows }: { readonly rows: readonly EntityRow[] }) {
  return (
    <div className="sr-only">
      <table>
        <caption>Globe adapter entities</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Kind</th>
            <th scope="col">Area</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entity) => (
            <tr key={entity.id}>
              <th scope="row">{entity.name}</th>
              <td>{entity.kind}</td>
              <td>{entity.areaId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GlobeDiagnosticsMirror({
  camera,
  hierarchy,
}: {
  readonly camera: unknown;
  readonly hierarchy: TileHierarchy;
}) {
  return (
    <>
      <div className="sr-only" data-testid="globe-adapter-camera">
        {JSON.stringify(camera)}
      </div>
      <div className="sr-only" data-testid="globe-adapter-hierarchy">
        {JSON.stringify({
          version: hierarchy.version,
          sourceMaxZoom: hierarchy.sourceMaxZoom,
          fitForPurposeMaxZoom: hierarchy.fitForPurposeMaxZoom,
          overscaleMaxZoom: hierarchy.overscaleMaxZoom,
          cacheVersion: hierarchy.cacheVersion,
        })}
      </div>
    </>
  );
}
