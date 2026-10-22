import { NON_SCALING, STROKE } from "./drafting.js";

export function WarningGlyph({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <g data-testid="selection-warning" aria-hidden="true">
      <polygon
        points={`${x},${y - 6} ${x + 6},${y + 4} ${x - 6},${y + 4}`}
        className="fill-warning stroke-foreground"
        strokeWidth={STROKE.guide}
        {...NON_SCALING}
      />
      <line x1={x} x2={x} y1={y - 3} y2={y + 1} className="stroke-foreground" strokeWidth={1.2} />
    </g>
  );
}
