import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import type { EngineeringReadout } from "../engineering-status.js";
import { ReadoutItem } from "./ReadoutItem.js";

export function EngineeringStatusBar({
  readouts,
  format,
}: {
  readonly readouts: readonly EngineeringReadout[];
  readonly format: PresentationFormat;
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
          <ReadoutItem readout={r} format={format} />
        </span>
      ))}
    </section>
  );
}
