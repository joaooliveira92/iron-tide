import {
  SceneAreas,
  SceneFleets,
  SceneGraticule,
  SceneLabels,
  SceneLanes,
  SceneOrders,
  ScenePorts,
  SceneRoutes,
  SceneStrength,
} from "./SceneLayers.js";
import { WorldCopies } from "./WorldCopies.js";
import { WorldMapRoot } from "./WorldMapScene.js";

export const WorldMap = {
  Root: WorldMapRoot,
  Copies: WorldCopies,
  Graticule: SceneGraticule,
  Areas: SceneAreas,
  Lanes: SceneLanes,
  Routes: SceneRoutes,
  Orders: SceneOrders,
  Ports: ScenePorts,
  Fleets: SceneFleets,
  Strength: SceneStrength,
  Labels: SceneLabels,
};
