export function RoutesLayer({ d, stroke, casing }: { d: string; stroke: string; casing: string }) {
  if (d === "") return null;
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke={casing}
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
