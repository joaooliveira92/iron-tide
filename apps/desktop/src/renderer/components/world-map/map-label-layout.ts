/**
 * Place-name layout. Pure: given the projected geography, what is on screen,
 * and the camera's settled transform, it decides which names to draw and where
 * — or returns `[]` when the layer is off or the chart has no layout yet.
 *
 * Eligible names depend on zoom (see `labelPresentation`): big names when
 * zoomed out, smaller ones as you close in. They are placed in priority order,
 * one dropped if it would leave the view, sit under floating chrome, cover a
 * marker, or overlap one already placed; first it is nudged to nearby spots.
 */

import {
  CONTINENTS,
  COUNTRIES,
  LABEL_RANK,
  labelPresentation,
  type LabelKind,
  type LabelTraits,
} from "./map-labels.js";
import type { FleetMark, PortMark } from "./map-markers.js";
import { projectPoint, type Point, type ProjectedArea, type Projection } from "./projection.js";
import type { CameraTransform } from "./useMapCamera.js";

export interface LabelSpec {
  readonly key: string;
  readonly kind: LabelKind;
  readonly text: string;
  /** World user units. */
  readonly ux: number;
  readonly uy: number;
  /** Tie-break within a rank: bigger first. */
  readonly weight: number;
  readonly anchor: "middle" | "start";
  readonly px: number;
  readonly opacity: number;
  readonly rank: number;
}

export interface PlacedLabel {
  readonly id: string;
  readonly turn: number;
  readonly spec: LabelSpec;
  readonly dx: number;
  readonly dy: number;
}

interface Box {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/** Label nudges to try, in screen pixels, nearest to the anchor first. */
const NUDGES: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, -18],
  [0, 18],
  [0, -36],
  [0, 36],
  [-48, 0],
  [48, 0],
  [-48, -18],
  [48, -18],
  [-48, 18],
  [48, 18],
];

export interface LabelLayoutRequest {
  readonly areas: readonly ProjectedArea[];
  /** Display name for a fixture area id. */
  readonly areaName: (id: string) => string | undefined;
  readonly projection: Projection;
  readonly centre: number;
  /** Which marker layers are on, so their positions become label obstacles. */
  readonly flags: {
    readonly possessions: boolean;
    readonly fleets: boolean;
    readonly passages: boolean;
  };
  readonly portMarks: readonly PortMark[];
  readonly fleetMarks: readonly FleetMark[];
  /** Passage badge midpoints, in world user units. */
  readonly passageAnchors: readonly Point[];
  readonly transform: Readonly<CameraTransform>;
  readonly minScale: number;
  readonly turns: readonly number[];
  readonly svg: SVGSVGElement;
  /** The chart root, scanned for floating chrome that labels must avoid. */
  readonly root: HTMLElement | null;
}

export function layoutLabels(request: LabelLayoutRequest): PlacedLabel[] {
  const {
    areas,
    areaName,
    projection,
    centre,
    flags,
    portMarks,
    fleetMarks,
    passageAnchors,
    transform,
    minScale,
    turns,
    svg,
    root,
  } = request;

  const placedOut: PlacedLabel[] = [];
  const ctm = svg.getScreenCTM?.();
  if (ctm == null || svg.clientWidth === 0) return placedOut;
  const frame = svg.getBoundingClientRect();
  const zoom = transform.scale / minScale;

  // Everything that could be named, with its zoom-dependent look.
  const specs: LabelSpec[] = [];
  const consider = (spec: Omit<LabelSpec, "px" | "opacity" | "rank">, traits: LabelTraits = {}) => {
    const look = labelPresentation(spec.kind, zoom, traits);
    if (look !== null) specs.push({ ...spec, ...look, rank: LABEL_RANK[spec.kind] });
  };
  for (const country of COUNTRIES) {
    const [ux, uy] = projectPoint(country.at, projection, centre);
    consider({
      key: `country:${country.name}`,
      kind: "country",
      text: country.name,
      ux,
      uy,
      weight: 0,
      anchor: "middle",
    });
  }
  for (const area of areas) {
    const name = areaName(area.id);
    if (name === undefined) continue;
    const size = area.bounds.width * area.bounds.height;
    consider(
      {
        key: `sea:${area.id}`,
        kind: "sea",
        text: name,
        ux: area.label[0],
        uy: area.label[1],
        weight: size,
        anchor: "middle",
      },
      { big: size > 26000 },
    );
  }
  for (const continent of CONTINENTS) {
    const [ux, uy] = projectPoint(continent.at, projection, centre);
    consider({
      key: `continent:${continent.name}`,
      kind: "continent",
      text: continent.name,
      ux,
      uy,
      weight: 0,
      anchor: "middle",
    });
  }
  // A clustered port dot has no single name to show; singles do.
  for (const mark of portMarks) {
    if (mark.count !== 1) continue;
    consider(
      {
        key: `port:${mark.id}`,
        kind: "port",
        text: mark.name,
        ux: mark.ux,
        uy: mark.uy,
        weight: mark.major ? 1 : 0,
        anchor: "start",
      },
      { major: mark.major },
    );
  }
  specs.sort((a, b) => a.rank - b.rank || b.weight - a.weight);

  // Things a label must not sit on: floating panels, then markers.
  const obstacles: Box[] = [];
  if (root !== null) {
    for (const element of root.querySelectorAll("[data-map-obstacle], .pointer-events-auto")) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      obstacles.push({
        x0: rect.left - frame.left,
        x1: rect.right - frame.left,
        y0: rect.top - frame.top,
        y1: rect.bottom - frame.top,
      });
    }
  }
  const markers: { ux: number; uy: number; hw: number; hh: number }[] = [];
  if (flags.possessions) {
    for (const mark of portMarks) {
      const half = mark.count > 1 ? 11 : 8;
      markers.push({ ux: mark.ux, uy: mark.uy, hw: half, hh: half });
    }
  }
  if (flags.fleets) {
    for (const mark of fleetMarks) {
      markers.push({ ux: mark.ux, uy: mark.uy, hw: mark.count > 1 ? 17 : 13, hh: 10 });
    }
  }
  if (flags.passages) {
    for (const anchor of passageAnchors) {
      markers.push({ ux: anchor[0], uy: anchor[1], hw: 9, hh: 9 });
    }
  }

  const toScreen = (ux: number, uy: number, turn: number) => ({
    x:
      ctm.a * (transform.x + transform.scale * (ux + turn * projection.width)) + ctm.e - frame.left,
    y: ctm.d * (transform.y + transform.scale * uy) + ctm.f - frame.top,
  });
  const placed: Box[] = [];
  for (const spec of specs) {
    const upper = spec.kind === "sea" || spec.kind === "continent";
    const width = spec.text.length * (spec.px * (upper ? 0.62 : 0.56) + (upper ? 1.2 : 0)) + 8;
    for (const turn of turns) {
      const at = toScreen(spec.ux, spec.uy, turn);
      // A port's own dot is not an obstacle to its own name.
      const markerBoxes: Box[] = markers
        .filter(
          (marker) => !(spec.kind === "port" && marker.ux === spec.ux && marker.uy === spec.uy),
        )
        .map((marker) => {
          const m = toScreen(marker.ux, marker.uy, turn);
          return {
            x0: m.x - marker.hw,
            x1: m.x + marker.hw,
            y0: m.y - marker.hh,
            y1: m.y + marker.hh,
          };
        });
      for (const [dx, dy] of NUDGES) {
        const left = spec.anchor === "start" ? at.x + dx + 8 : at.x + dx - width / 2;
        const box = {
          x0: left,
          x1: left + width,
          y0: at.y + dy - spec.px * 1.1,
          y1: at.y + dy + spec.px * 0.5,
        };
        if (box.x0 < 6 || box.y0 < 6 || box.x1 > frame.width - 6 || box.y1 > frame.height - 6)
          continue;
        if (obstacles.some((other) => boxesOverlap(box, other))) continue;
        if (markerBoxes.some((other) => boxesOverlap(box, other))) continue;
        if (placed.some((other) => boxesOverlap(box, other))) continue;
        placed.push(box);
        placedOut.push({ id: `${turn}:${spec.key}`, turn, spec, dx, dy });
        break;
      }
    }
  }
  return placedOut;
}
