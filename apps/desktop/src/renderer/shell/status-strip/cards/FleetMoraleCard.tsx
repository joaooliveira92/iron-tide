import { Anchor } from "lucide-react";

import type { ExplanationTree } from "@bluewave/events";

import { cn } from "../../../lib/utils.js";
import type { FleetMoraleGauge } from "../../fleet-morale-strip.js";
import { usePresentationFormat } from "../../usePresentationFormat.js";
import { ExplanationDisclosure } from "../../../components/shared/ExplanationDisclosure.js";
import { CardFoot, CardHeader, StripGlyph } from "../StripGlyph.js";

export function FleetMoraleCard({
  gauge,
  note,
  explanation,
}: {
  readonly gauge: FleetMoraleGauge;
  readonly note: string;
  readonly explanation?: ExplanationTree;
}) {
  const format = usePresentationFormat();
  return (
    <>
      <CardHeader
        title="Fleet morale"
        icon={<Anchor className="size-3.5" />}
        tone={gauge.lowered ? "alert" : "normal"}
        aside={
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              gauge.lowered ? "text-destructive" : "text-success",
            )}
          >
            {gauge.lowered ? "Lowered" : "Full"}
          </span>
        }
      />
      <div className="space-y-3 px-3 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-2xl leading-7 font-semibold tabular-nums">
            {gauge.current}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            of {gauge.max}, no effect yet
          </span>
        </div>
        <StripGlyph
          variant="meter"
          fraction={gauge.fraction}
          fill={gauge.lowered ? "bg-destructive" : "bg-admiralty-accent"}
          className="h-2"
        />
        {explanation === undefined ? null : (
          <ExplanationDisclosure
            tree={explanation}
            area="strategic"
            summaryKey="strategic.fleet_morale_change.summary"
            format={format}
            testId="fleet-morale-change-explanation"
          />
        )}
      </div>
      <CardFoot>{note}</CardFoot>
    </>
  );
}
