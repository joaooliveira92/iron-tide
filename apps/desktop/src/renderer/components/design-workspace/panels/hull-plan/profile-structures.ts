import { type Point, clamp } from "./path.js";
import {
  FUNNEL_GAP_PX,
  FUNNEL_MIN_WIDTH_PX,
  FUNNEL_RAKE_OF_WIDTH,
  FUNNEL_RISE,
  FUNNEL_TOP_TAPER,
  FUNNEL_WIDTH_OF_DEPTH,
  HOUSE_LIMITS,
  HOUSE_SAMPLES,
  LOWER_HOUSE_RISE,
  MIN_FUNNEL_RISE,
  TOP_PAD,
  UPPER_HOUSE_RISE,
  along,
} from "./profile-constants.js";
import type { ProfileFrame } from "./profile-geometry.js";

export interface HouseMasses {
  readonly lower: readonly Point[];
  readonly upper: readonly Point[];
  readonly startPermille: number;
  readonly endPermille: number;
  readonly bridgeStartPermille: number;
  readonly lowerTopY: (t: number) => number;
}

export function houseMasses(
  frame: ProfileFrame,
  zone: { readonly startPermille: number; readonly endPermille: number } | undefined,
): HouseMasses | undefined {
  if (!zone) return undefined;
  const start = clamp(
    Math.min(zone.startPermille, zone.endPermille),
    HOUSE_LIMITS.min,
    HOUSE_LIMITS.max,
  );
  const end = clamp(
    Math.max(zone.startPermille, zone.endPermille),
    HOUSE_LIMITS.min,
    HOUSE_LIMITS.max,
  );
  if (end - start < 10) return undefined;
  const lowerRisePx = LOWER_HOUSE_RISE * frame.depthM * frame.vScale;
  const upperRisePx = UPPER_HOUSE_RISE * frame.depthM * frame.vScale;
  const lowerTopY = (t: number) => frame.deckY(t) - lowerRisePx;
  const chamfer = along(0.012);
  const run = (from: number, to: number, baseOf: (t: number) => number): Point[] =>
    Array.from({ length: HOUSE_SAMPLES + 1 }, (_, i) => {
      const permille = from + ((to - from) * i) / HOUSE_SAMPLES;
      return { x: frame.x(permille), y: baseOf(permille / 1000) };
    });
  const bottom = run(start, end, (t) => frame.deckY(t));
  const top = run(start, end, lowerTopY).reverse();
  const first = bottom[0]!;
  const lower = [
    ...bottom,
    ...top.slice(0, -1),
    { x: first.x + chamfer, y: lowerTopY(start / 1000) },
  ];
  const upperStart = start + (end - start) * 0.2;
  const upperEnd = start + (end - start) * 0.65;
  const upperBottom = run(upperStart, upperEnd, lowerTopY);
  const upperTop = run(upperStart, upperEnd, (t) => lowerTopY(t) - upperRisePx).reverse();
  return {
    lower,
    upper: [...upperBottom, ...upperTop],
    startPermille: start,
    endPermille: end,
    bridgeStartPermille: upperStart,
    lowerTopY,
  };
}

export interface FunnelInput {
  readonly instanceId: string;
  readonly stationPermille: number;
}

export interface FunnelShape {
  readonly instanceId: string;
  readonly stationPermille: number;
  readonly centreX: number;
  readonly baseY: number;
  readonly topY: number;
  readonly widthPx: number;
  readonly polygon: readonly Point[];
}

export function funnelShapes(
  frame: ProfileFrame,
  funnels: readonly FunnelInput[],
  houses: HouseMasses | undefined,
): FunnelShape[] {
  const ordered = [...funnels].sort(
    (a, b) => a.stationPermille - b.stationPermille || a.instanceId.localeCompare(b.instanceId),
  );
  const depthPx = frame.depthM * frame.vScale;
  const xs = ordered.map((f) => frame.x(f.stationPermille));
  const spacing = xs.slice(1).map((x, i) => x - xs[i]!);
  const tightest = spacing.length > 0 ? Math.min(...spacing) : Number.POSITIVE_INFINITY;
  const widthPx = Math.max(
    FUNNEL_MIN_WIDTH_PX,
    Math.min(FUNNEL_WIDTH_OF_DEPTH * depthPx, tightest - FUNNEL_GAP_PX),
  );
  return ordered.map((f) => {
    const t = clamp(f.stationPermille, 0, 1000) / 1000;
    const inHouse =
      houses &&
      f.stationPermille >= houses.startPermille &&
      f.stationPermille <= houses.endPermille;
    const baseY = inHouse ? houses.lowerTopY(t) : frame.deckY(t);
    const minHeight = MIN_FUNNEL_RISE * depthPx;
    const topY = Math.max(
      TOP_PAD,
      Math.min(frame.deckMidY - FUNNEL_RISE * depthPx, baseY - minHeight),
    );
    const centreX = frame.x(f.stationPermille);
    const topWidth = widthPx * FUNNEL_TOP_TAPER;
    const rake = widthPx * FUNNEL_RAKE_OF_WIDTH;
    return {
      instanceId: f.instanceId,
      stationPermille: f.stationPermille,
      centreX,
      baseY,
      topY,
      widthPx,
      polygon: [
        { x: centreX - widthPx / 2, y: baseY },
        { x: centreX + widthPx / 2, y: baseY },
        { x: centreX + rake + topWidth / 2, y: topY },
        { x: centreX + rake - topWidth / 2, y: topY },
      ],
    };
  });
}
