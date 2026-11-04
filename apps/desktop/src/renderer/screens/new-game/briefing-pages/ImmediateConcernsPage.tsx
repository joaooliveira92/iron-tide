import { Flag } from "lucide-react";
import { GlassCard } from "../../../components/ui/glass-card.js";
import type { OpeningBriefingPageViewProps } from "./opening-briefing-page-views.js";

export function ImmediateConcernsPage({ projection }: OpeningBriefingPageViewProps) {
  const concerns = projection.immediateConcerns;
  return (
    <GlassCard glassVariant="liquid-refract">
      <div className="flex flex-col p-4">
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Immediate concerns
        </p>
        {concerns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pressing concerns to report.</p>
        ) : (
          concerns.map((concern) => (
            <div key={concern.category} className="flex items-start gap-2 py-1.5">
              <Flag className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{concern.message}</p>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
