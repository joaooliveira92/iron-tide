import { Check } from "lucide-react";
import { memo } from "react";
import { SlidePanel } from "@/components/slide-panel/index.js";
import { CardContent, CardHeader } from "@/components/ui/card.js";
import { GlassCard } from "@/components/ui/glass-card.js";
import type { FleetMethodCardContent } from "../../fleet-method-content.js";

export interface FleetMethodDetailPanelProps {
  readonly card: FleetMethodCardContent;
  readonly applied: boolean;
  readonly pending: boolean;
}

export const FleetMethodDetailPanel = memo(function FleetMethodDetailPanel({
  card,
  applied,
  pending,
}: FleetMethodDetailPanelProps) {
  const headingId = `fleet-method-detail-heading-${card.id}`;

  return (
    <SlidePanel isOpen placement="inline" animateOnMount aria-labelledby={headingId}>
      <GlassCard glassVariant="liquid-refract">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={headingId} className="text-lg font-semibold tracking-tight">
              {card.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{card.tagline}</p>
          </div>

          {applied ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded bg-admiralty-accent px-2.5 py-1 font-display text-[0.7rem] font-black uppercase tracking-wider text-admiralty-accent-foreground">
              <Check className="h-3 w-3" aria-hidden="true" />
              Active
            </span>
          ) : pending ? (
            <span className="shrink-0 font-display text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              Applies on Next
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
          {card.note !== null && (
            <p className="mt-3 text-xs italic text-muted-foreground">{card.note}</p>
          )}
        </CardContent>
      </GlassCard>
    </SlidePanel>
  );
});
