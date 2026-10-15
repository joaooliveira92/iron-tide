import type { ArmourRegionId, DesignDraft } from "@bluewave/ship-design";
import { machineryRooms } from "../../selection/facts.js";
import { LABEL_FONT, NON_SCALING, STROKE } from "./drafting.js";
import { PLAN_MID, type PlanFrame } from "./geometry.js";

/**
 * The overlays the central workspace can lay over its drawings. Each reads only the design (draft and compile
 * through the caller) and draws a schematic: geometry that is a convention is named as one in the title, so no
 * drawing is mistaken for authoritative.
 */

const BAND = {
  y: (f: PlanFrame) => PLAN_MID - f.maxHalf,
  h: (f: PlanFrame) => f.maxHalf * 2,
} as const;

const beltLengthMm = (draft: DesignDraft): number =>
  draft.armour.regions
    .filter((r) => r.region === "BELT_MAIN")
    .reduce((total, r) => total + r.lengthMm, 0);

const permilleOf = (lengthMm: number, lengthWlMm: number): number => {
  if (lengthWlMm <= 0) return 0;
  return Math.max(0, Math.min(1000, (lengthMm * 1000) / lengthWlMm));
};

/** A band centred amidships, from `startPermille` to `endPermille`. */
function band(
  frame: PlanFrame,
  startPermille: number,
  endPermille: number,
): { readonly x: number; readonly width: number } {
  return {
    x: frame.x(startPermille),
    width: frame.x(endPermille) - frame.x(startPermille),
  };
}

/**
 * The citadel and the armoured belt. SCHEMATIC: the belt and citadel lengths are real, but the design model gives
 * no station for either, so both are drawn amidships — a convention, not a position from the design.
 */
export function ArmourZoneLayer({
  frame,
  draft,
  highlight,
}: {
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  /** The region the Protection editor has selected, highlighted over the scheme (presentation only). */
  readonly highlight?: ArmourRegionId | null;
}) {
  const lengthWlMm = Number(draft.hull.lengthWl);
  const citadelPermille = permilleOf(draft.armour.citadelLengthMm, lengthWlMm);
  const beltPermille = permilleOf(beltLengthMm(draft), lengthWlMm);
  const region =
    highlight == null ? undefined : draft.armour.regions.find((r) => r.region === highlight);
  const regionPermille = region === undefined ? 0 : permilleOf(region.lengthMm, lengthWlMm);
  const highlightBand =
    regionPermille > 0
      ? band(frame, (1000 - regionPermille) / 2, (1000 + regionPermille) / 2)
      : undefined;
  if (citadelPermille <= 0 && beltPermille <= 0 && highlightBand === undefined) return null;
  const citadel = band(frame, (1000 - citadelPermille) / 2, (1000 + citadelPermille) / 2);
  const belt = band(frame, (1000 - beltPermille) / 2, (1000 + beltPermille) / 2);
  return (
    <g data-testid="armour-zones">
      {citadelPermille > 0 && (
        <rect
          x={citadel.x}
          width={citadel.width}
          y={BAND.y(frame)}
          height={BAND.h(frame)}
          className="pointer-events-none fill-primary stroke-primary"
          fillOpacity={0.08}
          strokeOpacity={0.6}
          strokeDasharray="4 2"
          strokeWidth={STROKE.guide}
          {...NON_SCALING}
          data-testid="armour-citadel"
        >
          <title>{`Armoured citadel (${Math.round(citadelPermille)}‰ of length; amidships is a convention)`}</title>
        </rect>
      )}
      {beltPermille > 0 && (
        <rect
          x={belt.x}
          width={belt.width}
          y={BAND.y(frame)}
          height={BAND.h(frame)}
          className="pointer-events-none fill-primary stroke-primary"
          fillOpacity={0.24}
          strokeOpacity={0.85}
          strokeWidth={STROKE.structure}
          {...NON_SCALING}
          data-testid="armour-belt"
        >
          <title>{`Main belt (${Math.round(beltPermille)}‰ of length; amidships is a convention)`}</title>
        </rect>
      )}
      {highlightBand !== undefined && region !== undefined && (
        <rect
          x={highlightBand.x}
          width={highlightBand.width}
          y={BAND.y(frame)}
          height={BAND.h(frame)}
          className="pointer-events-none fill-primary stroke-primary"
          fillOpacity={0.4}
          strokeOpacity={1}
          strokeWidth={STROKE.structure}
          strokeDasharray="3 2"
          {...NON_SCALING}
          data-testid="armour-highlight"
          data-region={region.region}
        >
          <title>{`${region.region.replaceAll("_", " ").toLowerCase()} (${Math.round(regionPermille)}‰ of length; amidships is a convention)`}</title>
        </rect>
      )}
    </g>
  );
}

/** The hull's internal subdivision: each section as a translucent band, named for the pointer. */
export function CompartmentLayer({
  frame,
  zones,
}: {
  readonly frame: PlanFrame;
  readonly zones: readonly {
    readonly id: string;
    readonly startPermille: number;
    readonly endPermille: number;
  }[];
}) {
  return (
    <g data-testid="compartments">
      {zones.map((z, i) => {
        const { x, width } = band(frame, z.startPermille, z.endPermille);
        return (
          <rect
            key={z.id}
            x={x}
            width={width}
            y={BAND.y(frame)}
            height={BAND.h(frame)}
            className="pointer-events-none fill-primary stroke-primary"
            fillOpacity={i % 2 === 0 ? 0.1 : 0.04}
            strokeOpacity={0.4}
            strokeWidth={STROKE.guide}
            {...NON_SCALING}
            data-compartment={z.id}
          >
            <title>{z.id.replaceAll("_", " ").toLowerCase()}</title>
          </rect>
        );
      })}
    </g>
  );
}

/** The machinery spaces as the design states them: a bar across the hull at each room's station, labelled. */
export function MachineryLayoutLayer({
  frame,
  draft,
}: {
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
}) {
  const rooms = machineryRooms(draft);
  const top = PLAN_MID - frame.maxHalf - 2;
  const bottom = PLAN_MID + frame.maxHalf + 2;
  return (
    <g data-testid="machinery-layout">
      {rooms.map((room, i) => {
        const x = frame.x(room.stationPermille);
        return (
          <g key={`${room.zoneId}-${room.stationPermille}-${i}`} data-machinery-room={i}>
            <line
              x1={x}
              x2={x}
              y1={top}
              y2={bottom}
              className="pointer-events-none stroke-foreground"
              strokeWidth={STROKE.structure}
              strokeDasharray="2 2"
              {...NON_SCALING}
            />
            <text
              x={x + 3}
              y={top + 2}
              className="pointer-events-none fill-foreground font-medium"
              fontSize={LABEL_FONT}
            >
              {`M${i + 1}`}
            </text>
            <title>{`Machinery room ${i + 1} @ ${room.stationPermille}‰`}</title>
          </g>
        );
      })}
    </g>
  );
}

/** The longitudinal centre of gravity (real, from the compile), against the centre of buoyancy already drawn. */
export function MassMarkersLayer({
  frame,
  lcgPermille,
}: {
  readonly frame: PlanFrame;
  readonly lcgPermille: number;
}) {
  const x = frame.x(lcgPermille);
  return (
    <g data-testid="mass-markers">
      <g data-testid="mass-cg">
        <circle
          cx={x}
          cy={PLAN_MID}
          r={4}
          className="pointer-events-none fill-none stroke-foreground"
          strokeWidth={STROKE.structure}
          {...NON_SCALING}
        />
        <line x1={x - 4} x2={x + 4} y1={PLAN_MID} y2={PLAN_MID} className="stroke-foreground" />
        <line x1={x} x2={x} y1={PLAN_MID - 4} y2={PLAN_MID + 4} className="stroke-foreground" />
        <text
          x={x + 6}
          y={PLAN_MID + 3}
          className="pointer-events-none fill-foreground font-medium"
          fontSize={LABEL_FONT}
        >
          G
        </text>
        <title>{`Longitudinal centre of gravity, ${Math.round(lcgPermille)}‰ from the bow`}</title>
      </g>
    </g>
  );
}
