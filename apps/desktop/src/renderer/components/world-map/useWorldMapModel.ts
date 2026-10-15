/**
 * The chart's view model: every piece of data the SVG and chrome draw, derived
 * once from the interaction state, the active world source, the camera and the
 * palette. This is the one place that knows how a marker/label ends up
 * positioned, so `WorldMapChart` itself stays a composition root rather than a
 * second body of logic.
 *
 * Which world is drawn — the fixture or a live campaign — is no longer decided
 * here: it is a `WorldMapSource` (see `world-map-source.ts`) selected once up
 * front. Every deriver below consumes that interface, so a new source is a new
 * implementation rather than an edit to each of them.
 */

import { useEffect, useMemo, useState } from "react";
import { AREAS, AREAS_BY_ID, EDGES, PASSAGES_BY_ID, type AreaControl } from "./fixture-world.js";
import { EMPTY_LIVE_OVERLAY, type LiveWorldMapOverlay } from "./campaign-map-join.js";
import { campaignNationHue } from "../../content/presentationContent.js";
import { buildOwnershipRows, describeArea, type AreaOwnershipRow } from "./map-a11y.js";
import { campaignTreeRows, type AreaTreeRow } from "./area-tree.js";
import type { AreaSummary, MapPrototypeState, RouteReading } from "./map-state.js";
import {
  WORLD_WRAP_TURNS,
  projectAreas,
  type ProjectedArea,
  type Projection,
} from "./projection.js";
import {
  buildFleetMarks,
  buildPortMarks,
  fleetSingles,
  portSingles,
  type AreaAnchors,
  type FleetMark,
  type PortMark,
} from "./map-markers.js";
import { layoutLabels, type PlacedLabel } from "./map-label-layout.js";
import { buildGraticule } from "./map-graticule.js";
import type { MapPalette } from "./map-palette.js";
import type { MapCamera } from "./useMapCamera.js";
import type { BorderSet } from "./CoastlineCanvas.js";
import { BORDERS_1880 } from "./borders-1880-data.js";
import {
  campaignWorldMapSource,
  fixtureWorldMapSource,
  type WorldMapSource,
} from "./world-map-source.js";

/** A passage badge and the edge it gates, projected for the current centre. */
export interface PassageMark {
  readonly id: string;
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly mid: readonly [number, number];
  readonly open: boolean;
  readonly kind: "canal" | "strait";
}

export interface WorldMapModel {
  readonly state: MapPrototypeState;
  readonly live: boolean;
  readonly playerNationId: string | null;
  readonly areas: readonly ProjectedArea[];
  readonly areasById: ReadonlyMap<string, ProjectedArea>;
  readonly control: ReadonlyMap<string, AreaControl>;
  readonly borderSets: readonly BorderSet[];
  readonly portMarks: readonly PortMark[];
  readonly fleetMarks: readonly FleetMark[];
  readonly passageMarks: readonly PassageMark[];
  readonly placedLabels: readonly PlacedLabel[];
  readonly graticule: string;
  readonly routePath: string;
  readonly routeSet: ReadonlySet<string>;
  readonly ownershipRows: readonly AreaOwnershipRow[];
  readonly rowById: ReadonlyMap<string, AreaOwnershipRow>;
  readonly treeRows: readonly AreaTreeRow[];
  readonly summary: AreaSummary | null;
  readonly areaName: (id: string) => string;
  readonly fillFor: (nation: string | null, alpha: number) => string;
  readonly strokeFor: (nation: string) => string;
  readonly nameFor: (nation: string | null) => string;
  readonly describeAreaFor: (id: string) => string;
}

export interface WorldMapModelInput {
  readonly state: MapPrototypeState;
  readonly route: RouteReading | null;
  readonly overlay?: LiveWorldMapOverlay;
  readonly projection: Projection;
  readonly palette: MapPalette;
  readonly camera: MapCamera;
  /** The chart root, scanned for floating chrome that labels must avoid. */
  readonly rootRef: React.RefObject<HTMLDivElement | null>;
}

export function useWorldMapModel({
  state,
  route,
  overlay = EMPTY_LIVE_OVERLAY,
  projection,
  palette,
  camera,
  rootRef,
}: WorldMapModelInput): WorldMapModel {
  /** The one branch on which world is drawn; everything below is source-agnostic. */
  const source = useMemo<WorldMapSource>(
    () =>
      overlay.source === "campaign" ? campaignWorldMapSource(overlay) : fixtureWorldMapSource(),
    [overlay],
  );

  const areas = useMemo(
    () => projectAreas(AREAS, projection, state.centre),
    [projection, state.centre],
  );
  const areasById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);

  /** The playable nations' 1880 borders, tinted by nation and themed. */
  const borderSets = useMemo<BorderSet[]>(
    () =>
      state.layers.borders
        ? Object.entries(BORDERS_1880).map(([id, polygons]) => {
            const hue = campaignNationHue(id);
            return {
              id,
              polygons,
              tint: `oklch(${palette.borderTintLightness} 0.14 ${hue} / 0.16)`,
              edge: `oklch(${palette.borderEdgeLightness} 0.15 ${hue} / 0.9)`,
            };
          })
        : [],
    [palette, state.layers.borders],
  );

  // Bumped once the camera settles (and on mount), so label placement tracks
  // the real view without running per frame.
  const [viewVersion, setViewVersion] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setViewVersion((version) => version + 1), 120);
    };
    const unsubscribe = camera.subscribe(bump);
    bump();
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [camera.subscribe]);

  const portMarks = useMemo<PortMark[]>(() => {
    const singles = portSingles(source.ports, projection, state.centre);
    const factor = camera.getTransform().scale * camera.getPixelsPerUnit();
    return buildPortMarks(singles, camera.zoomBand === 0, factor);
    // `viewVersion` is the settled-camera signal (see placedLabels).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.zoomBand, source.ports, projection, state.centre, viewVersion]);

  const fleetMarks = useMemo<FleetMark[]>(() => {
    const anchors: AreaAnchors = new Map([...areasById].map(([id, area]) => [id, area.label]));
    const singles = fleetSingles(source.fleets, anchors);
    const factor = camera.getTransform().scale * camera.getPixelsPerUnit();
    return buildFleetMarks(singles, camera.zoomBand === 0, factor, portMarks);
    // `viewVersion` is the settled-camera signal (see placedLabels).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areasById, camera.zoomBand, source.fleets, portMarks, viewVersion]);

  const passageMarks = useMemo<PassageMark[]>(() => {
    const marks: PassageMark[] = [];
    for (const edge of EDGES) {
      if (edge.passage === undefined) continue;
      const from = areasById.get(edge.a)?.label;
      const to = areasById.get(edge.b)?.label;
      const passage = PASSAGES_BY_ID.get(edge.passage);
      if (from === undefined || to === undefined || passage === undefined) continue;
      marks.push({
        id: passage.id,
        from,
        to,
        mid: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
        open: passage.open,
        kind: passage.kind,
      });
    }
    return marks;
  }, [areasById]);

  const placedLabels = useMemo<PlacedLabel[]>(() => {
    if (!state.layers.labels) return [];
    const svg = camera.svgRef.current;
    if (svg === null) return [];
    return layoutLabels({
      areas,
      areaName: (id) => AREAS_BY_ID.get(id)?.name,
      projection,
      centre: state.centre,
      flags: {
        possessions: state.layers.possessions,
        fleets: state.layers.fleets,
        passages: state.layers.passages,
      },
      portMarks,
      fleetMarks,
      passageAnchors: passageMarks.map((mark) => mark.mid),
      transform: camera.getTransform(),
      minScale: camera.getMinScale(),
      turns: camera.isWrapping() ? WORLD_WRAP_TURNS : [0],
      svg,
      root: rootRef.current,
    });
    // `viewVersion` is the settled-camera signal; the camera object itself is a stable bundle of refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    areas,
    fleetMarks,
    passageMarks,
    portMarks,
    projection,
    state.centre,
    state.layers,
    viewVersion,
  ]);

  const ownershipRows = useMemo(
    () =>
      buildOwnershipRows(
        areas.map((area) => ({ id: area.id, name: AREAS_BY_ID.get(area.id)?.name ?? area.id })),
        (id) => {
          const owner = source.control.get(id)?.owner ?? null;
          return owner === null ? null : source.nameFor(owner);
        },
        (id) => source.fleets.filter((fleet) => fleet.area === id).length,
        (id) => source.possessionCounts.get(id) ?? 0,
        state.selected,
      ),
    [areas, source, state.selected],
  );
  const rowById = useMemo(
    () => new Map(ownershipRows.map((row) => [row.id, row])),
    [ownershipRows],
  );

  const graticule = useMemo(() => buildGraticule(projection), [projection]);

  const routeSet = useMemo(() => new Set(route?.path ?? []), [route]);

  /** Selected-area inspector: the source's own view of the area, or null. */
  const summary = useMemo(
    () => (state.selected === null ? null : source.summarise(state.selected)),
    [source, state.selected],
  );

  /** The area tree's rows: campaign areas when live, else the fixture areas (no regions). */
  const treeRows = useMemo<AreaTreeRow[]>(() => {
    if (source.campaignAreas !== null) {
      return campaignTreeRows(
        source.campaignAreas,
        source.playerNationId,
        (nation) => source.nameFor(nation),
        state.selected,
      );
    }
    return ownershipRows.map((row) => ({
      id: row.id,
      name: row.name,
      owner: row.owner,
      ships: row.fleets,
      possessed: row.possessions > 0,
      mapAreaId: row.id,
      selected: row.selected,
    }));
  }, [source, ownershipRows, state.selected]);

  const routePath = useMemo(() => {
    if (route === null || !state.layers.routes) return "";
    return route.path
      .map((id, index) => {
        const point = areasById.get(id)?.label;
        if (point === undefined) return "";
        return `${index === 0 ? "M" : "L"}${point[0]} ${point[1]}`;
      })
      .join("");
  }, [areasById, route, state.layers.routes]);

  const areaName = useMemo(() => (id: string) => AREAS_BY_ID.get(id)?.name ?? id, []);

  return {
    state,
    live: source.live,
    playerNationId: source.playerNationId,
    areas,
    areasById,
    control: source.control,
    borderSets,
    portMarks,
    fleetMarks,
    passageMarks,
    placedLabels,
    graticule,
    routePath,
    routeSet,
    ownershipRows,
    rowById,
    treeRows,
    summary,
    areaName,
    fillFor: (nation, alpha) => source.fillFor(nation, alpha),
    strokeFor: (nation) => source.strokeFor(nation),
    nameFor: (nation) => source.nameFor(nation),
    describeAreaFor: (id) => {
      const row = rowById.get(id);
      return row === undefined ? id : describeArea(row);
    },
  };
}
