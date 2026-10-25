import { CalendarClock, Check, Lock } from "lucide-react";
import { Progress } from "../../../components/ui/progress.js";
import { cn } from "../../../lib/utils.js";
import { monthsPhrase } from "../research-calendar.js";
import type { ResearchTechView } from "../research-view-model.js";
import { TECH_STATUS } from "./tech-status.js";

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function TechnologyDetail({
  tech,
  fieldLabel,
  className,
  showHeading = true,
}: {
  readonly tech: ResearchTechView;
  readonly fieldLabel: string;
  readonly className?: string;
  readonly showHeading?: boolean;
}) {
  const status = TECH_STATUS[tech.status];
  const Icon = status.icon;

  return (
    <div className={cn("space-y-2.5 text-xs", className)}>
      {showHeading && (
        <div className="flex items-start gap-2">
          <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", status.iconTone)} />
          <div className="min-w-0">
            <div className="text-sm leading-tight font-medium">{tech.label}</div>
            <div className="text-muted-foreground">
              {fieldLabel} · {status.label}
            </div>
          </div>
        </div>
      )}

      {(tech.investedPoints > 0 || tech.status === "researching") && (
        <div className="space-y-1">
          <Progress
            value={tech.progressPct}
            aria-label={`${tech.label} progress`}
            className="h-1.5"
          />
          <dl className="space-y-0.5">
            <Row label="Invested" value={`${tech.investedPoints} / ${tech.cost} pts`} />
            {tech.status === "researching" && (
              <Row
                label="At the projected rate"
                value={
                  tech.etaMonths === null
                    ? "No funding"
                    : tech.etaMonths === 0
                      ? "Completes next turn"
                      : `About ${monthsPhrase(tech.etaMonths)}`
                }
              />
            )}
          </dl>
        </div>
      )}

      {tech.status !== "researching" && tech.investedPoints === 0 && (
        <dl>
          <Row label="Cost" value={`${tech.cost} pts`} />
        </dl>
      )}

      {tech.status === "open" && (
        <div className="space-y-1 rounded-md bg-muted/60 p-2">
          {tech.oddsPct !== null ? (
            <>
              <div className="font-medium">{tech.oddsPct}% to be drawn next</div>
              <dl className="space-y-0.5">
                <Row label="Discovery weight" value={String(tech.discoveryWeight)} />
                <Row label="Historical timing" value={`× ${tech.timingModifierPct}%`} />
                <Row label="Draw weight" value={String(tech.drawWeight)} />
              </dl>
            </>
          ) : (
            <div>
              Queued behind <span className="font-medium">{tech.queuedBehind}</span>. The next draw
              happens when it completes.
            </div>
          )}
        </div>
      )}

      {tech.status === "future" && tech.availabilityLabel !== null && (
        <div className="flex items-center gap-1.5">
          <CalendarClock aria-hidden="true" className="size-3.5 text-muted-foreground" />
          Becomes available in {tech.availabilityLabel} ({monthsPhrase(tech.monthsUntilAvailable)})
        </div>
      )}

      {tech.prerequisites.length > 0 && (
        <div className="space-y-1">
          <div className="text-muted-foreground">Requires</div>
          <ul className="space-y-0.5">
            {tech.prerequisites.map((p) => (
              <li key={p.techId} className="flex items-center gap-1.5">
                {p.status === "discovered" ? (
                  <Check aria-hidden="true" className="size-3.5 text-primary" />
                ) : (
                  <Lock aria-hidden="true" className="size-3.5 text-muted-foreground" />
                )}
                <span className={p.status === "discovered" ? undefined : "text-muted-foreground"}>
                  {p.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
