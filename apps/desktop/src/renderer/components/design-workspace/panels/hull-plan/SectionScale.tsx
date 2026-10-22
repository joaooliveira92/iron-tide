import { NON_SCALING, STROKE } from "./drafting.js";
import { CARD_FONT, PAD_X, SCALE_Y, SECTION_W, type SectionLayout } from "./section-drawing.js";

export function SectionScale({ layout }: { readonly layout: SectionLayout }) {
  return (
    <>
      {layout.ticks.map((p) => (
        <line
          key={p}
          x1={layout.X(p)}
          x2={layout.X(p)}
          y1={SCALE_Y - 12}
          y2={SCALE_Y - (p % (layout.step * 2) === 0 ? 6 : 9)}
          className="stroke-muted-foreground"
          strokeWidth={STROKE.guide}
          {...NON_SCALING}
        />
      ))}
      <line
        x1={PAD_X}
        x2={SECTION_W - PAD_X}
        y1={SCALE_Y - 12}
        y2={SCALE_Y - 12}
        className="stroke-muted-foreground"
        strokeWidth={STROKE.guide}
        {...NON_SCALING}
      />
      <text
        x={layout.x0}
        y={SCALE_Y + 4}
        textAnchor="middle"
        className="fill-muted-foreground"
        fontSize={CARD_FONT}
      >
        {`${layout.zone.startPermille}‰`}
      </text>
      <text
        x={layout.x1}
        y={SCALE_Y + 4}
        textAnchor="middle"
        className="fill-muted-foreground"
        fontSize={CARD_FONT}
      >
        {`${layout.zone.endPermille}‰`}
      </text>
    </>
  );
}
