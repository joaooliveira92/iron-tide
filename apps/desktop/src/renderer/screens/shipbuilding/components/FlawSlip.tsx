import { useState } from "react";
import { ChevronLeft, ChevronRight, Crosshair, ListChecks, Wrench } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { Slate } from "../../../components/slate/Slate.js";
import { formatExplanation } from "../../../lib/presentation-format/index.js";
import { SEVERITY_STYLE } from "../../../components/design-workspace/validation/severity.js";
import { cn } from "../../../lib/utils.js";
import type { Flaw } from "../flaw.js";

export interface FlawSlipProps {
  readonly flaws: readonly Flaw[];
  readonly onShow: (flaw: Flaw) => void;
  readonly onFix: (flaw: Flaw) => void;
  readonly onReview: () => void;
}

const EDGE: { readonly [T in Flaw["tier"]]: string } = {
  blocking: "border-l-destructive",
  critical: "border-l-destructive",
  warning: "border-l-warning",
};

const TIER_SEVERITY = {
  blocking: "BLOCKING",
  critical: "CRITICAL",
  warning: "WARNING",
} as const;

export function FlawSlip({ flaws, onShow, onFix, onReview }: FlawSlipProps) {
  const [cursor, setCursor] = useState(0);
  if (flaws.length === 0) return null;
  const index = Math.min(cursor, flaws.length - 1);
  const flaw = flaws[index]!;
  const { Icon, tone } = SEVERITY_STYLE[TIER_SEVERITY[flaw.tier]];
  const step = (by: number) => setCursor((index + by + flaws.length) % flaws.length);
  return (
    <Slate
      aria-label="Design problems"
      data-testid="flaw-slip"
      data-tier={flaw.tier}
      className={cn("w-[min(34rem,100%)] border-l-4", EDGE[flaw.tier])}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", tone)} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className={cn("font-display font-semibold", tone)}>{flaw.verdict}</span>
            {flaws.length > 1 && (
              <span className="flex items-center gap-1 text-xs text-admiralty-ink-muted">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Previous problem"
                  onClick={() => step(-1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <span className="tabular-nums" aria-live="polite">
                  {index + 1} of {flaws.length}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Next problem"
                  onClick={() => step(1)}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </span>
            )}
          </p>
          <p className="text-sm font-medium leading-snug">{flaw.finding.title}</p>
          <p className="text-sm leading-snug text-admiralty-ink-muted">
            {formatExplanation(flaw.finding.finding.consequence)}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {flaw.showOn !== null && (
              <Button type="button" size="sm" variant="outline" onClick={() => onShow(flaw)}>
                <Crosshair aria-hidden="true" className="mr-1 size-3.5" />
                Show on ship
              </Button>
            )}
            {flaw.fix !== null && (
              <Button type="button" size="sm" onClick={() => onFix(flaw)}>
                <Wrench aria-hidden="true" className="mr-1 size-3.5" />
                {flaw.fix.label}
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={onReview}>
              <ListChecks aria-hidden="true" className="mr-1 size-3.5" />
              All findings
            </Button>
          </div>
        </div>
      </div>
    </Slate>
  );
}
