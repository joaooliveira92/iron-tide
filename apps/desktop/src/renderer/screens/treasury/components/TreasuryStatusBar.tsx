import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { cn } from "../../../lib/utils.js";
import { SlateBody, SlateFacts, SlateFoot, SlateHeader } from "../../../components/ui/slate.js";
import type { ReadoutTone, TreasuryReadout } from "../treasury-readouts.js";

const TONE: Record<ReadoutTone, string> = {
  neutral: "text-foreground",
  good: "text-success",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-destructive",
};

function Readout({ readout: r }: { readonly readout: TreasuryReadout }) {
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={0}
        render={<button type="button" />}
        data-status={r.id}
        data-tone={r.tone}
        aria-label={`${r.label}: ${r.value} — show detail`}
        className="-mx-1 flex cursor-default items-baseline gap-2 rounded px-1 py-0.5 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-xs text-muted-foreground">{r.label}</span>
        <span className={cn("font-medium tabular-nums", TONE[r.tone])}>{r.value}</span>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-72">
        <SlateHeader title={r.title} />
        <SlateBody>
          <SlateFacts rows={r.rows} />
        </SlateBody>
        {r.note !== undefined && <SlateFoot>{r.note}</SlateFoot>}
      </HoverCardContent>
    </HoverCard>
  );
}

export function TreasuryStatusBar({ readouts }: { readonly readouts: readonly TreasuryReadout[] }) {
  return (
    <section
      aria-label="Treasury status"
      className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-1 border-t bg-muted/40 px-4 py-2 text-sm"
    >
      {readouts.map((r) => (
        <Readout key={r.id} readout={r} />
      ))}
    </section>
  );
}
