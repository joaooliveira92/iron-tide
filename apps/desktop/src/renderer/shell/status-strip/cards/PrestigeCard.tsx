import { Crown } from "lucide-react";

import type { ExplanationTree } from "@bluewave/events";

import { cn } from "../../../lib/utils.js";
import type { PrestigeGauge } from "../../status-strip-state.js";
import { usePresentationFormat } from "../../usePresentationFormat.js";
import { ExplanationDisclosure } from "../../../components/shared/ExplanationDisclosure.js";
import { CardFoot, CardHeader, percentString, clamp01, StripGlyph } from "../StripGlyph.js";

export function PrestigeCard({
  gauge,
  note,
  explanation,
}: {
  readonly gauge: PrestigeGauge;
  readonly note: string;
  readonly explanation?: ExplanationTree;
}) {
  const format = usePresentationFormat();
  const margin = gauge.current - gauge.threshold;
  return (
    <>
      <CardHeader
        title="Prestige"
        icon={<Crown className="size-3.5" />}
        tone={gauge.atRisk ? "alert" : "normal"}
        aside={
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              gauge.atRisk ? "text-destructive" : "text-success",
            )}
          >
            {gauge.atRisk ? "Dismissal risk" : "Secure"}
          </span>
        }
      />
      <div className="space-y-3 px-3 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-2xl leading-7 font-semibold tabular-nums">
            {gauge.current}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {margin >= 0 ? `${String(margin)} above` : `${String(-margin)} below`} the sacking line
          </span>
        </div>
        <div className="space-y-1">
          <StripGlyph
            variant="meter"
            fraction={gauge.fraction}
            mark={gauge.thresholdFraction}
            fill={gauge.atRisk ? "bg-destructive" : "bg-admiralty-accent"}
            className="h-2"
          />
          <div className="relative h-4 text-xs tabular-nums text-muted-foreground">
            <span className="absolute left-0">0</span>
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap text-foreground"
              style={{ left: percentString(clamp01(gauge.thresholdFraction)) }}
            >
              sacked at {gauge.threshold}
            </span>
          </div>
        </div>
        {explanation === undefined ? null : (
          <ExplanationDisclosure
            tree={explanation}
            area="strategic"
            summaryKey="strategic.prestige_change.summary"
            format={format}
            testId="prestige-change-explanation"
          />
        )}
      </div>
      <CardFoot>{note}</CardFoot>
    </>
  );
}
