import { DASH, LABEL_FONT, NON_SCALING, STROKE } from "./drafting.js";
import { PLAN_MID, type PlanFrame } from "./geometry.js";

export type SectionHighlight = "preview" | "linked" | "selected";

const HIGHLIGHT: Record<
  SectionHighlight,
  { fill: number; width: number; dash: string | undefined; testId: string }
> = {
  preview: {
    fill: 0.1,
    width: STROKE.structure,
    dash: DASH.zoneGuide,
    testId: "section-highlight",
  },
  linked: { fill: 0, width: STROKE.structure, dash: "1 3", testId: "section-linked" },
  selected: { fill: 0.16, width: 2.2, dash: undefined, testId: "section-selected" },
};

export function SectionHighlightLayer({
  frame,
  zone,
  variant = "preview",
}: {
  readonly frame: PlanFrame;
  readonly zone:
    | { readonly id: string; readonly startPermille: number; readonly endPermille: number }
    | undefined;
  readonly variant?: SectionHighlight;
}) {
  if (!zone) return null;
  const style = HIGHLIGHT[variant];
  return (
    <rect
      x={frame.x(zone.startPermille)}
      width={frame.x(zone.endPermille) - frame.x(zone.startPermille)}
      y={PLAN_MID - frame.maxHalf - 4}
      height={frame.maxHalf * 2 + 8}
      className="pointer-events-none fill-primary stroke-primary"
      fillOpacity={style.fill}
      strokeOpacity={0.75}
      strokeWidth={style.width}
      strokeDasharray={style.dash}
      {...NON_SCALING}
      data-testid={style.testId}
      data-zone={zone.id}
      aria-hidden="true"
    />
  );
}

export function MachineryRoomMarker({
  frame,
  stationPermille,
  variant,
}: {
  readonly frame: PlanFrame;
  readonly stationPermille: number;
  readonly variant: "linked" | "selected";
}) {
  const x = frame.x(stationPermille);
  const top = PLAN_MID - frame.maxHalf - 2;
  return (
    <g
      className="pointer-events-none"
      aria-hidden="true"
      data-testid={`room-${variant}`}
      data-station={stationPermille}
    >
      <line
        x1={x}
        x2={x}
        y1={top}
        y2={PLAN_MID + frame.maxHalf + 2}
        className="stroke-primary"
        strokeWidth={variant === "selected" ? 2.2 : STROKE.structure}
        strokeDasharray={variant === "linked" ? "1 3" : undefined}
        {...NON_SCALING}
      />
      <text x={x + 3} y={top + 2} className="fill-primary font-medium" fontSize={LABEL_FONT}>
        M
      </text>
    </g>
  );
}
