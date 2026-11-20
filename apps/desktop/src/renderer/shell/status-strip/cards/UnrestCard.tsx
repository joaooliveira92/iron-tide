import { Users } from "lucide-react";

import type { ExplanationTree } from "@bluewave/events";

import type { UnrestGauge } from "../../unrest-strip.js";
import { usePresentationFormat } from "../../usePresentationFormat.js";
import { ExplanationDisclosure } from "../../../components/shared/ExplanationDisclosure.js";
import { CardFoot, CardHeader, StripGlyph } from "../StripGlyph.js";

export function UnrestCard({
  gauge,
  note,
  explanation,
}: {
  readonly gauge: UnrestGauge;
  readonly note: string;
  readonly explanation?: ExplanationTree;
}) {
  const format = usePresentationFormat();
  return (
    <>
      <CardHeader title="Unrest level" icon={<Users className="size-3.5" />} tone="normal" />
      <div className="space-y-3 px-3 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-2xl leading-7 font-semibold tabular-nums">
            {gauge.current}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">of {gauge.max}</span>
        </div>
        <StripGlyph
          variant="meter"
          fraction={gauge.fraction}
          fill="bg-admiralty-accent"
          className="h-2"
        />
        {explanation === undefined ? null : (
          <ExplanationDisclosure
            tree={explanation}
            area="strategic"
            summaryKey="strategic.unrest_change.summary"
            format={format}
            testId="unrest-change-explanation"
          />
        )}
      </div>
      <CardFoot>{note}</CardFoot>
    </>
  );
}
