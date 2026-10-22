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
import { separateGlyphs } from "./map-glyph-layout.js";
import { buildLanes, laneEdges, type LaneMark } from "./map-lanes.js";
import {
  buildRegionStrengths,
  compactGlyphs,
  describeStrength,
  type RegionStrength,
} from "./map-strength.js";
import { strengthExtent, strengthHalfWidth } from "./layers/StrengthLayer.js";
import { nationFlagUrl } from "../../content/nation-flag.js";
import type { MapPalette } from "./map-palette.js";
import type { MapCamera } from "./useMapCamera.js";
import type { BorderSet } from "./CoastlineCanvas.js";
import { BORDERS_1880 } from "./borders-1880-data.js";
import {
  campaignWorldMapSource,
  fixtureWorldMapSource,
  type WorldMapSource,
} from "./world-map-source.js";

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
  readonly lanes: readonly LaneMark[];
  readonly strengths: readonly RegionStrength[];
  readonly glyphOffsets: ReadonlyMap<string, number>;
  readonly compactGlyphs: boolean;
  readonly unavailable: ReadonlySet<string>;
  readonly anchorOf: (areaId: string) => readonly [number, number] | undefined;
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
  readonly strokeFor: (nation: string | null) => string;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.zoomBand, source.ports, projection, state.centre, viewVersion]);

  const fleetMarks = useMemo<FleetMark[]>(() => {
    const anchors: AreaAnchors = new Map([...areasById].map(([id, area]) => [id, area.label]));
    const singles = fleetSingles(source.fleets, anchors);
    const factor = camera.getTransform().scale * camera.getPixelsPerUnit();
    return buildFleetMarks(singles, camera.zoomBand === 0, factor, portMarks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areasById, camera.zoomBand, source.fleets, portMarks, viewVersion]);

  const lanes = useMemo(
    () =>
      buildLanes(
        laneEdges(overlay.lanes, EDGES),
        new Map([...areasById].map(([id, area]) => [id, area.label] as const)),
        projection.width,
      ),
    [areasById, overlay.lanes, projection.width],
  );

  const strengths = useMemo(
    () =>
      buildRegionStrengths(source.fleets, {
        nameFor: (nation) => source.nameFor(nation),
        flagUrlFor: (nation) => (nation === null ? null : nationFlagUrl(nation)),
      }),
    [source],
  );
  const strengthById = useMemo(
    () => new Map(strengths.map((region) => [region.areaId, region])),
    [strengths],
  );
  const compact = useMemo(
    () => compactGlyphs(camera.svgRef.current?.clientHeight ?? 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewVersion],
  );
  const glyphOffsets = useMemo(() => {
    const factor = camera.getTransform().scale * camera.getPixelsPerUnit();
    return separateGlyphs(
      strengths.flatMap((region) => {
        const at = areasById.get(region.areaId)?.label;
        if (at === undefined) return [];
        return [
          {
            id: region.areaId,
            ships: region.total,
            ux: at[0],
            uy: at[1],
            hw: strengthHalfWidth(region),
            ...strengthExtent(region, compact),
          },
        ];
      }),
      factor,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strengths, areasById, compact, viewVersion]);
  const anchorOf = useMemo(() => (areaId: string) => areasById.get(areaId)?.label, [areasById]);

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
      strengthMarks: strengths.flatMap((region) => {
        const at = areasById.get(region.areaId)?.label;
        if (at === undefined) return [];
        const factor = camera.getTransform().scale * camera.getPixelsPerUnit();
        const shift = (glyphOffsets.get(region.areaId) ?? 0) / (factor > 0 ? factor : 1);
        return [
          {
            ux: at[0] + shift,
            uy: at[1],
            hw: strengthHalfWidth(region),
            ...strengthExtent(region, compact),
          },
        ];
      }),
      transform: camera.getTransform(),
      minScale: camera.getMinScale(),
      turns: camera.isWrapping() ? WORLD_WRAP_TURNS : [0],
      svg,
      root: rootRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    areas,
    fleetMarks,
    passageMarks,
    portMarks,
    projection,
    state.centre,
    state.layers,
    strengths,
    areasById,
    compact,
    glyphOffsets,
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
        (id) => {
          const region = strengthById.get(id);
          return region === undefined ? null : describeStrength(region);
        },
        (id) => source.unavailable.has(id),
      ),
    [areas, source, state.selected, strengthById],
  );
  const rowById = useMemo(
    () => new Map(ownershipRows.map((row) => [row.id, row])),
    [ownershipRows],
  );

  const graticule = useMemo(() => buildGraticule(projection), [projection]);

  const routeSet = useMemo(() => new Set(route?.path ?? []), [route]);

  const summary = useMemo(
    () => (state.selected === null ? null : source.summarise(state.selected)),
    [source, state.selected],
  );

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
    lanes,
    strengths,
    compactGlyphs: compact,
    glyphOffsets,
    unavailable: source.unavailable,
    anchorOf,
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
