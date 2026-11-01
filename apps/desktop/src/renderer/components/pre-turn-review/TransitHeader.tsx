import { CircleAlert, OctagonAlert, ShieldCheck, type LucideIcon } from "lucide-react";

import { cn } from "../../lib/utils.js";
import { DialogDescription, DialogTitle } from "../ui/dialog.js";
import type { Verdict, VerdictKind } from "../preTurnReviewModel.js";

const TICKS = Array.from({ length: 31 }, (_, day) => day);

const VERDICT_STYLE: Readonly<
  Record<VerdictKind, { readonly chip: string; readonly Icon: LucideIcon }>
> = {
  clear: { chip: "border-success/40 bg-success/10 text-success", Icon: ShieldCheck },
  caution: { chip: "border-warning/50 bg-warning/10 text-warning", Icon: CircleAlert },
  hold: { chip: "border-destructive/50 bg-destructive/10 text-destructive", Icon: OctagonAlert },
};

export function TransitHeader({
  current,
  next,
  verdict,
}: {
  readonly current: string;
  readonly next: string;
  readonly verdict: Verdict;
}) {
  const { chip, Icon } = VERDICT_STYLE[verdict.kind];
  return (
    <header className="slate-grid relative shrink-0 border-b border-border/70 px-6 pt-5 pb-4">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-admiralty-accent/80 to-transparent"
      />
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pr-8">
        <div className="min-w-0">
          <DialogTitle className="font-display text-xl font-semibold tracking-tight">
            Pre-turn review
          </DialogTitle>
          <DialogDescription className="mt-1 max-w-md text-xs leading-snug">
            The last look before the month turns. Everything below is the campaign as it stands, and
            nothing changes until you advance.
          </DialogDescription>
        </div>
        <div
          role="status"
          data-verdict={verdict.kind}
          className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2", chip)}
        >
          <Icon aria-hidden="true" className="size-5 shrink-0" />
          <div>
            <p className="font-display text-sm leading-tight font-semibold">{verdict.label}</p>
            <p className="text-xs leading-tight opacity-80">{verdict.detail}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Now</p>
          <p className="font-display text-2xl leading-none font-semibold tabular-nums">{current}</p>
        </div>
        <div aria-hidden="true" className="relative h-8">
          <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-end justify-between">
            {TICKS.map((day) => (
              <span
                key={day}
                className={cn(
                  "w-px bg-border",
                  day % 5 === 0 ? "h-3 bg-muted-foreground/60" : "h-1.5",
                )}
              />
            ))}
          </div>
          <span className="absolute top-1/2 left-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-admiralty-accent shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-admiralty-accent)_25%,transparent)]" />
          <span className="absolute top-1/2 right-0 size-3 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-admiralty-accent bg-background" />
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Next</p>
          <p className="font-display text-2xl leading-none font-semibold tabular-nums text-admiralty-accent">
            {next}
          </p>
        </div>
      </div>
    </header>
  );
}
