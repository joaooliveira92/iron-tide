import "maplibre-gl/dist/maplibre-gl.css";

import { Globe } from "./Globe.js";
import { GLOBE_ASSET_ROOT } from "./map-style.js";
import type { GlobeAdapterProps } from "./globe-adapter-types.js";

export { GLOBE_ASSET_ROOT };
export type { GlobeAdapterProps, AdapterDiagnostics } from "./globe-adapter-types.js";

export function GlobeAdapter(props: GlobeAdapterProps) {
  return (
    <Globe.Provider {...props}>
      <Globe.Frame>
        <Globe.Canvas />
        <Globe.Layers />
        <Globe.Chrome />
        <Globe.Legend>
          <Globe.Minimap />
        </Globe.Legend>
        <Globe.ScreenReader />
      </Globe.Frame>
    </Globe.Provider>
  );
}

export function GlobeAdapterWithoutMinimap(props: GlobeAdapterProps) {
  return (
    <Globe.Provider {...props}>
      <Globe.Frame>
        <Globe.Canvas />
        <Globe.Layers />
        <Globe.Chrome />
        <Globe.Legend />
        <Globe.ScreenReader />
      </Globe.Frame>
    </Globe.Provider>
  );
}
