import { Progress } from "../../../components/ui/progress.js";
import { monthsPhrase } from "../research-calendar.js";
import type { ResearchFieldView } from "../research-view-model.js";

export function FieldSummary({ field }: { readonly field: ResearchFieldView }) {
  const active = field.activeTech;
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{field.label}</span>
        <span className="text-muted-foreground">{field.weightLabel} priority</span>
      </div>
      <dl className="space-y-0.5">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Next turn</dt>
          <dd className="tabular-nums">
            {field.projectedPoints} pts · {field.sharePct}% of budget
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Discovered</dt>
          <dd className="tabular-nums">
            {field.discoveredTechs} of {field.totalTechs}
          </dd>
        </div>
      </dl>
      {active !== null && (
        <div className="space-y-1 rounded-md bg-muted/60 p-2">
          <div className="font-medium">{active.label}</div>
          <Progress value={active.progressPct} aria-label={`${active.label} progress`} />
          <div className="text-muted-foreground tabular-nums">
            {active.investedPoints} / {active.cost} pts
            {active.etaMonths !== null && active.etaMonths > 0
              ? ` · about ${monthsPhrase(active.etaMonths)}`
              : ""}
          </div>
        </div>
      )}
      <p className="text-muted-foreground">{field.stateNote}</p>
    </div>
  );
}
