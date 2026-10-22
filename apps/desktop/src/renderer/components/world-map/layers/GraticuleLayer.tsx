export function GraticuleLayer({ d, stroke }: { d: string; stroke: string }) {
  return (
    <path d={d} stroke={stroke} strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" />
  );
}
