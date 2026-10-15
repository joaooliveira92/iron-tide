import { arcSectors, sectorPath } from "./arcs.js";
import { FittingSymbol } from "./FittingSymbol.js";
import { fittingPoint, type PlanFrame } from "./geometry.js";
import { CARD_FONT, type SectionLayout } from "./section-drawing.js";
import type { SectionFacts } from "./sections.js";

/** Drawn radius of a gun's arc wedge, px: schematic, range is not data. Deliberately smaller than the main plan's
 * 30 (`fitting-layers.tsx`) because the card magnifies the plan; unifying them would change the drawing. */
const ARC_R = 26;

/**
 * The section's fittings over everything else in the plan band: each placed exactly where the main plan puts it
 * (same `fittingPoint`), with its gun arc, symbol and callout number.
 */
export function SectionFittingOverlay({
  layout,
  frame,
  facts,
  clip,
}: {
  readonly layout: SectionLayout;
  readonly frame: PlanFrame;
  readonly facts: SectionFacts;
  readonly clip: string;
}) {
  return (
    <g clipPath={`url(#${clip}-plan)`}>
      {facts.fittings.map((f) => {
        const pt = fittingPoint(frame, f.stationPermille, f.side, f.placementIndex);
        const x = layout.a * pt.x + layout.b;
        const y = layout.ky * pt.y + layout.planTy;
        return (
          <g key={f.instanceId} data-fitting={f.instanceId} data-kind={f.kind}>
            {f.kind === "gun" &&
              arcSectors(f.instanceId, f.side, f.arcDeg).map((sec) => (
                <path
                  key={sec.beam}
                  d={sectorPath(x, y, ARC_R, sec)}
                  className="fill-primary stroke-primary"
                  fillOpacity={0.12}
                  strokeOpacity={0.4}
                />
              ))}
            <FittingSymbol kind={f.kind} x={x} y={y} hatch={`url(#${clip}-hatch)`} />
            <text
              x={x + 9}
              y={y - 7}
              className="fill-foreground font-medium"
              fontSize={CARD_FONT - 1}
            >
              {f.n}
            </text>
          </g>
        );
      })}
    </g>
  );
}
