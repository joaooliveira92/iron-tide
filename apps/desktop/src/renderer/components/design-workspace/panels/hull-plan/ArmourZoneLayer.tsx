import type { ArmourRegionId, DesignDraft } from "@bluewave/ship-design";
import type { AnatomyShip } from "./anatomy/ship-anatomy.js";
import { NON_SCALING, STROKE } from "./drafting.js";
import { armourShape, BELT_INNER, BELT_OUTER, regionPath, stripPath } from "./armour-plan.js";
import type { PlanFrame } from "./geometry.js";
import { ArmourHover } from "./ArmourHover.js";

const beltLengthMm = (draft: DesignDraft): number =>
  draft.armour.regions
    .filter((r) => r.region === "BELT_MAIN")
    .reduce((total, r) => total + r.lengthMm, 0);

const permilleOf = (lengthMm: number, lengthWlMm: number): number => {
  if (lengthWlMm <= 0) return 0;
  return Math.max(0, Math.min(1000, (lengthMm * 1000) / lengthWlMm));
};

export function ArmourZoneLayer({
  frame,
  draft,
  highlight,
  anatomy,
}: {
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  readonly highlight?: ArmourRegionId | null;
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
