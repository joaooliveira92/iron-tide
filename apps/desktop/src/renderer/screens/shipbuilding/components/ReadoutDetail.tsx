import type { ReadoutRow } from "../engineering-status.js";
import { ReadoutRows } from "./ReadoutRows.js";

/** A readout's detail: its title, the lines behind the number, any causes, and an optional total. */
export function ReadoutDetail({
  title,
  rows,
  causes,
  footer,
}: {
  readonly title: string;
  readonly rows: readonly ReadoutRow[];
  readonly causes?: readonly string[];
  readonly footer?: readonly ReadoutRow[];
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">{title}</div>
      <ReadoutRows rows={rows} />
      {causes !== undefined && causes.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {causes.map((cause, i) => (
            <li key={i}>{cause}</li>
          ))}
        </ul>
      )}
      {footer !== undefined && (
        <div className="border-t pt-2">
          <ReadoutRows rows={footer} strong />
        </div>
      )}
    </div>
  );
}
