import { Beaker } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { GlassSectionCard } from "../../../components/shared/GlassSectionCard.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { ResearchProgressRow } from "../research-view-model.js";

export interface InProgressTechnologiesCardProps {
  readonly technologies: readonly ResearchProgressRow[];
}

export function InProgressTechnologiesCard({ technologies }: InProgressTechnologiesCardProps) {
  const format = usePresentationFormat();
  return (
    <GlassSectionCard
      icon={<Beaker className="h-4 w-4 text-muted-foreground" />}
      title="In-progress technology work"
      description="Invested points per technology from the compiled snapshot."
    >
      {technologies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No technology work recorded yet</p>
      ) : (
        <div className="space-y-1.5">
          {technologies.map((tech) => (
            <div
              key={tech.techId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{tech.label}</span>
                {tech.completed && <Badge variant="secondary">completed</Badge>}
                {tech.isCurrentProject && <Badge variant="outline">current project</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">
                {format.count(tech.investedPoints)} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </GlassSectionCard>
  );
}
