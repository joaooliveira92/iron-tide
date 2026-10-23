import type { EngineeringReadout } from "../../shipbuilding/engineering-status.js";
import { ReadoutItem } from "../../shipbuilding/components/ReadoutItem.js";

export function ForeignStatusBar({
  readouts,
}: {
  readonly readouts: readonly EngineeringReadout[];
}) {
  return (
    <section
      aria-label="Foreign status"
      className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-1 border-t bg-muted/40 px-4 py-2 text-sm"
    >
      {readouts.map((readout) => (
        <span
          key={readout.id}
          data-status={readout.id}
          data-tone={readout.tone}
          className="inline-flex items-baseline"
        >
          <ReadoutItem readout={readout} />
        </span>
      ))}
    </section>
  );
}
