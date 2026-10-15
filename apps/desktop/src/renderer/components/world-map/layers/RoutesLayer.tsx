/** The ruler route: a dark casing under a dashed highlight along its legs. */
export function RoutesLayer({ d, stroke }: { d: string; stroke: string }) {
  if (d === "") return null;
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke="oklch(0.2 0 0 / 0.6)"
        strokeWidth={6}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
      />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
        strokeDasharray="10 6"
        strokeLinecap="round"
      />
    </>
  );
}
