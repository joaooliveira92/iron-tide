import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import type { EngineeringReadout } from "../engineering-status.js";
import { ReadoutDetail } from "./ReadoutDetail.js";
import { ReadoutValue } from "./ReadoutValue.js";

const TRIGGER =
  "-mx-1 flex items-baseline gap-1.5 rounded px-1 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring";

export function ReadoutItem({
  readout: r,
  format,
}: {
  readonly readout: EngineeringReadout;
  readonly format?: PresentationFormat;
}) {
  const value = <ReadoutValue label={r.label} value={r.value} tone={r.tone} />;
  if (r.breakdown !== undefined) {
    return (
      <Popover>
        <PopoverTrigger aria-label={`${r.label}: ${r.value} — show breakdown`} className={TRIGGER}>
          {value}
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-72 p-0">
          <ReadoutDetail
            title={r.breakdown.title}
            rows={r.breakdown.rows}
            causes={r.breakdown.causes}
            footer={r.breakdown.footer}
            explanations={r.explanations}
            format={format}
          />
        </PopoverContent>
      </Popover>
    );
  }
  if (r.hint !== undefined) {
    return (
      <HoverCard>
        <HoverCardTrigger
          delay={0}
          closeDelay={0}
          aria-label={`${r.label}: ${r.value} — show detail`}
          className={TRIGGER}
        >
          {value}
        </HoverCardTrigger>
        <HoverCardContent side="top" align="start" className="w-64">
          <ReadoutDetail
            title={r.hint.title}
            rows={r.hint.lines}
            explanations={r.explanations}
            format={format}
          />
        </HoverCardContent>
      </HoverCard>
    );
  }
  return <span className="flex items-baseline gap-1.5">{value}</span>;
}
