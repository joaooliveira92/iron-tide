import type { AppCameraState } from "./camera-contract.js";
import type { TileHierarchy } from "./tile-hierarchy.js";

export interface EntityRow {
  readonly id: string;
  readonly name: string;
  readonly kind: "port" | "fleet";
  readonly areaId: string;
}

export interface GlobeAdapterScreenReaderProps {
  readonly liveMessage: string;
  readonly entityRows: readonly EntityRow[];
  readonly camera: AppCameraState;
  readonly hierarchy: TileHierarchy;
}

export function GlobeAdapterScreenReader({
  liveMessage,
  entityRows,
  camera,
  hierarchy,
}: GlobeAdapterScreenReaderProps) {
  return (
    <>
      <div aria-live="polite" role="status" data-testid="globe-adapter-live" className="sr-only">
        {liveMessage}
      </div>
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
            {entityRows.map((entity) => (
              <tr key={entity.id}>
                <th scope="row">{entity.name}</th>
                <td>{entity.kind}</td>
                <td>{entity.areaId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
