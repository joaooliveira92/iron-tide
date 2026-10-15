import type { Delta } from "./optionDelta.js";

/**
 * A compact, read-only list of what an option would change (see `optionDelta`). Presentation only: it previews a
 * consequence and never commits it.
 */
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
