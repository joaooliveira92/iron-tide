import { TacticalMapCanvas } from "./map/TacticalMapCanvas.js";
import { TacticalMapChrome } from "./map/TacticalMapChrome.js";
import { TacticalMapOverlays } from "./map/TacticalMapOverlays.js";
import { TacticalMapBearing, TacticalMapConditions } from "./map/TacticalMapReadouts.js";
import { TacticalMapRoot } from "./map/TacticalMapRoot.js";
import { TacticalMapUnits } from "./map/TacticalMapUnits.js";

export const TacticalMap = Object.assign(TacticalMapRoot, {
  Canvas: TacticalMapCanvas,
  Overlays: TacticalMapOverlays,
  Units: TacticalMapUnits,
  Chrome: TacticalMapChrome,
  Conditions: TacticalMapConditions,
  Bearing: TacticalMapBearing,
});
