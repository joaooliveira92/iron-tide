import { cn } from "../../../lib/utils.js";
import type { ReadoutRow } from "../engineering-status.js";

/** A label/value list; `strong` marks a total. */
export function ReadoutRows({
  rows,
  strong,
}: {
  readonly rows: readonly ReadoutRow[];
  readonly strong?: boolean;
}) {
  return (
    <dl className="space-y-0.5">
      {rows.map((r) => (
        <div key={r.label} className={cn("flex justify-between gap-4", strong && "font-medium")}>
          <dt className={strong ? undefined : "text-muted-foreground"}>{r.label}</dt>
          <dd className="tabular-nums">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
