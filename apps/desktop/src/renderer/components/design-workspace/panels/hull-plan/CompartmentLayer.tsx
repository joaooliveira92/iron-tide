import { LABEL_FONT, NON_SCALING, STROKE } from "./drafting.js";
import { BELT_OUTER, regionPath } from "./armour-plan.js";
import { PLAN_MID, type PlanFrame } from "./geometry.js";
import { SECTION_IDS, SECTIONS } from "./section-meta.js";

type CompartmentKind = "magazine" | "machinery" | "other";

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

const sectionNumber = (zoneId: string): number | undefined => {
  const i = SECTION_IDS.findIndex((id) => SECTIONS[id].zoneId === zoneId);
  return i < 0 ? undefined : i + 1;
};

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
