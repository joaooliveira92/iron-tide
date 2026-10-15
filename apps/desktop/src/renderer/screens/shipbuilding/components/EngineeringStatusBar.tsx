import type { EngineeringReadout } from "../engineering-status.js";
import { ReadoutItem } from "./ReadoutItem.js";

/** The persistent bottom strip: the engineering outcomes that must never scroll out of sight. */
export function EngineeringStatusBar({
  readouts,
}: {
  readonly readouts: readonly EngineeringReadout[];
}) {
  return (
    <section
      aria-label="Engineering status"
      className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-1 border-t bg-muted/40 px-4 py-2 text-sm"
    >
      {readouts.map((r) => (
        <span
          key={r.id}
          data-status={r.id}
          data-tone={r.tone}
          className="inline-flex items-baseline"
        >
          <ReadoutItem readout={r} />
        </span>
      ))}
    </section>
  );
}
