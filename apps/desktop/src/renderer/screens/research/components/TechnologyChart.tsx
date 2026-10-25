import { useMemo, useState } from "react";
import { cn } from "../../../lib/utils.js";
import { layoutFieldChart, relatedTechIds } from "../research-chart-layout.js";
import type { ResearchFieldView } from "../research-view-model.js";
import { TechnologyNode } from "./TechnologyNode.js";
import { TECH_STATUS, TECH_STATUS_ORDER } from "./tech-status.js";

const GRID =
  "[background-image:linear-gradient(to_right,color-mix(in_oklab,var(--border)_45%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--border)_45%,transparent)_1px,transparent_1px)] [background-size:24px_24px]";

export interface TechnologyChartProps {
  readonly field: ResearchFieldView;
  readonly selectedTechId: string | null;
  readonly onSelectTech: (techId: string) => void;
}

export function TechnologyChart({ field, selectedTechId, onSelectTech }: TechnologyChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const layout = useMemo(
    () =>
      layoutFieldChart(
        field.techs.map((t) => ({
          techId: t.techId,
          prerequisiteIds: t.prerequisites.map((p) => p.techId),
          cost: t.cost,
        })),
      ),
    [field.techs],
  );
  const techById = useMemo(
    () => new Map(field.techs.map((t) => [t.techId, t] as const)),
    [field.techs],
  );
  const related = useMemo(
    () => (hovered === null ? null : relatedTechIds(layout, hovered)),
    [hovered, layout],
  );

  if (field.techs.length === 0) {
    return (
      <div className="grid h-full min-h-48 place-items-center p-6 text-center text-sm text-muted-foreground">
        <p className="max-w-sm">There is nothing to chart for {field.label} yet.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="themed-scrollbar min-h-0 flex-1 overflow-auto">
        <div
          data-testid="technology-chart"
          className={cn("relative min-h-full min-w-full", GRID)}
          style={{ width: layout.width, height: layout.height }}
        >
          <svg
            aria-hidden="true"
            width={layout.width}
            height={layout.height}
            className="pointer-events-none absolute inset-0"
          >
            {layout.edges.map((edge) => {
              const done = techById.get(edge.fromId)?.status === "discovered";
              const lit = related !== null && related.has(edge.fromId) && related.has(edge.toId);
              return (
                <path
                  key={`${edge.fromId}-${edge.toId}`}
                  d={edge.path}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={done ? undefined : "4 5"}
                  className={cn(
                    "transition-[opacity,stroke] duration-200 motion-reduce:transition-none",
                    done || lit ? "stroke-primary" : "stroke-muted-foreground/50",
                    lit ? "opacity-100" : related === null ? "opacity-70" : "opacity-15",
                  )}
                  strokeWidth={lit ? 2.25 : 1.5}
                />
              );
            })}
          </svg>
          {layout.nodes.map((node) => {
            const tech = techById.get(node.techId);
            if (tech === undefined) return null;
            return (
              <TechnologyNode
                key={node.techId}
                tech={tech}
                fieldLabel={field.label}
                x={node.x}
                y={node.y}
                dimmed={related !== null && !related.has(node.techId)}
                selected={selectedTechId === node.techId}
                onHover={setHovered}
                onSelect={onSelectTech}
              />
            );
          })}
        </div>
      </div>
      <ul
        aria-label="Chart key"
        className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground"
      >
        {TECH_STATUS_ORDER.map((status) => {
          const style = TECH_STATUS[status];
          const Icon = style.icon;
          return (
            <li key={status} className="flex items-center gap-1.5">
              <Icon aria-hidden="true" className={cn("size-3.5", style.iconTone)} />
              {style.label}
            </li>
          );
        })}
        <li className="ml-auto hidden md:block">Prerequisites flow left to right</li>
      </ul>
    </div>
  );
}
