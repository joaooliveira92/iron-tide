import { Beaker, Lightbulb, ListChecks } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { GlassSectionCard } from "../../../components/shared/GlassSectionCard.js";
import type { ResearchTechBadge } from "../research-view-model.js";

export interface ResearchSummarySectionsProps {
  readonly researchBudget: number;
  readonly currentProjectLabel: string | null;
  readonly discoveredTechs: readonly ResearchTechBadge[];
}

export function ResearchSummarySections({
  researchBudget,
  currentProjectLabel,
  discoveredTechs,
}: ResearchSummarySectionsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <GlassSectionCard
        icon={<Beaker className="h-4 w-4 text-muted-foreground" />}
        title="Research budget"
      >
        <p className="text-2xl font-semibold tracking-tight">{researchBudget.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">points available to allocate this month</p>
      </GlassSectionCard>

      <GlassSectionCard
        icon={<Lightbulb className="h-4 w-4 text-muted-foreground" />}
        title="Current project"
      >
        {currentProjectLabel === null ? (
          <p className="text-sm text-muted-foreground">No active project selected</p>
        ) : (
          <p className="text-sm">{currentProjectLabel}</p>
        )}
      </GlassSectionCard>

      <GlassSectionCard
        icon={<ListChecks className="h-4 w-4 text-muted-foreground" />}
        title="Discovered technologies"
      >
        {discoveredTechs.length === 0 ? (
          <p className="text-sm text-muted-foreground">None discovered yet</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {discoveredTechs.map((tech) => (
              <Badge key={tech.techId} variant="outline">
                {tech.label}
              </Badge>
            ))}
          </div>
        )}
      </GlassSectionCard>
    </div>
  );
}
