import type { Delta } from "./optionDelta.js";

export function DeltaPreview({
  deltas,
  label = "Change",
}: {
  readonly deltas: readonly Delta[];
  readonly label?: string;
}) {
  if (deltas.length === 0) return null;
  return (
    <ul
      data-testid="delta-preview"
      aria-label={label}
      className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground"
    >
      {deltas.map((d) => (
        <li key={d.id} data-delta={d.id} className="flex items-baseline gap-1">
          <span>{d.label}</span>
          <span className="tabular-nums text-foreground">{d.text}</span>
        </li>
      ))}
    </ul>
  );
}
