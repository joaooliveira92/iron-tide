import { memo } from "react";

import { WorldMap } from "./scene/WorldMap.js";

export const MapLayers = memo(function MapLayers() {
  return (
    <WorldMap.Copies>
      <WorldMap.Graticule />
      <WorldMap.Areas />
      <WorldMap.Lanes />
      <WorldMap.Routes />
      <WorldMap.Orders />
      <WorldMap.Ports />
      <WorldMap.Fleets />
      <WorldMap.Strength />
      <WorldMap.Labels />
    </WorldMap.Copies>
  );
});
