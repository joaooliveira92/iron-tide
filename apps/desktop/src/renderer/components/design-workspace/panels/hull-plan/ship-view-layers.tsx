import type { ReactNode } from "react";
import type { ArmourRegionId, DesignDraft } from "@bluewave/ship-design";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../../ui/hover-card.js";
import { AnatomyCardContent } from "./anatomy/AnatomyCardContent.js";
import type { AnatomyShip } from "./anatomy/ship-anatomy.js";
import { machineryRooms } from "../../selection/facts.js";
import { LABEL_FONT, NON_SCALING, STROKE } from "./drafting.js";
import { armourShape, BELT_INNER, BELT_OUTER, regionPath, stripPath } from "./armour-plan.js";
import { PLAN_MID, type PlanFrame } from "./geometry.js";
import { SECTION_IDS, SECTIONS } from "./section-meta.js";

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

/** A hoverable armour zone: the anatomy plate opens on the belt or citadel only. */
function ArmourHover({
  anatomy,
  id,
  title,
  children,
}: {
  readonly anatomy: AnatomyShip | undefined;
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  if (anatomy === undefined) return <>{children}</>;
  return (
    <HoverCard>
      <HoverCardTrigger render={<g className="cursor-help" />}>{children}</HoverCardTrigger>
      <HoverCardContent
        side="top"
        collisionPadding={12}
        className="w-[26rem] max-w-[min(26rem,calc(100vw-2rem))] p-2"
      >
        <AnatomyCardContent
          plate={anatomy}
          highlight={id}
          title={title}
          detail={anatomy.facts.get(id)}
          testId="armour-anatomy"
        />
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * The citadel and the armoured belt. SCHEMATIC: the belt and citadel lengths are real, but the design model gives
 * no station for either, so both are drawn amidships — a convention, not a position from the design.
 */
export function ArmourZoneLayer({
  frame,
  draft,
  highlight,
  anatomy,
}: {
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  /** The region the Protection editor has selected, highlighted over the scheme (presentation only). */
  readonly highlight?: ArmourRegionId | null;
  /** The isometric plate the belt and citadel hover cards show. Omitted, the zones stay inert. */
  readonly anatomy?: AnatomyShip;
}) {
  const lengthWlMm = Number(draft.hull.lengthWl);
  const citadelPermille = permilleOf(draft.armour.citadelLengthMm, lengthWlMm);
  const beltPermille = permilleOf(beltLengthMm(draft), lengthWlMm);
  const region =
    highlight == null ? undefined : draft.armour.regions.find((r) => r.region === highlight);
  const regionPermille = region === undefined ? 0 : permilleOf(region.lengthMm, lengthWlMm);
  const deckPermille = permilleOf(
    Math.max(
      0,
      ...draft.armour.regions
        .filter((r) => armourShape(r.region) === "deck")
        .map((r) => r.lengthMm),
    ),
    lengthWlMm,
  );
  if (citadelPermille <= 0 && beltPermille <= 0 && deckPermille <= 0 && regionPermille <= 0)
    return null;
  const amidships = (permille: number): readonly [number, number] => [
    (1000 - permille) / 2,
    (1000 + permille) / 2,
  ];
  const [c1, c2] = amidships(citadelPermille);
  const [b1, b2] = amidships(beltPermille);
  const [r1, r2] = amidships(regionPermille);
  const [d1, d2] = amidships(deckPermille);
  const hover = anatomy === undefined ? "pointer-events-none" : "cursor-help";
  const highlightShape = region === undefined ? undefined : armourShape(region.region);
  return (
    <g data-testid="armour-zones">
      <defs>
        <pattern
          id="plan-armour-deck"
          width={4}
          height={4}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={4} className="stroke-primary" strokeWidth={0.8} />
        </pattern>
      </defs>
      {citadelPermille > 0 && (
        <ArmourHover anatomy={anatomy} id="armour:citadel" title="Armoured citadel">
          <path
            d={regionPath(frame, c1, c2, BELT_INNER)}
            className={`fill-primary stroke-primary ${hover}`}
            fillOpacity={0.08}
            strokeOpacity={0.6}
            strokeDasharray="4 2"
            strokeWidth={STROKE.guide}
            {...NON_SCALING}
            data-testid="armour-citadel"
          >
            <title>{`Armoured citadel (${Math.round(citadelPermille)}‰ of length; amidships is a convention)`}</title>
          </path>
        </ArmourHover>
      )}
      {deckPermille > 0 && (
        <path
          d={regionPath(frame, d1, d2, BELT_INNER)}
          fill="url(#plan-armour-deck)"
          fillOpacity={0.55}
          className="pointer-events-none stroke-primary"
          strokeOpacity={0.5}
          strokeWidth={STROKE.guide}
          {...NON_SCALING}
          data-testid="armour-deck"
        >
          <title>{`Armoured deck (${Math.round(deckPermille)}‰ of length; amidships is a convention)`}</title>
        </path>
      )}
      {beltPermille > 0 && (
        <ArmourHover anatomy={anatomy} id="armour:belt" title="Main belt">
          <path
            d={stripPath(frame, b1, b2, BELT_OUTER, BELT_INNER)}
            className={`fill-primary stroke-primary ${hover}`}
            fillOpacity={0.45}
            strokeOpacity={0.9}
            strokeWidth={STROKE.structure}
            {...NON_SCALING}
            data-testid="armour-belt"
          >
            <title>{`Main belt (${Math.round(beltPermille)}‰ of length; amidships is a convention)`}</title>
          </path>
        </ArmourHover>
      )}
      {region !== undefined && regionPermille > 0 && (
        <path
          d={
            highlightShape === "strip"
              ? stripPath(frame, r1, r2, BELT_OUTER, BELT_INNER)
              : regionPath(frame, r1, r2, highlightShape === "deck" ? BELT_INNER : BELT_OUTER)
          }
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
        </path>
      )}
    </g>
  );
}

type CompartmentKind = "magazine" | "machinery" | "other";

/** Tint class per kind of section: magazines read warm, the machinery spaces take the accent. */
const COMPARTMENT_TINT: {
  readonly [K in CompartmentKind]: { readonly className: string; readonly opacity: number };
} = {
  magazine: { className: "fill-warning stroke-warning", opacity: 0.22 },
  machinery: { className: "fill-primary stroke-primary", opacity: 0.2 },
  other: { className: "fill-muted-foreground stroke-muted-foreground", opacity: 0.1 },
};

const compartmentKind = (zoneId: string): CompartmentKind =>
  zoneId.endsWith("_MAGAZINE")
    ? "magazine"
    : zoneId === "CENTRAL_MACHINERY"
      ? "machinery"
      : "other";

/** Section number, bow to stern, for the eight sections under the plan; undefined for any other zone. */
const sectionNumber = (zoneId: string): number | undefined => {
  const i = SECTION_IDS.findIndex((id) => SECTIONS[id].zoneId === zoneId);
  return i < 0 ? undefined : i + 1;
};

/**
 * The hull's internal subdivision: each section as a band that follows the hull, tinted by what the section is
 * (magazine, machinery, other) and numbered to match the strip under the drawing.
 */
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
      {zones.map((z) => {
        const kind = compartmentKind(z.id);
        const tint = COMPARTMENT_TINT[kind];
        const number = sectionNumber(z.id);
        return (
          <g key={z.id}>
            <path
              d={regionPath(frame, z.startPermille, z.endPermille, BELT_OUTER)}
              className={`pointer-events-none ${tint.className}`}
              fillOpacity={tint.opacity}
              strokeOpacity={0.45}
              strokeWidth={STROKE.guide}
              {...NON_SCALING}
              data-compartment={z.id}
              data-kind={kind}
            >
              <title>{z.id.replaceAll("_", " ").toLowerCase()}</title>
            </path>
            {number !== undefined && (
              <text
                x={frame.x((z.startPermille + z.endPermille) / 2)}
                y={PLAN_MID + frame.maxHalf * 0.8 + 3}
                textAnchor="middle"
                className="pointer-events-none fill-foreground font-medium"
                fontSize={LABEL_FONT}
                data-compartment-number={number}
              >
                {number}
              </text>
            )}
          </g>
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
