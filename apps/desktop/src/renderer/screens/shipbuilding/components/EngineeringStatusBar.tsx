import type { ReactNode } from "react";
import { Slate } from "../../../components/slate/Slate.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import type { EngineeringReadout } from "../engineering-status.js";
import { ReadoutItem } from "./ReadoutItem.js";

export function EngineeringStatusBar({
  readouts,
  format,
  lead,
}: {
  readonly readouts: readonly EngineeringReadout[];
  readonly format: PresentationFormat;
  readonly lead?: ReactNode;
}) {
  return (
    <Slate
      aria-label="Engineering status"
      className="flex w-[min(52rem,100%)] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-sm"
    >
      {lead}
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
    </Slate>
  );
}
