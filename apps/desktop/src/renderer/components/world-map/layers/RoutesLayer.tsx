import { memo } from "react";

export const RoutesLayer = memo(function RoutesLayer({
  d,
  stroke,
  casing,
}: {
  readonly d: string;
  readonly stroke: string;
  readonly casing: string;
}) {
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
});
