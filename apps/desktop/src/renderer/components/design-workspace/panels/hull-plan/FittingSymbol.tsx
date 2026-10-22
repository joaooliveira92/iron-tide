import { NON_SCALING, STROKE } from "./drafting.js";
import type { FittingKind } from "./sections.js";

export function FittingSymbol({
  kind,
  x,
  y,
  hatch,
}: {
  readonly kind: FittingKind;
  readonly x: number;
  readonly y: number;
  readonly hatch: string;
}) {
  const stroke = { strokeWidth: STROKE.structure, ...NON_SCALING };
  switch (kind) {
    case "gun":
      return (
        <>
          <circle cx={x} cy={y} r={6.5} className="fill-background stroke-foreground" {...stroke} />
          <circle cx={x} cy={y} r={2} className="fill-primary" />
        </>
      );
    case "torpedo":
      return (
        <rect
          x={x - 8}
          y={y - 2.5}
          width={16}
          height={5}
          rx={2.5}
          className="fill-background stroke-foreground"
          {...stroke}
        />
      );
    case "magazine":
      return (
        <rect
          x={x - 7}
          y={y - 5}
          width={14}
          height={10}
          fill={hatch}
          className="stroke-foreground"
          {...stroke}
        />
      );
    case "machinery":
      return (
        <rect
          x={x - 8}
          y={y - 5}
          width={16}
          height={10}
          className="fill-muted stroke-foreground"
          {...stroke}
        />
      );
    case "funnel":
      return <circle cx={x} cy={y} r={2.5} className="fill-foreground" />;
    case "other":
      return (
        <polygon
          points={`${x},${y - 5} ${x + 5},${y} ${x},${y + 5} ${x - 5},${y}`}
          className="fill-primary stroke-primary"
          strokeWidth={STROKE.structure}
          {...NON_SCALING}
        />
      );
  }
}
